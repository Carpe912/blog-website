import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from './ai.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { QueryPostDto } from './dto/query-post.dto';

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
    return this.prisma.post.delete({ where: { id } });
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

  // ── 相关文章（基于 AI 关键词）─────────────────────────────────────────────
  async findRelatedBySlug(slug: string, limit = 4) {
    const post = await this.prisma.post.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!post) throw new NotFoundException(`文章 "${slug}" 不存在`);

    // 读取当前文章的 AI 关键词（列不存在时降级为空）
    const kw = await (this.prisma.post as any)
      .findUnique({ where: { slug }, select: { aiKeywords: true } })
      .catch(() => null);
    const aiKeywords: string[] = kw?.aiKeywords ?? [];

    let candidates: any[] = [];

    if (aiKeywords.length > 0) {
      candidates = await (this.prisma.post as any)
        .findMany({
          where: {
            published: true,
            NOT: { id: post.id },
            aiKeywords: { hasSome: aiKeywords },
          },
          orderBy: { createdAt: 'desc' },
          take: limit * 8,
          select: { ...POST_LIST_SELECT, aiKeywords: true },
        })
        .catch(() => []);
    }

    // 候选不足时用最新文章补齐
    if (candidates.length < limit) {
      const excludeIds = [post.id, ...candidates.map((c) => c.id)];
      const extra = await this.prisma.post.findMany({
        where: { published: true, NOT: { id: { in: excludeIds } } },
        orderBy: { createdAt: 'desc' },
        take: limit - candidates.length,
        select: POST_LIST_SELECT,
      });
      candidates = [...candidates, ...extra];
    }

    return this._scoreAndSlice(candidates, aiKeywords, limit);
  }

  // ── 私有：按关键词相似度打分 ──────────────────────────────────────────────
  private _scoreAndSlice(candidates: any[], currentAiKws: string[], limit: number) {
    const currentKwSet = new Set(currentAiKws);

    const scored = candidates.map((c) => {
      let score = 0;
      if (currentKwSet.size > 0 && c.aiKeywords?.length > 0) {
        const candidateSet = new Set<string>(c.aiKeywords);
        const intersection = [...currentKwSet].filter((k) => candidateSet.has(k)).length;
        const union = new Set([...currentKwSet, ...candidateSet]).size;
        score += union > 0 ? (intersection / union) * 10 : 0;
      }
      return { post: c, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => this.formatPost(s.post));
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
