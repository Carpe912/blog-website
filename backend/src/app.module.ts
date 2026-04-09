import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { PostsModule } from './modules/posts/posts.module';
import { TagsModule } from './modules/tags/tags.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    PostsModule,
    TagsModule,
    AuthModule,
  ],
})
export class AppModule {}
