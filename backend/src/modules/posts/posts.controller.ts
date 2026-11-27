import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { QueryPostDto } from './dto/query-post.dto';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  findAll(@Query() query: QueryPostDto) {
    return this.postsService.findAll(query);
  }

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.postsService.findBySlug(slug);
  }

  @Get('slug/:slug/adjacent')
  findAdjacentBySlug(@Param('slug') slug: string) {
    return this.postsService.findAdjacentBySlug(slug);
  }

  @Get('slug/:slug/related')
  findRelatedBySlug(@Param('slug') slug: string) {
    return this.postsService.findRelatedBySlug(slug);
  }

  // 注意：必须放在 @Get(':id') 之前，否则 search 会被当成 id 解析
  @Get('search')
  search(
    @Query('q') q: string,
    @Query('limit') limit?: string,
    @Query('postIds') postIds?: string,
  ) {
    const scope = postIds === undefined
      ? undefined
      : new Set(String(postIds).split(',', 1000).map(Number).filter((id) => Number.isSafeInteger(id) && id > 0));
    return this.postsService.searchByQuery(
      q ?? '',
      Math.min(Number(limit) || 20, 50),
      scope,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePostDto) {
    return this.postsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePostDto) {
    return this.postsService.update(id, dto);
  }

  @Post(':id/refresh-keywords')
  refreshKeywords(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.refreshKeywords(id);
  }

  // 标签由正文自动生成，参数里没有标签字段
  @Post(':id/refresh-tags')
  refreshTags(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.refreshTags(id);
  }

  // 给存量文章批量补标签（逐篇调用模型，limit 默认 50）
  @Post('backfill-tags')
  backfillTags(@Query('limit') limit?: string) {
    return this.postsService.backfillTags(Number(limit) || 50);
  }

  // 重建标签体系：按全部文章重生成词表并逐篇重打标签
  // dryRun=true 只返回模型提议的词表，不写库
  @Post('rebuild-tags')
  rebuildTags(@Query('dryRun') dryRun?: string) {
    return this.postsService.rebuildTags(dryRun === 'true' || dryRun === '1');
  }

  // 手动复审词表：有变化才全量重打。
  @Post('review-tags')
  reviewTags() {
    return this.postsService.reviewVocabulary();
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.remove(id);
  }
}
