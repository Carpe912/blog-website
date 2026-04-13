import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClaudeService } from './claude.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { QueryPostDto } from './dto/query-post.dto';

/**
 * 通用字段选择器 —— 不含 aiKeywords
 * 迁移前（列不存在）和迁移后均可正常使用。
 * Prisma 只生成 SELECT 了这些字段的 SQL，不会碰 aiKeywords 列。
 */
const POST_SELECT = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  content: true,
  cover: true,
  published: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  tags: {
    select: {
      tag: { select: { id: true, name: true, slug: true } },
    },
  },
} as const;

/** 列表页不需要 content，减少传输量；但需要 content 长度来计算阅读时间 */
const POST_LIST_SELECT = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  content: true,
  cover: true,
  published: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  tags: {
    select: {
      tag: { select: { id: true, name: true, slug: true } },
    },
  },
} as const;

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly claude: ClaudeService,
  ) {}

  async findAll(query: QueryPostDto) {
    const { page = 1, limit = 10, search, published, tagId } = query;
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
    if (tagId) where.tags = { some: { tagId } };

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
      data: items.map(this.formatPost),
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
    const { tagIds, ...postData } = dto;

    const existing = await this.prisma.post.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('slug 已存在');

    const publishedAt = postData.published ? new Date() : null;

    const post = await this.prisma.post.create({
      data: {
        ...postData,
        publishedAt,
        tags: tagIds?.length
          ? { create: tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })) }
          : undefined,
      },
      select: POST_SELECT,
    });

    // 异步提取 AI 关键词（不阻塞响应，迁移前静默跳过）
    if (postData.published) {
      this._asyncRefreshKeywords(
        (post as any).id,
        (post as any).title,
        dto.content,
      );
    }

    return this.formatPost(post);
  }

  async update(id: number, dto: UpdatePostDto) {
    const current = await this.findOne(id);
    const { tagIds, published, ...postData } = dto;

    if (dto.slug) {
      const conflict = await this.prisma.post.findFirst({
        where: { slug: dto.slug, NOT: { id } },
        select: { id: true },
      });
      if (conflict) throw new ConflictException('slug 已存在');
    }

    const publishedAt =
      published === true
        ? new Date()
        : published === false
        ? null
        : undefined;

    await this.prisma.post.update({
      where: { id },
      data: {
        ...postData,
        ...(published !== undefined ? { published } : {}),
        ...(publishedAt !== undefined ? { publishedAt } : {}),
        ...(tagIds !== undefined
          ? {
              tags: {
                deleteMany: {},
                create: tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })),
              },
            }
          : {}),
      },
    });

    const updated = await this.findOne(id);

    // 内容/标题变化或首次发布时重新提取关键词
    const needsRefresh =
      (published === true && !(current as any).published) ||
      (dto.title && dto.title !== (current as any).title) ||
      (dto.content && dto.content !== (current as any).content);

    if (needsRefresh && (updated as any).published) {
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

    const keywords = await this.claude.extractKeywords(post.title, post.content);

    // 若 aiKeywords 列不存在（未迁移），这里会抛出 —— 返回友好提示
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

  // ── 相关文章 ──────────────────────────────────────────────────────────────
  async findRelatedBySlug(slug: string, limit = 4) {
    const post = await this.prisma.post.findUnique({
      where: { slug },
      select: { id: true, tags: { select: { tagId: true } } },
    });
    if (!post) throw new NotFoundException(`文章 "${slug}" 不存在`);

    const tagIds = post.tags.map((pt) => pt.tagId);

    // 优先尝试 AI 关键词匹配（需要迁移后才可用）
    try {
      return await this._relatedByAiKeywords(post.id, slug, tagIds, limit);
    } catch {
      // 迁移前降级：仅用标签
      return await this._relatedByTagsOnly(post.id, tagIds, limit);
    }
  }

  // ── 私有：基于 AI 关键词的相关文章（需要 aiKeywords 列） ─────────────────
  private async _relatedByAiKeywords(
    postId: number,
    slug: string,
    tagIds: number[],
    limit: number,
  ) {
    // 读取当前文章的 AI 关键词（列不存在时这里会抛出）
    const kw = await (this.prisma.post as any).findUnique({
      where: { slug },
      select: { aiKeywords: true },
    });
    const aiKeywords: string[] = kw?.aiKeywords ?? [];

    const orConditions: any[] = [];
    if (aiKeywords.length > 0) orConditions.push({ aiKeywords: { hasSome: aiKeywords } });
    if (tagIds.length > 0) orConditions.push({ tags: { some: { tagId: { in: tagIds } } } });

    // 候选（aiKeywords WHERE 失败时会被上层 catch 接住）
    const candidates: any[] = await (this.prisma.post as any).findMany({
      where: {
        published: true,
        NOT: { id: postId },
        ...(orConditions.length > 0 ? { OR: orConditions } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit * 8,
      select: { ...POST_LIST_SELECT, aiKeywords: true },
    });

    return this._scoreAndSlice(candidates, aiKeywords, tagIds, limit);
  }

  // ── 私有：仅标签兜底（迁移前） ────────────────────────────────────────────
  private async _relatedByTagsOnly(
    postId: number,
    tagIds: number[],
    limit: number,
  ) {
    const hasTags = tagIds.length > 0;

    let candidates = await this.prisma.post.findMany({
      where: {
        published: true,
        NOT: { id: postId },
        ...(hasTags ? { tags: { some: { tagId: { in: tagIds } } } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit * 6,
      select: POST_LIST_SELECT,
    });

    if (candidates.length < limit) {
      const ids = [postId, ...candidates.map((c) => (c as any).id)];
      const extra = await this.prisma.post.findMany({
        where: { published: true, NOT: { id: { in: ids } } },
        orderBy: { createdAt: 'desc' },
        take: limit - candidates.length,
        select: POST_LIST_SELECT,
      });
      candidates = [...candidates, ...extra];
    }

    return this._scoreAndSlice(candidates, [], tagIds, limit);
  }

  // ── 私有：打分排序 ────────────────────────────────────────────────────────
  private _scoreAndSlice(
    candidates: any[],
    currentAiKws: string[],
    tagIds: number[],
    limit: number,
  ) {
    const currentKwSet = new Set(currentAiKws);

    const scored = candidates.map((c) => {
      let score = 0;

      // AI 关键词 Jaccard 相似度（主信号）
      if (currentKwSet.size > 0 && c.aiKeywords?.length > 0) {
        const candidateSet = new Set<string>(c.aiKeywords);
        const intersection = [...currentKwSet].filter((k) => candidateSet.has(k)).length;
        const union = new Set([...currentKwSet, ...candidateSet]).size;
        score += union > 0 ? (intersection / union) * 10 : 0;
      }

      // 标签重叠（次信号）
      const tagOverlap = (c.tags as any[]).filter((pt: any) => tagIds.includes(pt.tagId ?? pt.tag?.id)).length;
      score += tagOverlap * 0.5;

      return { post: c, score };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map((s) => this.formatPost(s.post));
  }

  // ── 私有：fire-and-forget 关键词提取 ─────────────────────────────────────
  private _asyncRefreshKeywords(id: number, title: string, content: string): void {
    this.claude
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
      .catch(() => { /* 静默失败 */ });
  }

  // ── 工具 ─────────────────────────────────────────────────────────────────
  private formatPost(post: any) {
    const { tags, content, ...rest } = post;
    // 中文约 400 字/分钟，最少 1 分钟
    const readingTime = Math.max(1, Math.round((content ?? '').length / 400));
    return {
      ...rest,
      readingTime,
      tags: (tags as any[]).map((pt: any) => pt.tag ?? pt),
    };
  }
}
