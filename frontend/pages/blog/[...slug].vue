<script setup lang="ts">
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
const tocWidth = ref(272)

// ── 代码块复制按钮 ──────────────────────────────────────────────────────────
useCodeCopy(articleRef)

function relatedDate(date: string) {
  return new Date(date).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}
</script>

<template>
  <div v-if="post">
    <!-- 左侧目录：固定在页面最左边，可拖拽调宽，过窄自动折叠 -->
    <ArticleToc
      v-if="headings.length >= 2"
      :headings="headings"
      :active-id="activeId"
      @update:width="tocWidth = $event"
    />

    <!-- 正文：目录让出的那一列（宽度跟随拖拽结果） -->
    <div
      :class="headings.length >= 2 ? 'xl:pl-[var(--toc-w)]' : ''"
      :style="{ '--toc-w': `${tocWidth}px` }"
    >
      <!-- 文章头部 -->
      <header class="mx-auto max-w-[1000px] px-6 pb-7 pt-14 sm:px-8 sm:pt-16">
        <NuxtLink
          to="/"
          class="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-400 transition-colors
                 hover:text-slate-700 dark:text-ink-300 dark:hover:text-ink-200"
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"><path d="M15 19l-7-7 7-7" /></svg>
          全部文章
        </NuxtLink>

        <h1 class="mt-5 text-[2rem] font-semibold leading-[1.28] tracking-tight text-slate-900 dark:text-ink-50 sm:text-[2.4rem]">
          {{ post.title }}
        </h1>

        <div class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-400 dark:text-ink-300 tabular-nums">
          <time :datetime="post.publishedAt || post.createdAt">{{ formattedDate }}</time>
          <span class="text-slate-300 dark:text-ink-600">|</span>
          <span>{{ readingTime }} 分钟阅读</span>
        </div>
      </header>

      <!-- 正文区 -->
      <div class="mx-auto max-w-[1000px] px-6 pb-20 sm:px-8">
        <article
          ref="articleRef"
          class="doc-body"
          v-html="renderedContent"
        />

        <!-- 页脚：上一篇 / 下一篇 -->
        <div
          v-if="adjacent && (adjacent.prev || adjacent.next)"
          class="mt-20 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-slate-200/80 sm:grid-cols-2 dark:border-ink-700"
        >
          <NuxtLink
            v-if="adjacent.prev"
            :to="`/blog/${adjacent.prev.slug}`"
            class="group bg-white px-6 py-5 transition-colors hover:bg-slate-50 dark:bg-ink-850 dark:hover:bg-ink-700/60"
          >
            <p class="flex items-center gap-1 text-[11px] text-slate-400 dark:text-ink-300">
              <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round"><path d="M15 19l-7-7 7-7" /></svg>
              上一篇
            </p>
            <p class="mt-1.5 line-clamp-2 text-[13.5px] font-medium leading-snug text-slate-700 transition-colors
                      group-hover:text-slate-950 dark:text-ink-200 dark:group-hover:text-ink-50">
              {{ adjacent.prev.title }}
            </p>
          </NuxtLink>
          <div v-else class="hidden bg-white sm:block dark:bg-ink-850" />

          <NuxtLink
            v-if="adjacent.next"
            :to="`/blog/${adjacent.next.slug}`"
            class="group bg-white px-6 py-5 text-right transition-colors hover:bg-slate-50 dark:bg-ink-850 dark:hover:bg-ink-700/60"
          >
            <p class="flex items-center justify-end gap-1 text-[11px] text-slate-400 dark:text-ink-300">
              下一篇
              <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7" /></svg>
            </p>
            <p class="mt-1.5 line-clamp-2 text-[13.5px] font-medium leading-snug text-slate-700 transition-colors
                      group-hover:text-slate-950 dark:text-ink-200 dark:group-hover:text-ink-50">
              {{ adjacent.next.title }}
            </p>
          </NuxtLink>
          <div v-else class="hidden bg-white sm:block dark:bg-ink-850" />
        </div>

        <!-- 相关文章 -->
        <div v-if="related && related.length" class="mt-16">
          <p class="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-ink-300">
            相关文章
          </p>
          <ul class="divide-y divide-slate-100 border-t border-slate-200/80 dark:divide-ink-700 dark:border-ink-700">
            <li v-for="item in related" :key="item.id">
              <NuxtLink
                :to="`/blog/${item.slug}`"
                class="group flex items-center gap-4 py-3.5"
              >
                <span class="min-w-0 flex-1 truncate text-[13.5px] text-slate-600 transition-colors
                             group-hover:text-slate-950 dark:text-ink-300 dark:group-hover:text-ink-50">
                  {{ item.title }}
                </span>
                <span class="shrink-0 text-[11px] text-slate-400 dark:text-ink-300 tabular-nums">
                  {{ relatedDate(item.createdAt) }}
                </span>
              </NuxtLink>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
