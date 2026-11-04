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

// ── 代码块复制按钮 ──────────────────────────────────────────────────────────
useCodeCopy(articleRef)

function relatedDate(date: string) {
  return new Date(date).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}
</script>

<template>
  <div v-if="post">
    <!-- 文章头部 -->
    <header class="mx-auto max-w-3xl px-6 pb-10 pt-16 sm:px-8 sm:pt-20">
      <NuxtLink
        to="/"
        class="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-400 transition-colors
               hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"><path d="M15 19l-7-7 7-7" /></svg>
        全部文章
      </NuxtLink>

      <h1 class="mt-7 text-[1.85rem] font-semibold leading-[1.3] tracking-tight text-slate-900 dark:text-slate-50 sm:text-[2.15rem]">
        {{ post.title }}
      </h1>

      <div class="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-400 dark:text-slate-500 tabular-nums">
        <time :datetime="post.publishedAt || post.createdAt">{{ formattedDate }}</time>
        <span class="text-slate-300 dark:text-slate-700">·</span>
        <span>{{ readingTime }} 分钟阅读</span>
      </div>
    </header>

    <!-- 正文区 -->
    <div class="mx-auto max-w-5xl px-6 pb-24 sm:px-8">
      <div class="flex items-start gap-14">
        <article
          ref="articleRef"
          class="prose prose-slate min-w-0 max-w-none flex-1
                 dark:prose-invert
                 prose-headings:font-semibold prose-headings:tracking-tight
                 prose-a:text-slate-900 prose-a:underline prose-a:decoration-slate-300 prose-a:underline-offset-2
                 hover:prose-a:decoration-slate-500
                 dark:prose-a:text-slate-100 dark:prose-a:decoration-slate-600"
          v-html="renderedContent"
        />

        <!-- 目录 -->
        <aside
          v-if="headings.length >= 2"
          class="sticky top-24 hidden w-48 shrink-0 xl:block"
        >
          <p class="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-slate-600">
            目录
          </p>
          <nav class="max-h-[calc(100vh-8rem)] space-y-1 overflow-y-auto">
            <a
              v-for="h in headings"
              :key="h.id"
              :href="`#${h.id}`"
              class="block truncate rounded py-0.5 text-[12.5px] leading-relaxed transition-colors"
              :class="[
                h.level === 3 ? 'pl-3' : '',
                activeId === h.id
                  ? 'text-slate-900 dark:text-slate-100'
                  : 'text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300',
              ]"
            >
              {{ h.text }}
            </a>
          </nav>
        </aside>
      </div>

      <!-- 上一篇 / 下一篇 -->
      <div
        v-if="adjacent && (adjacent.prev || adjacent.next)"
        class="mx-auto mt-20 grid max-w-3xl grid-cols-1 gap-px overflow-hidden rounded-xl border border-slate-200/80 sm:grid-cols-2 dark:border-slate-800"
      >
        <NuxtLink
          v-if="adjacent.prev"
          :to="`/blog/${adjacent.prev.slug}`"
          class="group bg-white px-6 py-5 transition-colors hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/60"
        >
          <p class="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
            <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"><path d="M15 19l-7-7 7-7" /></svg>
            上一篇
          </p>
          <p class="mt-1.5 line-clamp-2 text-[13.5px] font-medium leading-snug text-slate-700 transition-colors
                    group-hover:text-slate-950 dark:text-slate-300 dark:group-hover:text-white">
            {{ adjacent.prev.title }}
          </p>
        </NuxtLink>
        <div v-else class="hidden bg-white sm:block dark:bg-slate-900" />

        <NuxtLink
          v-if="adjacent.next"
          :to="`/blog/${adjacent.next.slug}`"
          class="group bg-white px-6 py-5 text-right transition-colors hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/60"
        >
          <p class="flex items-center justify-end gap-1 text-[11px] text-slate-400 dark:text-slate-500">
            下一篇
            <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7" /></svg>
          </p>
          <p class="mt-1.5 line-clamp-2 text-[13.5px] font-medium leading-snug text-slate-700 transition-colors
                    group-hover:text-slate-950 dark:text-slate-300 dark:group-hover:text-white">
            {{ adjacent.next.title }}
          </p>
        </NuxtLink>
        <div v-else class="hidden bg-white sm:block dark:bg-slate-900" />
      </div>

      <!-- 相关文章 -->
      <div v-if="related && related.length" class="mx-auto mt-16 max-w-3xl">
        <p class="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-slate-600">
          相关文章
        </p>
        <ul class="divide-y divide-slate-100 border-t border-slate-200/80 dark:divide-slate-800 dark:border-slate-800">
          <li v-for="item in related" :key="item.id">
            <NuxtLink
              :to="`/blog/${item.slug}`"
              class="group flex items-center gap-4 py-3.5"
            >
              <span class="min-w-0 flex-1 truncate text-[13.5px] text-slate-600 transition-colors
                           group-hover:text-slate-950 dark:text-slate-400 dark:group-hover:text-slate-100">
                {{ item.title }}
              </span>
              <span class="shrink-0 text-[11px] text-slate-400 dark:text-slate-600 tabular-nums">
                {{ relatedDate(item.createdAt) }}
              </span>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 正文排版微调：让富文本内容更接近文档阅读体验 */
:deep(.prose) {
  font-size: 1.0625rem;
  line-height: 1.9;
}
:deep(.prose > * + *) {
  margin-top: 1em;
}
:deep(.prose h2) {
  margin-top: 2.4em;
  margin-bottom: 0.7em;
  scroll-margin-top: 6rem;
}
:deep(.prose h3) {
  margin-top: 2em;
  margin-bottom: 0.6em;
  scroll-margin-top: 6rem;
}
:deep(.prose p) {
  margin-top: 0.9em;
  margin-bottom: 0.9em;
}
:deep(.prose img) {
  border-radius: 0.75rem;
}
:deep(.prose table) {
  font-size: 0.9rem;
}
:deep(.prose th) {
  font-weight: 600;
}
:deep(.prose ul[data-type='taskList']) {
  list-style: none;
  padding-left: 0.25rem;
}
:deep(.prose ul[data-type='taskList'] li) {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
}
:deep(.prose ul[data-type='taskList'] input[type='checkbox']) {
  margin-top: 0.55rem;
  accent-color: #0f172a;
}
:deep(.prose pre) {
  border: 0;
}
:deep(.prose .code-block-wrapper) {
  margin: 1.5rem 0;
}
</style>
