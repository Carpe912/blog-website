<script setup lang="ts">
import { marked } from 'marked'
definePageMeta({ layout: 'default' })

const route = useRoute()
const config = useRuntimeConfig()
const postsApi = usePostsApi()

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

const { data: adjacent } = await useAsyncData(
  `adjacent-${slug.value}`,
  () => postsApi.getAdjacentBySlug(slug.value)
)

// SEO
useSeoMeta({
  title: `${post.value.title} · ${config.public.siteName}`,
  description: post.value.excerpt ?? post.value.title,
  ogTitle: post.value.title,
  ogDescription: post.value.excerpt ?? '',
})

// 渲染 markdown
const renderedContent = computed(() => {
  if (!post.value?.content) return ''
  return marked(post.value.content) as string
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

    <!-- 正文 -->
    <div class="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <article
        class="prose prose-gray max-w-none dark:prose-invert prose-headings:scroll-mt-20 prose-img:rounded-xl prose-a:text-primary-600 dark:prose-a:text-primary-400"
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

      <!-- 上一篇 / 下一篇 -->
      <div
        v-if="adjacent && (adjacent.prev || adjacent.next)"
        class="mt-12 pt-8 border-t border-gray-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        <!-- 上一篇（时间更早） -->
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
        <!-- 占位，保持 grid 对齐 -->
        <div v-else />

        <!-- 下一篇（时间更新） -->
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
        <!-- 占位，保持 grid 对齐 -->
        <div v-else />
      </div>
    </div>
  </div>
</template>
