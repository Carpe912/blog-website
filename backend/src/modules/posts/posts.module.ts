import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { ClaudeService } from './claude.service';

@Module({
  controllers: [PostsController],
  providers: [PostsService, ClaudeService],
})
export class PostsModule {}
