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
  search(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.postsService.searchByQuery(
      q ?? '',
      Math.min(Number(limit) || 20, 50),
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

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.remove(id);
  }
}
