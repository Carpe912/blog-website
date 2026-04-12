import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClaudeService } from './claude.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { QueryPostDto } from './dto/query-post.dto';

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
        include: {
          tags: {
            include: { tag: { select: { id: true, name: true, slug: true } } },
          },
        },
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
      include: {
        tags: {
          include: { tag: { select: { id: true, name: true, slug: true } } },
        },
      },
    });
    if (!post) throw new NotFoundException(`文章 #${id} 不存在`);
    return this.formatPost(post);
  }

  async findBySlug(slug: string) {
    const post = await this.prisma.post.findUnique({
      where: { slug },
      include: {
        tags: {
          include: { tag: { select: { id: true, name: true, slug: true } } },
        },
      },
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
      include: {
        tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
      },
    });

    // 异步提取 AI 关键词（不阻塞响应）
    if (postData.published) {
      this._asyncRefreshKeywords(post.id, post.title, post.content);
    }

    return post;
  }

  async update(id: number, dto: UpdatePostDto) {
    const current = await this.findOne(id);
    const { tagIds, published, ...postData } = dto;

    if (dto.slug) {
      const conflict = await this.prisma.post.findFirst({
        where: { slug: dto.slug, NOT: { id } },
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

    // 若内容或标题发生变化，重新提取关键词
    const needsRefresh =
      (published === true && !current.published) || // 首次发布
      (dto.title && dto.title !== current.title) ||  // 标题改变
      (dto.content && dto.content !== (current as any).content); // 正文改变

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

  // ── 手动刷新关键词（管理接口） ───────────────────────────────────────────
  async refreshKeywords(id: number) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: { title: true, content: true },
    });
    if (!post) throw new NotFoundException(`文章 #${id} 不存在`);

    const keywords = await this.claude.extractKeywords(post.title, post.content);
    await this.prisma.post.update({
      where: { id },
      data: { aiKeywords: keywords },
    });
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

  // ── 相关文章（基于 AI 语义关键词 Jaccard 相似度） ─────────────────────────
  async findRelatedBySlug(slug: string, limit = 4) {
    const post = await this.prisma.post.findUnique({
      where: { slug },
      select: {
        id: true,
        aiKeywords: true,
        tags: { select: { tagId: true } },
      },
    });
    if (!post) throw new NotFoundException(`文章 "${slug}" 不存在`);

    const tagIds = post.tags.map((pt) => pt.tagId);
    const hasAiKeywords = post.aiKeywords.length > 0;
    const hasTags = tagIds.length > 0;

    // 候选池：与当前文章有 AI 关键词重叠 OR 标签重叠的已发布文章
    const orConditions: any[] = [];
    if (hasAiKeywords) orConditions.push({ aiKeywords: { hasSome: post.aiKeywords } });
    if (hasTags) orConditions.push({ tags: { some: { tagId: { in: tagIds } } } });

    let candidates = await this.prisma.post.findMany({
      where: {
        published: true,
        NOT: { id: post.id },
        ...(orConditions.length > 0 ? { OR: orConditions } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit * 8,
      include: {
        tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
      },
    });

    // 不足时补充最新文章（兜底）
    if (candidates.length < limit) {
      const existingIds = [post.id, ...candidates.map((c) => c.id)];
      const extra = await this.prisma.post.findMany({
        where: { published: true, NOT: { id: { in: existingIds } } },
        orderBy: { createdAt: 'desc' },
        take: limit - candidates.length,
        include: {
          tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
        },
      });
      candidates = [...candidates, ...extra];
    }

    // 打分：AI 关键词 Jaccard 相似度（主信号）+ 标签重叠（次信号）
    const currentKwSet = new Set(post.aiKeywords);

    const scored = candidates.map((c) => {
      let score = 0;

      if (currentKwSet.size > 0 && c.aiKeywords.length > 0) {
        const candidateKwSet = new Set(c.aiKeywords);
        const intersection = [...currentKwSet].filter((k) => candidateKwSet.has(k)).length;
        const union = new Set([...currentKwSet, ...candidateKwSet]).size;
        // Jaccard × 10，放大到与标签分数同一量级
        score += union > 0 ? (intersection / union) * 10 : 0;
      }

      // 标签重叠作为补充信号（权重低）
      const tagOverlap = c.tags.filter((pt) => tagIds.includes(pt.tagId)).length;
      score += tagOverlap * 0.5;

      return { post: c, score };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map((s) => {
      const { tags, ...rest } = s.post as any;
      return { ...rest, tags: tags.map((pt: any) => pt.tag) };
    });
  }

  // ── 私有工具 ──────────────────────────────────────────────────────────────

  /** fire-and-forget：保存后异步提取，失败不影响主流程 */
  private _asyncRefreshKeywords(id: number, title: string, content: string): void {
    this.claude.extractKeywords(title, content).then((keywords) => {
      if (keywords.length > 0) {
        return this.prisma.post.update({ where: { id }, data: { aiKeywords: keywords } });
      }
    }).catch(() => { /* 静默失败，不影响用户 */ });
  }

  private formatPost(post: any) {
    return {
      ...post,
      tags: post.tags.map((pt: any) => pt.tag),
    };
  }
}
