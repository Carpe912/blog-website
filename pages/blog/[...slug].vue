<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route = useRoute()
const config = useRuntimeConfig()

// 将路由参数拼成内容路径：/blog/nuxt3-quick-start → 查询 /posts/nuxt3-quick-start
const slug = computed(() =>
  Array.isArray(route.params.slug) ? route.params.slug.join('/') : route.params.slug
)
const contentPath = computed(() => `/posts/${slug.value}`)

const { data: post } = await useAsyncData(
  `post-${slug.value}`,
  () => queryContent(contentPath.value).findOne()
)

// 404 处理
if (!post.value) {
  throw createError({ statusCode: 404, statusMessage: '文章不存在' })
}

// SEO
useSeoMeta({
  title: `${post.value.title} · ${config.public.siteName}`,
  description: post.value.excerpt ?? post.value.title,
  ogTitle: post.value.title,
  ogDescription: post.value.excerpt ?? '',
  ogImage: post.value.cover || undefined,
})

// 格式化日期
const formattedDate = computed(() => {
  if (!post.value?.date) return ''
  return new Date(post.value.date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})

// 估算阅读时间
const readingTime = computed(() => {
  const text = post.value?.body?.children
    ?.map((n: any) => JSON.stringify(n))
    .join(' ') ?? ''
  return Math.max(2, Math.round(text.length / 400))
})

// ToC：从 body.toc.links 读取
interface TocLink {
  id: string
  text: string
  depth: number
  children?: TocLink[]
}
const tocLinks = computed<TocLink[]>(() => post.value?.body?.toc?.links ?? [])
const hasToc = computed(() => tocLinks.value.length > 0)

// 当前激活的标题（滚动监听）
const activeId = ref('')

onMounted(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          activeId.value = entry.target.id
          break
        }
      }
    },
    { rootMargin: '-64px 0px -60% 0px', threshold: 0 }
  )
  document.querySelectorAll('h2[id], h3[id]').forEach(el => observer.observe(el))
  onUnmounted(() => observer.disconnect())
})

// 上一篇 / 下一篇
const { data: siblings } = await useAsyncData(
  `siblings-${slug.value}`,
  async () => {
    const all = await queryContent('/posts').sort({ date: -1 }).only(['_path', 'title', 'date']).find()
    const idx = all.findIndex((p: any) => p._path === contentPath.value)
    return {
      prev: idx < all.length - 1 ? all[idx + 1] : null,
      next: idx > 0 ? all[idx - 1] : null,
    }
  }
)

function postUrl(path: string) {
  return `/blog/${path.replace(/^\/posts\//, '')}`
}
</script>

<template>
  <div v-if="post">
    <!-- 封面 -->
    <div v-if="post.cover" class="w-full h-64 sm:h-80 overflow-hidden">
      <img :src="post.cover" :alt="post.title" class="w-full h-full object-cover" />
    </div>

    <!-- 文章头部：标题 + 元信息 -->
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
        <div v-if="post.tags?.length" class="flex flex-wrap gap-1.5 mb-3">
          <NuxtLink
            v-for="tag in post.tags"
            :key="tag"
            :to="`/tags/${encodeURIComponent(tag)}`"
            class="inline-flex items-center rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-600"
          >
            {{ tag }}
          </NuxtLink>
        </div>

        <!-- 标题 -->
        <h1 class="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 leading-snug mb-4">
          {{ post.title }}
        </h1>

        <!-- 元信息栏 -->
        <div class="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          <time :datetime="post.date">{{ formattedDate }}</time>
          <span>约 {{ readingTime }} 分钟读完</span>
        </div>
      </div>
    </div>

    <!-- 主内容区：文章 + ToC -->
    <div class="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div class="flex gap-10 items-start">

        <!-- 文章正文 -->
        <article class="min-w-0 flex-1">
          <ContentRenderer
            :value="post"
            class="prose prose-gray max-w-none dark:prose-invert prose-headings:scroll-mt-20 prose-img:rounded-xl prose-a:text-primary-600 dark:prose-a:text-primary-400"
          />

          <!-- 文章底部标签 -->
          <div v-if="post.tags?.length" class="mt-12 pt-8 border-t border-gray-100 dark:border-slate-800">
            <p class="text-sm text-gray-500 dark:text-slate-400 mb-3 font-medium">相关标签</p>
            <div class="flex flex-wrap gap-2">
              <NuxtLink
                v-for="tag in post.tags"
                :key="tag"
                :to="`/tags/${encodeURIComponent(tag)}`"
                class="tag-pill-lg"
              >
                {{ tag }}
              </NuxtLink>
            </div>
          </div>

          <!-- 上一篇 / 下一篇 -->
          <nav v-if="siblings?.prev || siblings?.next" class="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NuxtLink
              v-if="siblings?.prev"
              :to="postUrl(siblings.prev._path)"
              class="group flex flex-col p-4 rounded-xl border border-gray-100 hover:border-primary-200 hover:bg-primary-50 dark:border-slate-800 dark:hover:border-primary-800 dark:hover:bg-primary-950/40 transition-all"
            >
              <span class="text-xs text-gray-400 dark:text-slate-500 mb-1 flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
                上一篇
              </span>
              <span class="text-sm font-medium text-gray-800 dark:text-slate-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 line-clamp-2 transition-colors">
                {{ siblings.prev.title }}
              </span>
            </NuxtLink>
            <div v-else />

            <NuxtLink
              v-if="siblings?.next"
              :to="postUrl(siblings.next._path)"
              class="group flex flex-col items-end p-4 rounded-xl border border-gray-100 hover:border-primary-200 hover:bg-primary-50 dark:border-slate-800 dark:hover:border-primary-800 dark:hover:bg-primary-950/40 transition-all text-right"
            >
              <span class="text-xs text-gray-400 dark:text-slate-500 mb-1 flex items-center gap-1">
                下一篇
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </span>
              <span class="text-sm font-medium text-gray-800 dark:text-slate-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 line-clamp-2 transition-colors">
                {{ siblings.next.title }}
              </span>
            </NuxtLink>
          </nav>
        </article>

        <!-- 右侧目录 ToC（桌面端显示） -->
        <aside v-if="hasToc" class="hidden lg:block w-60 xl:w-72 shrink-0 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
          <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 dark:bg-slate-900 dark:border-slate-800">
            <p class="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 6h16M4 10h16M4 14h10" />
              </svg>
              目录
            </p>
            <nav class="space-y-0.5">
              <template v-for="link in tocLinks" :key="link.id">
                <a
                  :href="`#${link.id}`"
                  class="toc-link"
                  :class="{ active: activeId === link.id }"
                >
                  {{ link.text }}
                </a>
                <template v-if="link.children?.length">
                  <a
                    v-for="child in link.children"
                    :key="child.id"
                    :href="`#${child.id}`"
                    class="toc-link toc-h3"
                    :class="{ active: activeId === child.id }"
                  >
                    {{ child.text }}
                  </a>
                </template>
              </template>
            </nav>
          </div>
        </aside>

      </div>
    </div>
  </div>
</template>
