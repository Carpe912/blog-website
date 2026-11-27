import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { patchPostCatalog } from './patch-post-catalog';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    const { applied, updated } = await patchPostCatalog(this);
    if (applied) this.logger.log(`已补录 ${updated} 篇文章的归属`);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
