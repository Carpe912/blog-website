import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from './ai.service';
import { EmbeddingService, cosineSimilarity } from './embedding.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { QueryPostDto } from './dto/query-post.dto';

/** 去掉 HTML 标签与实体，得到纯文本 */
function plainText(html: string): string {
  return (html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-zA-Z#0-9]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 判定相关文章时忽略的「大路货」词：
 * 这些词几乎每篇都有，拿来匹配等于没匹配。
 */
const TOPIC_STOP_WORDS = new Set([
  'agent',
  'llm',
  'ai',
  'session',
  'tool',
  'tools',
  'api',
  'app',
  'the',
  'and',
  'for',
  'with',
  'from',
  '介绍',
  '详解',
  '解析',
  '源码',
  '深入',
  '理解',
  '原理',
  '实现',
  '机制',
  '架构',
  '设计',
  '系统',
  '核心',
  '技术',
  '文章',
  '总结',
  '实践',
  '学习',
  '教程',
  '完整',
  '如何',
  '什么',
  '怎么',
  '为什么',
  '一个',
  '进行',
  '通过',
  '以及',
  '我们',
  '可以',
]);

/**
 * 搜索词归一化：去掉口语化的尾巴
 * 「cordis相关的文章」→「cordis」
 */
function normalizeQuery(raw: string): string {
  return (raw ?? '')
    .trim()
    .replace(/[?？!！。.]/g, '')
    .replace(/(相关|有关|类似|关于)?的?(文章|内容|博客|东西|资料)?$/g, '')
    .replace(/^(搜索|搜|查找|找|查)(一下|下)?/g, '')
    .replace(/^(关于|有关|类似|跟|和)\s*/g, '')
    .trim();
}

/** 从标题里切出候选术语：按标点和空格切段，再补上英文技术名词 */function buildTopicTerms(post: any): Set<string> {
  const terms = new Set<string>();

  const push = (raw: string) => {
    const term = raw.trim().toLowerCase();
    if (term.length < 2 || term.length > 40) return;
    if (TOPIC_STOP_WORDS.has(term)) return;
    // 纯数字/纯标点没意义
    if (!/[\p{L}]/u.test(term)) return;
    terms.add(term);
  };

  // 1) AI 提取的关键词：本身就是术语，权重最高
  for (const kw of (post.aiKeywords ?? []) as string[]) push(kw);

  // 2) 标题切段：标题里的专有名词往往就是文章主题
  const segments = String(post.title ?? '').split(
    /[：:，,。、；;·—\-–—|/\\（）()\[\]【】「」『』“”"'’‘!？?\s]+/,
  );
  for (const seg of segments) push(seg);

  // 3) 标题里的英文/数字技术名（如 Compaction、B+Tree、dsh-tools）
  const latin = String(post.title ?? '').match(/[A-Za-z][A-Za-z0-9.#+_/-]{1,}/g) ?? [];
  for (const token of latin) push(token);

  return terms;
}

/**
 * 通用字段选择器 —— 不含 aiKeywords
 * 迁移前（列不存在）和迁移后均可正常使用。
 */
const POST_SELECT = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  content: true,
  published: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** 列表页同样返回 content，前端据此计算阅读时间 */
const POST_LIST_SELECT = POST_SELECT;

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly embedding: EmbeddingService,
  ) {}

  async findAll(query: QueryPostDto) {
    const { page = 1, limit = 10, search, published } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (published !== undefined) where.published = published;

    const [total, items] = await Promise.all([
      this.prisma.post.count({ where }),
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: POST_LIST_SELECT,
      }),
    ]);

    return {
      data: items.map((item) => this.formatPost(item)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: number) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: POST_SELECT,
    });
    if (!post) throw new NotFoundException(`文章 #${id} 不存在`);
    return this.formatPost(post);
  }

  // ── 语义搜索：搜「cordis」这类概念，而不只是字面包含 ─────────────────────
  //
  // 收严后的口径（宁缺毋滥）：
  //   放行条件（满足其一）：
  //     a. 标题里就有这个词
  //     b. 命中该文章的 AI 关键词（说明它就是讲这个的）
  //     c. 摘要里有这个词，且语义相似度 >= 0.45
  //     d. 只在正文出现过，且语义相似度 >= 0.55（避免擦边提及也算命中）
  //     e. 语义相似度 >= 0.60（没写这个词，但确实在讲同一件事）
  //   其余一律不返回；limit 默认 12 条。
  async searchByQuery(rawQuery: string, limit = 12) {
    const query = normalizeQuery(rawQuery);
    if (!query) return { data: [], meta: { total: 0, query: '', semantic: false } };

    const corpus = await this.getCorpus();
    const q = query.toLowerCase();

    const matches = corpus.map((p) => {
      const title = String(p.title ?? '').toLowerCase();
      const excerpt = String(p.excerpt ?? '').toLowerCase();
      const inTitle = title.includes(q);
      const inExcerpt = excerpt.includes(q);
      const inBody = plainText(p.content).toLowerCase().includes(q);
      // AI 关键词本身就是术语，命中即说明该文主题对得上
      const inKeywords = ((p.aiKeywords ?? []) as string[]).some((k) => {
        const kw = String(k).toLowerCase();
        return kw === q || kw.includes(q) || (kw.length >= 4 && q.includes(kw));
      });
      return { post: p, inTitle, inExcerpt, inBody, inKeywords };
    });

    // 语义分：向量不可用时全部为 0，只靠字面/关键词命中
    let vectors: (number[] | null)[] = [];
    let queryVec: number[] | null = null;
    if (this.embedding.enabled) {
      const texts = corpus.map(
        (p) => `${p.title}\n${p.excerpt ?? ''}\n${plainText(p.content).slice(0, 3000)}`,
      );
      const all = await this.embedding.embedMany([query, ...texts]);
      queryVec = all[0];
      vectors = all.slice(1);
    }

    const scored = matches.map((item, i) => {
      const cos = queryVec && vectors[i] ? cosineSimilarity(queryVec, vectors[i]!) : 0;

      const passed =
        item.inTitle ||
        item.inKeywords ||
        (item.inExcerpt && cos >= 0.45) ||
        (item.inBody && cos >= 0.55) ||
        cos >= 0.6;

      // 命中位置越"显眼"，加分越多
      const boost = item.inTitle ? 0.3 : item.inKeywords ? 0.2 : item.inExcerpt ? 0.12 : item.inBody ? 0.05 : 0;
      return { post: item.post, cos, passed, score: cos + boost };
    });

    const kept = scored
      .filter((s) => s.passed)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      data: kept.map((s) => {
        const { content, aiKeywords, ...rest } = s.post as any;
        return { ...this.formatPost(rest), score: Number(s.score.toFixed(3)) };
      }),
      meta: { total: kept.length, query, semantic: Boolean(queryVec) },
    };
  }

  async findBySlug(slug: string) {
    const post = await this.prisma.post.findUnique({
      where: { slug },
      select: POST_SELECT,
    });
    if (!post) throw new NotFoundException(`文章 "${slug}" 不存在`);
    return this.formatPost(post);
  }

  async create(dto: CreatePostDto) {
    const slug = await this.resolveSlug(dto.slug);
    const excerpt = await this.resolveExcerpt(dto.title, dto.content, dto.excerpt);
    const published = dto.published ?? false;

    const post = await this.prisma.post.create({
      data: {
        title: dto.title,
        slug,
        content: dto.content,
        excerpt,
        published,
        publishedAt: published ? new Date() : null,
      },
      select: POST_SELECT,
    });

    // 异步提取 AI 关键词（不阻塞响应）
    if (published) {
      this._asyncRefreshKeywords(post.id, post.title, dto.content);
    }

    this.invalidateCorpusCache();
    return this.formatPost(post);
  }

  async update(id: number, dto: UpdatePostDto) {
    const current: any = await this.findOne(id);
    const { published, excerpt, slug, ...postData } = dto;

    if (slug && slug !== current.slug) {
      const conflict = await this.prisma.post.findFirst({
        where: { slug, NOT: { id } },
        select: { id: true },
      });
      if (conflict) throw new ConflictException('slug 已存在');
    }

    // 摘要：显式传入优先；否则在正文变化或原摘要为空时重新生成
    const contentChanged =
      postData.content !== undefined && postData.content !== current.content;
    let nextExcerpt = current.excerpt ?? null;

    if (excerpt !== undefined) {
      nextExcerpt = excerpt?.trim() || null;
    } else if (contentChanged || !nextExcerpt) {
      nextExcerpt = await this.resolveExcerpt(
        postData.title ?? current.title,
        postData.content ?? current.content,
      );
    }

    const publishedAt =
      published === true
        ? current.publishedAt ?? new Date()
        : published === false
          ? null
          : undefined;

    await this.prisma.post.update({
      where: { id },
      data: {
        ...postData,
        ...(slug ? { slug } : {}),
        excerpt: nextExcerpt,
        ...(published !== undefined ? { published } : {}),
        ...(publishedAt !== undefined ? { publishedAt } : {}),
      },
    });

    const updated: any = await this.findOne(id);
    this.invalidateCorpusCache();

    // 内容/标题变化或首次发布时重新提取关键词
    const needsRefresh =
      (published === true && !current.published) ||
      (postData.title && postData.title !== current.title) ||
      contentChanged;

    if (needsRefresh && updated.published) {
      const raw = await this.prisma.post.findUnique({
        where: { id },
        select: { title: true, content: true },
      });
      if (raw) this._asyncRefreshKeywords(id, raw.title, raw.content);
    }

    return updated;
  }

  async remove(id: number) {
    await this.findOne(id);
    const removed = await this.prisma.post.delete({ where: { id } });
    this.invalidateCorpusCache();
    return removed;
  }

  // ── 手动刷新 AI 关键词（管理接口）────────────────────────────────────────
  async refreshKeywords(id: number) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: { title: true, content: true },
    });
    if (!post) throw new NotFoundException(`文章 #${id} 不存在`);

    const keywords = await this.ai.extractKeywords(post.title, post.content);

    try {
      await (this.prisma.post as any).update({
        where: { id },
        data: { aiKeywords: keywords },
      });
    } catch {
      return { id, aiKeywords: keywords, warning: '数据库迁移尚未执行，关键词未持久化' };
    }

    this.invalidateCorpusCache();
    return { id, aiKeywords: keywords };
  }

  // ── 上一篇 / 下一篇 ───────────────────────────────────────────────────────
  async findAdjacentBySlug(slug: string) {
    const post = await this.prisma.post.findUnique({
      where: { slug },
      select: { id: true, createdAt: true },
    });
    if (!post) throw new NotFoundException(`文章 "${slug}" 不存在`);

    const [prev, next] = await Promise.all([
      this.prisma.post.findFirst({
        where: { published: true, createdAt: { lt: post.createdAt } },
        orderBy: { createdAt: 'desc' },
        select: { title: true, slug: true },
      }),
      this.prisma.post.findFirst({
        where: { published: true, createdAt: { gt: post.createdAt } },
        orderBy: { createdAt: 'asc' },
        select: { title: true, slug: true },
      }),
    ]);

    return { prev: prev ?? null, next: next ?? null };
  }

  // ── 相关文章：本文正文里"提到了什么"，再找讲解该概念的文章 ────────────────
  //
  // 旧实现只看「AI 关键词集合的交集」，命中不足时还用最新文章补齐，
  // 结果就是每篇文末都挂着几篇无关的最新文章。
  //
  // 现在的判定口径：
  //   1. 候选文章的主题词 = AI 关键词 + 标题切分出的术语（含英文技术名）
  //   2. 只有当这些主题词真正出现在**当前文章的标题/摘要/正文**里，才算命中
  //   3. 命中词的权重按 IDF 计算 —— 越少见越值钱，
  //      "Agent""Session"这类几乎每篇都有的词几乎不加分
  //   4. 命中太少或过于大众的文章直接丢弃，宁可少显示也不凑数（不再用最新文章兜底）
  async findRelatedBySlug(slug: string, limit = 3) {
    const corpus = await this.getCorpus();
    const current = corpus.find((p) => p.slug === slug);
    if (!current) throw new NotFoundException(`文章 "${slug}" 不存在`);

    const others = corpus.filter((p) => p.id !== current.id);
    if (others.length === 0) return [];

    const total = corpus.length;
    // 当前文章的检索文本：标题权重最高，其次摘要、正文
    const curTitle = current.title.toLowerCase();
    const curExcerpt = (current.excerpt ?? '').toLowerCase();
    const curBody = plainText(current.content).toLowerCase();
    const curAll = `${curTitle}\n${curExcerpt}\n${curBody}`;

    const terms = new Map<number, string[]>(); // 候选文章 id → 主题词
    for (const p of others) terms.set(p.id, Array.from(buildTopicTerms(p)));

    // 文档频率（词出现在多少篇文章里），用于 IDF 加权
    const df = new Map<string, number>();
    for (const list of terms.values()) {
      for (const t of list) df.set(t, (df.get(t) ?? 0) + 1);
    }

    const scored = others.map((p) => {
      const list = terms.get(p.id) ?? [];
      let score = 0;
      let strongHits = 0; // 命中且不算大众的词数量
      let rareHits = 0; // 命中且极少见的词数量

      for (const term of list) {
        if (!curAll.includes(term)) continue;

        const freq = df.get(term) ?? 1;
        // 稀有度权重：全站都有的词趋近 0，只有少数文章提到的词最高
        const idf = Math.log(1 + total / freq);
        // 出现在标题里的概念，说明本文真的在讲它
        const weight = curTitle.includes(term) ? 2.4 : curExcerpt.includes(term) ? 1.6 : 1;
        score += idf * weight;

        if (freq <= Math.max(3, Math.ceil(total * 0.4))) strongHits += 1;
        if (freq <= 3 && term.length >= 3) rareHits += 1;
      }

      return { post: p, score, strongHits, rareHits };
    });

    // 相关性门槛：至少 2 个非大众主题词，或 1 个罕见的专有概念
    const passed = scored.filter(
      (s) => s.score > 0 && (s.strongHits >= 2 || s.rareHits >= 1),
    );
    if (passed.length === 0) return [];

    passed.sort((a, b) => b.score - a.score);
    const best = passed[0].score;

    // ── 用向量语义相似度给"已经过了关键词门槛"的候选排序 ──
    // 关键词门槛保证「本文确实提到了这篇讲的东西」，向量负责判断
    // 「提到的那件事，跟那篇文章的主线有多近」。向量不可用时退回关键词分。
    const ranked = await this.rankByEmbedding(current, passed, best);

    // 与最佳结果差距过大的尾部去掉，避免"勉强相关"凑数
    const topScore = ranked[0]?.final ?? 1;
    const kept = ranked
      .filter((s) => s.final >= topScore * 0.35)
      .slice(0, limit);

    return kept.map((s) => {
      const { content, aiKeywords, ...rest } = s.post as any;
      return this.formatPost(rest);
    });
  }

  /** 关键词分（0~1，按本次最高分归一）与余弦相似度加权，得到最终排序分 */
  private async rankByEmbedding(
    current: any,
    candidates: { post: any; score: number }[],
    bestScore: number,
  ) {
    const baseline = candidates.map((c) => ({
      ...c,
      cos: 0,
      final: bestScore > 0 ? c.score / bestScore : 0,
    }));

    if (!this.embedding.enabled || candidates.length === 0) return baseline;

    const texts = [current, ...candidates.map((c) => c.post)].map((p) =>
      `${p.title}\n${p.excerpt ?? ''}\n${plainText(p.content).slice(0, 3000)}`,
    );
    const vectors = await this.embedding.embedMany(texts);
    const curVec = vectors[0];
    if (!curVec) return baseline;

    return baseline
      .map((c, i) => {
        const cos = vectors[i + 1] ? cosineSimilarity(curVec, vectors[i + 1]!) : 0;
        return {
          ...c,
          cos,
          // 语义占七成：同样是"提到了"，讲同一件事的文章更该排在前面
          final: cos * 0.7 + c.final * 0.3,
        };
      })
      .sort((a, b) => b.final - a.final);
  }

  // ── 私有：全站文章语料（带 5 分钟缓存，写操作后立即失效）─────────────────
  private corpusCache: { at: number; posts: any[] } | null = null;
  private static readonly CORPUS_TTL = 5 * 60 * 1000;

  private async getCorpus(): Promise<any[]> {
    const now = Date.now();
    if (this.corpusCache && now - this.corpusCache.at < PostsService.CORPUS_TTL) {
      return this.corpusCache.posts;
    }

    const baseSelect = {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      createdAt: true,
    };

    let rows: any[];
    try {
      rows = await (this.prisma.post as any).findMany({
        where: { published: true },
        select: { ...baseSelect, aiKeywords: true },
      });
    } catch {
      // aiKeywords 列还没迁移时降级：只靠标题里的术语
      rows = await this.prisma.post.findMany({
        where: { published: true },
        select: baseSelect,
      });
    }

    const posts = rows.map((r) => ({ ...r, aiKeywords: r.aiKeywords ?? [] }));
    this.corpusCache = { at: now, posts };
    return posts;
  }

  private invalidateCorpusCache() {
    this.corpusCache = null;
  }

  // ── 私有：slug 生成与校验 ─────────────────────────────────────────────────
  private async resolveSlug(input?: string): Promise<string> {
    const provided = input?.trim();
    if (provided) {
      const exists = await this.prisma.post.findUnique({
        where: { slug: provided },
        select: { id: true },
      });
      if (exists) throw new ConflictException('slug 已存在');
      return provided;
    }

    // 未填写时随机生成，重试 5 次规避极小概率的碰撞
    for (let i = 0; i < 5; i++) {
      const slug = this.randomSlug();
      const exists = await this.prisma.post.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!exists) return slug;
    }
    throw new ConflictException('slug 生成失败，请稍后重试');
  }

  private randomSlug(): string {
    const time = Date.now().toString(36).slice(-5);
    const rand = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
    return `${time}${rand}`;
  }

  // ── 私有：摘要生成 ───────────────────────────────────────────────────────
  private async resolveExcerpt(
    title: string,
    content: string,
    provided?: string,
  ): Promise<string | null> {
    const text = provided?.trim();
    if (text) return text;

    const ai = await this.ai.generateExcerpt(title, content);
    if (ai) return ai;

    // 模型不可用时的兜底：取正文前 120 字
    return this.fallbackExcerpt(content);
  }

  private fallbackExcerpt(content: string): string | null {
    const plain = content
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return plain ? plain.slice(0, 120) : null;
  }

  // ── 私有：fire-and-forget 关键词提取 ─────────────────────────────────────
  private _asyncRefreshKeywords(id: number, title: string, content: string): void {
    this.ai
      .extractKeywords(title, content)
      .then(async (keywords) => {
        if (keywords.length === 0) return;
        try {
          await (this.prisma.post as any).update({
            where: { id },
            data: { aiKeywords: keywords },
          });
          // 关键词变了，相关文章要重新算
          this.invalidateCorpusCache();
        } catch {
          // 迁移尚未执行，静默忽略
        }
      })
      .catch(() => {
        /* 静默失败 */
      });
  }

  // ── 工具 ─────────────────────────────────────────────────────────────────
  private formatPost(post: any) {
    // 中文约 400 字/分钟，最少 1 分钟
    const readingTime = Math.max(1, Math.round((post.content ?? '').length / 400));
    return { ...post, readingTime };
  }
}
