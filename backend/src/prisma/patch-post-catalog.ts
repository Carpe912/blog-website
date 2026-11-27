import { Prisma, type PrismaClient } from '@prisma/client';
import { AI_ENGINEERING, inferLegacyCatalog, readCatalogHeader } from '../modules/posts/article-catalog';

export async function patchPostCatalog(prisma: PrismaClient) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(72731, 1)`;
    // 线上数据库由已有表结构初始化。列注释记录补录已完成，重跑时保留后来主动清空的归属。
    const [marker] = await tx.$queryRaw<{ version: string | null }[]>`
      SELECT col_description(attrelid, attnum) AS version FROM pg_attribute
      WHERE attrelid = '"Post"'::regclass AND attname = 'series' AND NOT attisdropped
    `;
    if (marker?.version === 'blog-post-catalog-v2') return { applied: false, updated: 0 };

    const updated = marker?.version === 'blog-post-catalog-v1'
      // 该专题在首版补录前刚改名。补上已识别为该专题、仍缺少系列的三篇正式篇目。
      ? await tx.$executeRaw`
        UPDATE "Post" SET "series" = ${AI_ENGINEERING}
        WHERE "series" IS NULL AND "topic" = '代码分析与 Coding Agent'
          AND "slug" IN ('pswh9ei9k1q', 'cndb6wa3c98', 'dcab84w3q99')
      `
      : await backfillCatalog(tx);
    await tx.$executeRaw`COMMENT ON COLUMN "Post"."series" IS 'blog-post-catalog-v2'`;
    return { applied: true, updated };
  }, { timeout: 60_000 });
}

async function backfillCatalog(tx: Prisma.TransactionClient) {
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
  if (rows.length === 0) return 0;

  return tx.$executeRaw`
    UPDATE "Post" AS post
    SET "series" = catalog.series, "topic" = catalog.topic
    FROM (VALUES ${Prisma.join(rows)}) AS catalog(id, series, topic)
    WHERE post.id = catalog.id AND post.series IS NULL AND post.topic IS NULL
  `;
}
