import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.tag.findMany({
      include: {
        _count: { select: { posts: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number) {
    const tag = await this.prisma.tag.findUnique({
      where: { id },
      include: {
        _count: { select: { posts: true } },
        posts: {
          include: { post: { select: { id: true, title: true, slug: true, published: true } } },
        },
      },
    });
    if (!tag) throw new NotFoundException(`标签 #${id} 不存在`);
    return tag;
  }

  async create(dto: CreateTagDto) {
    const existing = await this.prisma.tag.findFirst({
      where: { OR: [{ name: dto.name }, { slug: dto.slug }] },
    });
    if (existing) throw new ConflictException('标签名称或 slug 已存在');

    return this.prisma.tag.create({ data: dto });
  }

  async update(id: number, dto: UpdateTagDto) {
    await this.findOne(id);

    if (dto.name || dto.slug) {
      const conflict = await this.prisma.tag.findFirst({
        where: {
          OR: [
            dto.name ? { name: dto.name } : undefined,
            dto.slug ? { slug: dto.slug } : undefined,
          ].filter(Boolean),
          NOT: { id },
        },
      });
      if (conflict) throw new ConflictException('标签名称或 slug 已存在');
    }

    return this.prisma.tag.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.tag.delete({ where: { id } });
  }
}
