import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from './ai.service';
import { EmbeddingService, cosineSimilarity } from './embedding.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { QueryPostDto } from './dto/query-post.dto';
import { TAG_RULES } from './tag-vocabulary';
import { inferLegacyCatalog, normalizeCatalogName, readCatalogHeader } from './article-catalog';

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

/** 标签名归一化：去 #、多余空格和标点 */
function normalizeTagName(raw: string): string {
  return String(raw ?? '')
    .replace(/^[#＃\s]+/, '')
    .replace(/^["'「『]+|["'」』]+$/g, '')
    .replace(/[，,、；;。.！!？?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);
}

const GENERIC_AUTO_TAGS = new Set(['源码解析', '软件设计', '前端工程', 'agent工程']);

function normalizeSpecificTags(raw: string[]): string[] {
  const tags = new Map<string, string>();
  for (const item of raw) {
    const name = normalizeTagName(item);
    const key = name.toLowerCase();
    if (
      name.length < 2 ||
      TOPIC_STOP_WORDS.has(key) ||
      GENERIC_AUTO_TAGS.has(key.replace(/\s+/g, '')) ||
      tags.has(key)
    ) continue;
    tags.set(key, name);
    if (tags.size === 3) break;
  }
  return [...tags.values()];
}

/** 由标签名推导 slug：英文转小写连字符，中文保留原字符 */
function tagSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’'"]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fa5+-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** 从标题里切出候选术语：按标点和空格切段，再补上英文技术名词 */
function buildTopicTerms(post: any): Set<string> {
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
  series: true,
  topic: true,
  published: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
} as const;

/** 列表页同样返回 content，前端据此计算阅读时间 */
const POST_LIST_SELECT = POST_SELECT;

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);
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
  // 收严后的口径（宁缺毋滥），放行条件满足其一即可：
  //   a. 标题里有这个词（最确定）
  //   b. 命中该文的 AI 关键词，且该词不是"泛词" —— 泛词指出现在超过 25% 文章里的术语
  //      （如 Cordis 这种全站都在提的概念，光靠关键词命中说明不了主题）
  //      非泛词还要求语义相似度 >= 0.4，或查询本身是长短语（如 "Tool Result Pruner"）
  //   c. 摘要里有这个词，且语义相似度 >= 0.45
  //   d. 语义相似度 >= 0.62（没写这个词，但确实在讲同一件事）
  // 只在正文里擦边提到的、语义分数不够的，一律不返回。
  async searchByQuery(rawQuery: string, limit = 12, postIds?: ReadonlySet<number>) {
    const query = normalizeQuery(rawQuery);
    if (!query) return { data: [], meta: { total: 0, query: '', semantic: false } };

    const corpus = await this.getCorpus();
    const q = query.toLowerCase();
    const total = corpus.length || 1;
    // 查询本身是长短语时，关键词命中就足够有说服力（"Tool Result Pruner" 这类）
    const isPhraseQuery = /\s/.test(q) && q.length >= 8;

    // 关键词的文档频率：用于识别"全站都在提"的泛词
    const kwDf = new Map<string, number>();
    for (const p of corpus) {
      const seen = new Set(((p.aiKeywords ?? []) as string[]).map((k) => String(k).toLowerCase()));
      for (const k of seen) kwDf.set(k, (kwDf.get(k) ?? 0) + 1);
    }
    const kwIsGeneric = (kwDf.get(q) ?? 0) / total > 0.25;

    const candidates = postIds ? corpus.filter((post) => postIds.has(post.id)) : corpus;
    const matches = candidates.map((p) => {
      const inTitle = String(p.title ?? '').toLowerCase().includes(q);
      const inExcerpt = String(p.excerpt ?? '').toLowerCase().includes(q);
      const inBody = plainText(p.content).toLowerCase().includes(q);
      const inKeywords = ((p.aiKeywords ?? []) as string[]).some((k) => {
        const kw = String(k).toLowerCase();
        return kw === q || kw.includes(q) || (kw.length >= 4 && q.includes(kw));
      });
      return { post: p, inTitle, inExcerpt, inBody, inKeywords };
    });

    // 语义分：向量不可用时全部为 0，只靠字面/关键词命中
    let vectors: (number[] | null)[] = [];
    let queryVec: number[] | null = null;
    if (this.embedding.enabled && candidates.length > 0) {
      const texts = candidates.map(
        (p) => `${p.title}\n${p.excerpt ?? ''}\n${plainText(p.content).slice(0, 3000)}`,
      );
      const all = await this.embedding.embedMany([query, ...texts]);
      queryVec = all[0];
      vectors = all.slice(1);
    }

    const scored = matches.map((item, i) => {
      const cos = queryVec && vectors[i] ? cosineSimilarity(queryVec, vectors[i]!) : 0;

      const kwPass =
        item.inKeywords && !kwIsGeneric && (cos >= 0.4 || isPhraseQuery);

      const passed =
        item.inTitle ||
        kwPass ||
        (item.inExcerpt && cos >= 0.45) ||
        cos >= 0.62;

      // 命中位置越"显眼"，加分越多
      const boost = item.inTitle ? 0.3 : kwPass ? 0.2 : item.inExcerpt ? 0.12 : item.inBody ? 0.05 : 0;
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
    const published = dto.published ?? false;
    const catalog = dto.series === undefined && dto.topic === undefined
      ? inferLegacyCatalog(slug, readCatalogHeader(dto.content))
      : { series: normalizeCatalogName(dto.series), topic: normalizeCatalogName(dto.topic) };

    // 摘要与标签都靠模型生成，并行跑，避免串行等待
    const [excerpt, tagNames] = await Promise.all([
      this.resolveExcerpt(dto.title, dto.content, dto.excerpt),
      this.proposeTags(dto.title, dto.content),
    ]);

    const created = await this.prisma.post.create({
      data: {
        title: dto.title,
        slug,
        content: dto.content,
        excerpt,
        ...catalog,
        published,
        publishedAt: published ? new Date() : null,
      },
      select: POST_SELECT,
    });

    // 标签在响应前写入：接口一返回，文章就带标签，调用方无需传参
    if (tagNames.length > 0) {
      try {
        await this.applyTags(created.id, tagNames);
      } catch (err) {
        this.logger.error(`文章 #${created.id} 标签写入失败`, err);
      }
    }

    // 异步提取 AI 关键词（不阻塞响应）
    if (published) {
      this._asyncRefreshKeywords(created.id, created.title, dto.content);
    }

    this.invalidateCorpusCache();
    return this.findOne(created.id);
  }

  async update(id: number, dto: UpdatePostDto) {
    const current: any = await this.findOne(id);
    const { published, excerpt, slug, series, topic, ...postData } = dto;

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
        ...(series !== undefined ? { series: normalizeCatalogName(series) } : {}),
        ...(topic !== undefined ? { topic: normalizeCatalogName(topic) } : {}),
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

    // 标签：首次发布、标题/正文变化，或文章还没有标签时重新生成。
    const tagsStale =
      (published === true && !current.published) ||
      (postData.title != null && postData.title !== current.title) ||
      contentChanged ||
      (current.tags?.length ?? 0) === 0;

    if (tagsStale) {
      this._asyncRefreshTags(
        id,
        postData.title ?? current.title,
        postData.content ?? current.content,
      );
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

  // ── 手动刷新标签（管理接口）─────────────────────────────────────────────
  async refreshTags(id: number) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: { title: true, content: true },
    });
    if (!post) throw new NotFoundException(`文章 #${id} 不存在`);

    const tags = await this.syncTags(id, post.title, post.content);
    return { id, tags };
  }

  // ── 给存量文章补标签（管理接口，逐篇调用模型，按 id 升序）───────────────
  async backfillTags(limit = 50) {
    const posts = await this.prisma.post.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
      take: Math.min(Math.max(limit, 1), 200),
    });

    let tagged = 0;
    for (const { id } of posts) {
      try {
        const tags = await this.refreshTags(id);
        if (tags.tags.length > 0) tagged += 1;
      } catch (err) {
        this.logger.error(`文章 #${id} 补标签失败`, err);
      }
    }

    return { total: posts.length, tagged };
  }

  // ── 标签体系：复审 / 重建 / 全量重打 ─────────────────────────────────────
  //
  // 仅由管理接口显式触发，与日常的单篇标签生成分开。

  /** 复审词表；返回是否发生变化 */
  async reviewVocabulary() {
    const posts = await this.loadPostsForTags();
    if (posts.length === 0) return { changed: false, reason: 'no-posts' };

    const current = await this.loadTagCounts();
    const proposed = await this.ai.proposeVocabulary(
      posts.map((p) => ({ title: p.title, excerpt: p.excerpt })),
      current.map((t) => ({ name: t.name, count: t._count.posts })),
    );

    const vocabulary = this.normalizeVocabulary(proposed);
    if (vocabulary.length === 0) {
      return { changed: false, reason: 'empty-proposal' };
    }

    const previous = current.map((t) => t.name);
    if (this.isSameVocabulary(vocabulary, previous)) {
      return { changed: false, vocabulary };
    }

    const stats = await this.retagAll(vocabulary, posts);
    this.logger.log(`标签体系已更新：${previous.join('、')} → ${vocabulary.join('、')}`);
    return { changed: true, previous, vocabulary, ...stats };
  }

  // ── 重建标签体系（管理接口，dryRun 只预览词表）──────────────────────────
  async rebuildTags(dryRun = false) {
    const posts = await this.loadPostsForTags();
    if (posts.length === 0) {
      return { posts: 0, vocabulary: [], retagged: 0, pruned: 0, dryRun };
    }

    const current = await this.loadTagCounts();
    const proposed = await this.ai.proposeVocabulary(
      posts.map((p) => ({ title: p.title, excerpt: p.excerpt })),
      current.map((t) => ({ name: t.name, count: t._count.posts })),
    );

    const vocabulary = this.normalizeVocabulary(proposed);
    if (vocabulary.length === 0) {
      return {
        posts: posts.length,
        vocabulary: [],
        retagged: 0,
        pruned: 0,
        dryRun,
        warning: '模型没有返回可用词表，未做改动',
      };
    }

    if (dryRun) {
      return {
        posts: posts.length,
        vocabulary,
        current: current.map((t) => `${t.name}(${t._count.posts})`),
        dryRun: true,
      };
    }

    const stats = await this.retagAll(vocabulary, posts);
    return { posts: posts.length, vocabulary, ...stats, dryRun: false };
  }

  private async loadPostsForTags() {
    return this.prisma.post.findMany({
      select: { id: true, title: true, excerpt: true, content: true },
      orderBy: { id: 'asc' },
    });
  }

  private async loadTagCounts() {
    return this.prisma.tag.findMany({
      select: { name: true, _count: { select: { posts: true } } },
      orderBy: { posts: { _count: 'desc' } },
    });
  }

  /** 按给定词表重打全部文章，清理已无关联的旧标签。 */
  private async retagAll(
    vocabulary: string[],
    posts: { id: number; title: string; content: string }[],
  ) {
    for (const name of vocabulary) {
      await this.ensureTag(name);
    }

    const failures: number[] = [];
    let retagged = 0;

    for (const post of posts) {
      try {
        const raw = await this.ai.generateTags(post.title, post.content, vocabulary);
        let tags = this.canonicalizeTags(raw, vocabulary);
        if (tags.length === 0) {
          tags = this.fallbackTags(post.title, post.content, vocabulary);
        }
        if (tags.length === 0) {
          failures.push(post.id);
          continue;
        }
        await this.applyTags(post.id, tags);
        retagged += 1;
      } catch (err) {
        this.logger.error(`文章 #${post.id} 重打标签失败`, err);
        failures.push(post.id);
      }
    }

    // 已重打的旧标签可以清理；仍有关联的标签可能属于失败或并发新增的文章。
    const pruned = await this.prisma.tag.deleteMany({
      where: { name: { notIn: vocabulary }, posts: { none: {} } },
    });

    this.invalidateCorpusCache();
    return { retagged, pruned: pruned.count, failures };
  }

  /** 比较两套词表（忽略顺序与大小写） */
  private isSameVocabulary(a: string[], b: string[]): boolean {
    const normalize = (list: string[]) =>
      [...new Set(list.map((n) => n.trim().toLowerCase()))].sort();
    const left = normalize(a);
    const right = normalize(b);
    return left.length === right.length && left.every((v, i) => v === right[i]);
  }

  /** 词表归一化：去重、英文小写，最多 15 个 */
  private normalizeVocabulary(raw: string[]): string[] {
    const out: string[] = [];
    for (const item of raw) {
      const name = normalizeTagName(String(item));
      if (!name) continue;
      const normalized = /[\u4e00-\u9fa5]/.test(name) ? name : name.toLowerCase();
      if (out.some((n) => n.toLowerCase() === normalized.toLowerCase())) continue;
      out.push(normalized);
      if (out.length >= 15) break;
    }
    return out;
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
      series: true,
      topic: true,
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

  // ── 私有：标签生成与落库 ─────────────────────────────────────────────────
  //
  // 每篇独立生成；写入时由 ensureTag 复用同名标签。
  private async proposeTags(title: string, content: string): Promise<string[]> {
    const generated = normalizeSpecificTags(await this.ai.generateTags(title, content));
    if (generated.length > 0) return generated;

    // 模型不可用时只从标题主语取词，避免正文偶然提到的泛词成为标签。
    const subject = title.split(/[：:｜|？?]/, 1)[0]
      .replace(/^(?:深入理解|深入解析)\s*/, '')
      .replace(/\s*(?:源码深度解析|深度解析|全解析|详解)$/, '');
    return normalizeSpecificTags(subject.split(/\s+(?:与|和|vs\.?)\s+|[、，,]/i));
  }

  /** 把模型输出对齐到词表原词（大小写不敏感），去重并限制 3 个 */
  private canonicalizeTags(raw: string[], vocabulary: string[]): string[] {
    const map = new Map(vocabulary.map((name) => [name.toLowerCase(), name]));
    const out: string[] = [];

    for (const item of raw) {
      const key = normalizeTagName(item).toLowerCase();
      const hit = map.get(key);
      if (!hit || out.includes(hit)) continue;
      out.push(hit);
      if (out.length >= 3) break;
    }

    return out;
  }

  /** 关键词兜底：按规则命中，只保留词表里有的标签 */
  private fallbackTags(title: string, content: string, vocabulary: string[]): string[] {
    const text = `${title}\n${plainText(content).slice(0, 1500)}`;
    const allowed = new Set(vocabulary.map((n) => n.toLowerCase()));
    const out: string[] = [];

    for (const rule of TAG_RULES) {
      if (!rule.test.test(text)) continue;
      for (const name of rule.tags) {
        if (!allowed.has(name.toLowerCase()) || out.includes(name)) continue;
        out.push(name);
        if (out.length >= 3) return out;
      }
    }

    return out;
  }

  /** 生成标签并写入关联，返回实际落库的标签 */
  private async syncTags(id: number, title: string, content: string) {
    const names = await this.proposeTags(title, content);
    if (names.length === 0) return [];
    await this.applyTags(id, names);
    return this.prisma.tag.findMany({
      where: { posts: { some: { postId: id } } },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
  }

  /** 把标签名写入 PostTag（整体替换，保证与最新正文一致） */
  private async applyTags(postId: number, names: string[]): Promise<void> {
    const tagIds: number[] = [];
    for (const name of names) {
      tagIds.push(await this.ensureTag(name));
    }

    await this.prisma.$transaction([
      this.prisma.postTag.deleteMany({ where: { postId } }),
      this.prisma.postTag.createMany({
        data: tagIds.map((tagId) => ({ postId, tagId })),
        skipDuplicates: true,
      }),
    ]);
  }

  /** 按名称取标签 id，不存在则新建（slug 冲突时自动加后缀）*/
  private async ensureTag(name: string): Promise<number> {
    const found = await this.prisma.tag.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (found) return found.id;

    const base = tagSlug(name) || `tag-${Date.now().toString(36)}`;

    for (let i = 0; i < 5; i++) {
      const slug = i === 0 ? base : `${base}-${i + 1}`;
      try {
        const created = await this.prisma.tag.create({
          data: { name, slug },
          select: { id: true },
        });
        return created.id;
      } catch (err: any) {
        // 并发下同名标签已被创建，回查即可
        const again = await this.prisma.tag.findFirst({
          where: { name: { equals: name, mode: 'insensitive' } },
          select: { id: true },
        });
        if (again) return again.id;
        // 只有 slug 撞车才换后缀重试，其它错误直接抛
        if (err?.code !== 'P2002') throw err;
      }
    }

    throw new ConflictException(`标签「${name}」创建失败`);
  }

  // ── 私有：fire-and-forget 标签刷新 ───────────────────────────────────────
  private _asyncRefreshTags(id: number, title: string, content: string): void {
    this.syncTags(id, title, content).catch((err) => {
      this.logger.error(`文章 #${id} 标签刷新失败`, err);
    });
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
    // Prisma 返回的是 PostTag 关联数组，摊平成标签对象
    const tags = Array.isArray(post.tags)
      ? post.tags.map((item: any) => item.tag).filter(Boolean)
      : [];
    return { ...post, tags, readingTime };
  }
}
