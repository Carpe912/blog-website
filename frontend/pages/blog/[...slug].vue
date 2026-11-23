<script setup lang="ts">
import { DEFAULT_TOC_WIDTH } from '~/composables/useToc'

definePageMeta({ layout: 'default' })

const route = useRoute()
const config = useRuntimeConfig()
const postsApi = usePostsApi()
const { render } = useRichContent()

const slug = computed(() =>
  Array.isArray(route.params.slug) ? route.params.slug.join('/') : route.params.slug,
)

const { data: post } = await useAsyncData(
  `post-${slug.value}`,
  () => postsApi.getBySlug(slug.value),
)

if (!post.value) {
  throw createError({ statusCode: 404, statusMessage: '文章不存在' })
}

// 上一篇 / 下一篇
const { data: adjacent } = await useAsyncData(
  `adjacent-${slug.value}`,
  () => postsApi.getAdjacentBySlug(slug.value),
)

// 相关文章
const { data: related } = await useAsyncData(
  `related-${slug.value}`,
  () => postsApi.getRelatedBySlug(slug.value),
)

// SEO
useSeoMeta({
  title: `${post.value.title} · ${config.public.siteName}`,
  description: post.value.excerpt ?? post.value.title,
  ogTitle: post.value.title,
  ogDescription: post.value.excerpt ?? '',
})

// 富文本内容预处理（标题 id + 代码块包装）
const renderedContent = computed(() => render(post.value?.content ?? ''))

const formattedDate = computed(() => {
  if (!post.value?.publishedAt && !post.value?.createdAt) return ''
  const d = new Date(post.value.publishedAt || post.value.createdAt)
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
})

const readingTime = computed(() => post.value?.readingTime ?? 1)

// ── TOC ────────────────────────────────────────────────────────────────────
const articleRef = ref<HTMLElement | null>(null)
const { headings, activeId } = useToc(renderedContent, articleRef)

// 目录栏当前占宽（折叠时为 0），由 ArticleToc 上报，正文据此让位
const tocWidth = ref(DEFAULT_TOC_WIDTH)

// ── 代码块复制按钮 ──────────────────────────────────────────────────────────
useCodeCopy(articleRef)

function relatedDate(date: string) {
  return new Date(date).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}
</script>

<template>
  <div
    v-if="post"
    :class="headings.length ? 'xl:pl-[var(--toc-w)]' : ''"
    :style="{ '--toc-w': `${tocWidth}px` }"
  >
    <div class="reader-column pb-20">
      <header class="border-b border-[var(--reader-line)] pb-7 pt-10 sm:pb-9 sm:pt-14">
        <NuxtLink to="/" class="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-[var(--reader-accent)] hover:underline">
          <span aria-hidden="true">←</span> 全部文章
        </NuxtLink>
        <h1 class="reader-display mt-4 text-[clamp(1.5rem,1.125rem+1.75vw,2.125rem)] font-bold leading-[1.23]">
          {{ post.title }}
        </h1>
        <div class="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm tabular-nums text-[var(--reader-muted)]">
          <time :datetime="post.publishedAt || post.createdAt">{{ formattedDate }}</time>
          <span aria-hidden="true">·</span>
          <span>{{ readingTime }} 分钟阅读</span>
        </div>
      </header>

      <ArticleToc
        v-if="headings.length"
        :headings="headings"
        :active-id="activeId"
        @update:width="tocWidth = $event"
      />

      <article
        ref="articleRef"
        class="doc-body mt-8 sm:mt-10"
        v-html="renderedContent"
      />

      <nav
        v-if="adjacent && (adjacent.prev || adjacent.next)"
        aria-label="相邻文章"
        class="mt-16 grid gap-x-8 gap-y-6 border-t border-[var(--reader-line)] pt-6 sm:grid-cols-2"
      >
        <NuxtLink
          v-if="adjacent.prev"
          :to="`/blog/${adjacent.prev.slug}`"
          class="group min-w-0 py-1"
        >
          <p class="text-sm text-[var(--reader-accent)]">← 上一篇</p>
          <p class="mt-2 break-words font-medium leading-snug group-hover:underline">{{ adjacent.prev.title }}</p>
        </NuxtLink>
        <NuxtLink
          v-if="adjacent.next"
          :to="`/blog/${adjacent.next.slug}`"
          class="group min-w-0 py-1 sm:col-start-2 sm:text-right"
        >
          <p class="text-sm text-[var(--reader-accent)]">下一篇 →</p>
          <p class="mt-2 break-words font-medium leading-snug group-hover:underline">{{ adjacent.next.title }}</p>
        </NuxtLink>
      </nav>

      <section v-if="related && related.length" class="mt-12" aria-labelledby="related-heading">
        <h2 id="related-heading" class="reader-display mb-3 text-xl font-bold">相关文章</h2>
        <ul class="divide-y divide-[var(--reader-line)] border-y border-[var(--reader-line)]">
          <li v-for="item in related" :key="item.id">
            <NuxtLink :to="`/blog/${item.slug}`" class="group flex items-baseline justify-between gap-4 py-3.5 text-sm">
              <span class="min-w-0 break-words group-hover:text-[var(--reader-accent)]">{{ item.title }}</span>
              <time :datetime="item.createdAt" class="shrink-0 tabular-nums text-[var(--reader-muted)]">
                {{ relatedDate(item.createdAt) }}
              </time>
            </NuxtLink>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
