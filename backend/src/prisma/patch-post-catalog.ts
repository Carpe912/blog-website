import { Prisma, type PrismaClient } from '@prisma/client';
import { inferLegacyCatalog, readCatalogHeader } from '../modules/posts/article-catalog';

export async function patchPostCatalog(prisma: PrismaClient) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(72731, 1)`;
    // 线上数据库由已有表结构初始化。列注释记录补录已完成，重跑时保留后来主动清空的归属。
    const [marker] = await tx.$queryRaw<{ applied: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM pg_attribute
        WHERE attrelid = '"Post"'::regclass AND attname = 'series' AND NOT attisdropped
          AND col_description(attrelid, attnum) = 'blog-post-catalog-v1'
      ) AS applied
    `;
    if (marker.applied) return { applied: false, updated: 0 };

    await tx.$executeRaw`
      ALTER TABLE "Post"
        ADD COLUMN IF NOT EXISTS "series" VARCHAR(160),
        ADD COLUMN IF NOT EXISTS "topic" VARCHAR(160)
    `;
    const posts = await tx.post.findMany({
      where: { series: null, topic: null },
      select: { id: true, slug: true, content: true },
    });
    const rows = posts.flatMap(({ id, slug, content }) => {
      const { series, topic } = inferLegacyCatalog(slug, readCatalogHeader(content));
      return series || topic ? [Prisma.sql`(${id}::integer, ${series}::varchar(160), ${topic}::varchar(160))`] : [];
    });

    let updated = 0;
    if (rows.length > 0) {
      updated = await tx.$executeRaw`
        UPDATE "Post" AS post
        SET "series" = catalog.series, "topic" = catalog.topic
        FROM (VALUES ${Prisma.join(rows)}) AS catalog(id, series, topic)
        WHERE post.id = catalog.id AND post.series IS NULL AND post.topic IS NULL
      `;
    }
    await tx.$executeRaw`COMMENT ON COLUMN "Post"."series" IS 'blog-post-catalog-v1'`;
    return { applied: true, updated };
  }, { timeout: 60_000 });
}
