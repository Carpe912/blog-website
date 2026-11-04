import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { AiService } from './ai.service';

@Module({
  controllers: [PostsController],
  providers: [PostsService, AiService],
})
export class PostsModule {}
