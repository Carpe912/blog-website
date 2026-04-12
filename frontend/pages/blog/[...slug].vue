<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route = useRoute()
const config = useRuntimeConfig()
const postsApi = usePostsApi()
const { render: renderMarkdown } = useMarked()

const slug = computed(() =>
  Array.isArray(route.params.slug) ? route.params.slug.join('/') : route.params.slug
)

const { data: post } = await useAsyncData(
  `post-${slug.value}`,
  () => postsApi.getBySlug(slug.value)
)

if (!post.value) {
  throw createError({ statusCode: 404, statusMessage: '文章不存在' })
}

// 上一篇 / 下一篇
const { data: adjacent } = await useAsyncData(
  `adjacent-${slug.value}`,
  () => postsApi.getAdjacentBySlug(slug.value)
)

// 相关文章
const { data: related } = await useAsyncData(
  `related-${slug.value}`,
  () => postsApi.getRelatedBySlug(slug.value)
)

// SEO
useSeoMeta({
  title: `${post.value.title} · ${config.public.siteName}`,
  description: post.value.excerpt ?? post.value.title,
  ogTitle: post.value.title,
  ogDescription: post.value.excerpt ?? '',
})

// 渲染 markdown（使用 useMarked，内含 hljs 高亮 + heading id）
const renderedContent = computed(() => {
  if (!post.value?.content) return ''
  return renderMarkdown(post.value.content)
})

const formattedDate = computed(() => {
  if (!post.value?.createdAt) return ''
  return new Date(post.value.createdAt).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})

const readingTime = computed(() => {
  const text = post.value?.content ?? ''
  return Math.max(2, Math.round(text.length / 400))
})

// ── TOC ────────────────────────────────────────────────────────────────────
const articleRef = ref<HTMLElement | null>(null)
const { headings, activeId } = useToc(renderedContent, articleRef)

// ── 代码块复制按钮 ──────────────────────────────────────────────────────────
useCodeCopy(articleRef)

function relatedDate(date: string) {
  return new Date(date).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}
</script>

<template>
  <div v-if="post">
    <!-- 文章头部 -->
    <div class="border-b border-slate-200 bg-slate-50/90 dark:border-slate-800 dark:bg-slate-950">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <!-- 返回首页 -->
        <NuxtLink to="/" class="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors mb-5">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          返回首页
        </NuxtLink>

        <!-- 标签 -->
        <div v-if="post.tags && post.tags.length" class="flex flex-wrap gap-1.5 mb-3">
          <NuxtLink
            v-for="tag in post.tags"
            :key="tag.id"
            :to="`/tags/${encodeURIComponent(tag.name)}`"
            class="inline-flex items-center rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-600"
          >
            {{ tag.name }}
          </NuxtLink>
        </div>

        <!-- 标题 -->
        <h1 class="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 leading-snug mb-4">
          {{ post.title }}
        </h1>

        <!-- 元信息 -->
        <div class="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          <time :datetime="post.createdAt">{{ formattedDate }}</time>
          <span>约 {{ readingTime }} 分钟读完</span>
        </div>
      </div>
    </div>

    <!-- 正文 + TOC 双栏布局 -->
    <div class="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-20">
      <div class="flex gap-10 items-start">

        <!-- 左：正文 -->
        <div class="flex-1 min-w-0">
          <article
            ref="articleRef"
            class="prose prose-gray max-w-none dark:prose-invert prose-headings:scroll-mt-24 prose-img:rounded-xl prose-a:text-primary-600 dark:prose-a:text-primary-400"
            v-html="renderedContent"
          />

          <!-- 底部标签 -->
          <div v-if="post.tags && post.tags.length" class="mt-12 pt-8 border-t border-gray-100 dark:border-slate-800">
            <p class="text-sm text-gray-500 dark:text-slate-400 mb-3 font-medium">相关标签</p>
            <div class="flex flex-wrap gap-2">
              <NuxtLink
                v-for="tag in post.tags"
                :key="tag.id"
                :to="`/tags/${encodeURIComponent(tag.name)}`"
                class="tag-pill-lg"
              >
                {{ tag.name }}
              </NuxtLink>
            </div>
          </div>

          <!-- 相关文章推荐 -->
          <div v-if="related && related.length" class="mt-12 pt-8 border-t border-gray-100 dark:border-slate-800">
            <p class="text-sm text-gray-500 dark:text-slate-400 mb-4 font-medium">相关文章</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <NuxtLink
                v-for="item in related"
                :key="item.id"
                :to="`/blog/${item.slug}`"
                class="group flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3.5 hover:border-slate-300 hover:shadow-sm transition-all dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
              >
                <span class="text-sm font-medium text-slate-700 group-hover:text-slate-900 dark:text-slate-300 dark:group-hover:text-slate-100 line-clamp-2 transition-colors leading-snug">
                  {{ item.title }}
                </span>
                <div class="flex items-center gap-2 flex-wrap">
                  <span
                    v-for="tag in (item.tags || []).slice(0, 3)"
                    :key="tag.id"
                    class="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                  >{{ tag.name }}</span>
                  <span class="ml-auto text-[10px] text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
                    {{ relatedDate(item.createdAt) }}
                  </span>
                </div>
              </NuxtLink>
            </div>
          </div>

          <!-- 上一篇 / 下一篇 -->
          <div
            v-if="adjacent && (adjacent.prev || adjacent.next)"
            class="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            <NuxtLink
              v-if="adjacent.prev"
              :to="`/blog/${adjacent.prev.slug}`"
              class="group flex flex-col gap-1 rounded-xl border border-slate-200 bg-white px-5 py-4 hover:border-slate-300 hover:shadow-sm transition-all dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
            >
              <span class="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
                上一篇
              </span>
              <span class="text-sm font-medium text-slate-700 group-hover:text-slate-900 dark:text-slate-300 dark:group-hover:text-slate-100 line-clamp-2 transition-colors">
                {{ adjacent.prev.title }}
              </span>
            </NuxtLink>
            <div v-else />

            <NuxtLink
              v-if="adjacent.next"
              :to="`/blog/${adjacent.next.slug}`"
              class="group flex flex-col gap-1 rounded-xl border border-slate-200 bg-white px-5 py-4 hover:border-slate-300 hover:shadow-sm transition-all text-right dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
            >
              <span class="inline-flex items-center justify-end gap-1 text-xs text-slate-400 dark:text-slate-500">
                下一篇
                <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </span>
              <span class="text-sm font-medium text-slate-700 group-hover:text-slate-900 dark:text-slate-300 dark:group-hover:text-slate-100 line-clamp-2 transition-colors">
                {{ adjacent.next.title }}
              </span>
            </NuxtLink>
            <div v-else />
          </div>
        </div>

        <!-- 右：TOC 浮动目录（仅桌面端，有标题时才显示） -->
        <aside
          v-if="headings.length >= 2"
          class="hidden xl:block w-52 shrink-0 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto"
        >
          <p class="text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">目录</p>
          <nav>
            <a
              v-for="h in headings"
              :key="h.id"
              :href="`#${h.id}`"
              class="toc-link"
              :class="[h.level === 3 ? 'toc-h3' : '', activeId === h.id ? 'active' : '']"
            >
              {{ h.text }}
            </a>
          </nav>
        </aside>

      </div>
    </div>
  </div>
</template>
