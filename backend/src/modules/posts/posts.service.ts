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

  async findAdjacentBySlug(slug: string) {
    const post = await this.prisma.post.findUnique({
      where: { slug },
      select: { id: true, createdAt: true },
    });
    if (!post) throw new NotFoundException(`文章 "${slug}" 不存在`);

    const [prev, next] = await Promise.all([
      // 上一篇：比当前文章更早，取最新的一篇
      this.prisma.post.findFirst({
        where: { published: true, createdAt: { lt: post.createdAt } },
        orderBy: { createdAt: 'desc' },
        select: { title: true, slug: true },
      }),
      // 下一篇：比当前文章更新，取最旧的一篇
      this.prisma.post.findFirst({
        where: { published: true, createdAt: { gt: post.createdAt } },
        orderBy: { createdAt: 'asc' },
        select: { title: true, slug: true },
      }),
    ]);

    return { prev: prev ?? null, next: next ?? null };
  }

  private formatPost(post: any) {
    return {
      ...post,
      tags: post.tags.map((pt: any) => pt.tag),
    };
  }
}
