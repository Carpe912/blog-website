import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { QueryPostDto } from './dto/query-post.dto';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.post.create({
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
  }

  async update(id: number, dto: UpdatePostDto) {
    await this.findOne(id);
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

    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.post.delete({ where: { id } });
  }

  // ── 上一篇 / 下一篇 ───────────────────────────────────────────────────────
  async findAdjacentBySlug(slug: string) {
    const post = await this.prisma.post.findUnique({
      where: { slug },
      select: { id: true, createdAt: true },
    });
    if (!post) throw new NotFoundException(`文章 "${slug}" 不存在`);

    const [prev, next] = await Promise.all([
      // 上一篇：时间更早，取最近的一篇
      this.prisma.post.findFirst({
        where: { published: true, createdAt: { lt: post.createdAt } },
        orderBy: { createdAt: 'desc' },
        select: { title: true, slug: true },
      }),
      // 下一篇：时间更新，取最早的一篇
      this.prisma.post.findFirst({
        where: { published: true, createdAt: { gt: post.createdAt } },
        orderBy: { createdAt: 'asc' },
        select: { title: true, slug: true },
      }),
    ]);

    return { prev: prev ?? null, next: next ?? null };
  }

  // ── 相关文章（按标签重叠度排序，补充内容关键词相似度） ────────────────────
  async findRelatedBySlug(slug: string, limit = 4) {
    // 1. 获取当前文章的标签和摘要关键词
    const post = await this.prisma.post.findUnique({
      where: { slug },
      select: {
        id: true,
        title: true,
        excerpt: true,
        tags: { select: { tagId: true } },
      },
    });
    if (!post) throw new NotFoundException(`文章 "${slug}" 不存在`);

    const tagIds = post.tags.map((pt) => pt.tagId);

    // 2. 候选池：有共同标签的已发布文章（取多一些再重排序）
    const hasTags = tagIds.length > 0;
    const candidates = await this.prisma.post.findMany({
      where: {
        published: true,
        NOT: { id: post.id },
        ...(hasTags ? { tags: { some: { tagId: { in: tagIds } } } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit * 5,
      include: {
        tags: {
          include: { tag: { select: { id: true, name: true, slug: true } } },
        },
      },
    });

    // 3. 若候选不足，补充最新文章
    if (candidates.length < limit) {
      const ids = candidates.map((c) => c.id);
      const extra = await this.prisma.post.findMany({
        where: { published: true, NOT: { id: { in: [post.id, ...ids] } } },
        orderBy: { createdAt: 'desc' },
        take: limit - candidates.length,
        include: {
          tags: {
            include: { tag: { select: { id: true, name: true, slug: true } } },
          },
        },
      });
      candidates.push(...extra);
    }

    // 4. 按标签重叠数 + 标题/摘要关键词命中打分排序
    const keywords = this._extractKeywords(`${post.title} ${post.excerpt ?? ''}`);

    const scored = candidates.map((c) => {
      const tagOverlap = c.tags.filter((pt) => tagIds.includes(pt.tagId)).length;
      const textScore = this._keywordScore(
        `${c.title} ${c.excerpt ?? ''}`,
        keywords,
      );
      return { post: c, score: tagOverlap * 3 + textScore };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map((s) => {
      const { tags, ...rest } = s.post as any;
      return { ...rest, tags: tags.map((pt: any) => pt.tag) };
    });
  }

  // ── 私有工具 ──────────────────────────────────────────────────────────────
  private _extractKeywords(text: string): string[] {
    // 中文按字切分（2-gram），英文按单词切分，过滤停用词
    const stopWords = new Set(['的', '了', '和', '是', '在', '有', 'the', 'a', 'an', 'of', 'to', 'and', 'for', 'in', 'with']);
    const words: string[] = [];
    // 英文单词
    const enWords = text.match(/[a-zA-Z]{2,}/g) ?? [];
    enWords.forEach((w) => {
      if (!stopWords.has(w.toLowerCase())) words.push(w.toLowerCase());
    });
    // 中文 2-gram
    const zhText = text.replace(/[^\u4e00-\u9fa5]/g, '');
    for (let i = 0; i < zhText.length - 1; i++) {
      const gram = zhText.slice(i, i + 2);
      if (!stopWords.has(gram[0]) && !stopWords.has(gram[1])) {
        words.push(gram);
      }
    }
    return [...new Set(words)];
  }

  private _keywordScore(text: string, keywords: string[]): number {
    const lower = text.toLowerCase();
    return keywords.reduce((score, kw) => score + (lower.includes(kw) ? 1 : 0), 0);
  }

  private formatPost(post: any) {
    return {
      ...post,
      tags: post.tags.map((pt: any) => pt.tag),
    };
  }
}
