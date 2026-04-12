<script setup lang="ts">
definePageMeta({ layout: 'default' })

const config = useRuntimeConfig()
const postsApi = usePostsApi()

useSeoMeta({
  title: config.public.siteName,
  description: config.public.siteDescription,
  ogTitle: config.public.siteName,
  ogDescription: config.public.siteDescription,
})

// 从后端获取所有已发布文章
const { data: postsData } = await useAsyncData('all-posts', () =>
  postsApi.list({ published: 'true', limit: 1000 })
)

const allPosts = computed(() => (postsData.value as any)?.data ?? [])

// 计算所有标签（去重 + 按频次排序）
const allTags = computed(() => {
  const map = new Map<string, number>()
  for (const post of allPosts.value) {
    for (const tag of post.tags ?? []) {
      map.set(tag.name, (map.get(tag.name) ?? 0) + 1)
    }
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => ({ tag, count }))
})

// 当前激活标签
const activeTag = ref<string | null>(null)

// 搜索关键词
const searchQuery = ref('')

// 过滤后的文章（标签 + 关键词双重过滤）
const filteredPosts = computed(() => {
  let posts = allPosts.value
  if (activeTag.value) {
    posts = posts.filter((p: any) => p.tags?.some((t: any) => t.name === activeTag.value))
  }
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    posts = posts.filter((p: any) =>
      p.title?.toLowerCase().includes(q) ||
      p.excerpt?.toLowerCase().includes(q)
    )
  }
  return posts
})

// 分页
const PAGE_SIZE = 12
const currentPage = ref(1)

watch(activeTag, () => { currentPage.value = 1; searchQuery.value = '' })
watch(searchQuery, () => { currentPage.value = 1 })

const totalPages = computed(() => Math.ceil(filteredPosts.value.length / PAGE_SIZE))

const pagedPosts = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredPosts.value.slice(start, start + PAGE_SIZE)
})

function readingTime(post: { excerpt?: string; content?: string }) {
  const len = (post.content ?? post.excerpt ?? '').length
  return Math.max(1, Math.round(len / 400))
}

function toggleTag(tag: string) {
  activeTag.value = activeTag.value === tag ? null : tag
}

function postUrl(post: any) {
  return `/blog/${post.slug}`
}

function formatPostDate(date: string) {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatPostDateCompact(date: string) {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}
</script>

<template>
  <div>
    <!-- 页眉条：低矮、素色，把版面留给下方列表 -->
    <section class="border-b border-slate-200 bg-slate-50/90 dark:border-slate-800 dark:bg-slate-950">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-7">
        <h1 class="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {{ config.public.siteName }}
        </h1>
        <p class="mt-1.5 text-sm sm:text-[15px] text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
          {{ config.public.siteDescription }}
        </p>
        <p class="mt-3 text-xs text-slate-500 dark:text-slate-500 tabular-nums">
          <span>{{ allPosts ? allPosts.length : 0 }} 篇文章</span>
          <span class="mx-2 text-slate-300 dark:text-slate-600" aria-hidden="true">|</span>
          <span>{{ allTags.length }} 个标签</span>
        </p>
      </div>
    </section>

    <!-- 主体内容 -->
    <div class="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-12 sm:pt-8 sm:pb-16">
      <div class="flex gap-8 items-start">

        <!-- 左：文章列表 -->
        <div class="flex-1 min-w-0">

          <!-- 移动端标签筛选（折叠横排） -->
          <div v-if="allTags.length" class="lg:hidden mb-4">
            <div class="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors"
                :class="!activeTag
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-200 dark:bg-slate-200 dark:text-slate-900'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-transparent dark:text-slate-400 dark:hover:border-slate-500'"
                @click="activeTag = null"
              >
                全部
                <span class="opacity-60 tabular-nums">{{ allPosts ? allPosts.length : 0 }}</span>
              </button>
              <button
                v-for="{ tag, count } in allTags"
                :key="tag"
                type="button"
                class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors"
                :class="activeTag === tag
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-200 dark:bg-slate-200 dark:text-slate-900'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-transparent dark:text-slate-400 dark:hover:border-slate-500'"
                @click="toggleTag(tag)"
              >
                {{ tag }}
                <span class="opacity-60 tabular-nums">{{ count }}</span>
              </button>
            </div>
          </div>

          <!-- 搜索框 -->
          <div class="mb-4 relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              v-model="searchQuery"
              type="search"
              placeholder="搜索文章标题或摘要…"
              class="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 placeholder-slate-400 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 transition dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder-slate-500 dark:focus:border-slate-500 dark:focus:ring-slate-700"
            />
            <button
              v-if="searchQuery"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              @click="searchQuery = ''"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- 筛选状态提示 -->
          <div v-if="activeTag || searchQuery" class="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <template v-if="activeTag">
              <span class="text-slate-400 dark:text-slate-600">标签：</span>
              <span class="font-medium text-slate-800 dark:text-slate-200">{{ activeTag }}</span>
            </template>
            <template v-if="searchQuery">
              <span class="text-slate-400 dark:text-slate-600">{{ activeTag ? '·' : '' }} 关键词：</span>
              <span class="font-medium text-slate-800 dark:text-slate-200">{{ searchQuery }}</span>
            </template>
            <span class="text-slate-500 dark:text-slate-500">· {{ filteredPosts.length }} 篇</span>
            <button type="button" class="ml-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs underline underline-offset-2"
              @click="activeTag = null; searchQuery = ''">清除</button>
          </div>

          <!-- 文章列表 -->
          <TransitionGroup
            v-if="pagedPosts.length"
            name="list"
            tag="div"
            class="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden"
          >
            <NuxtLink
              v-for="post in pagedPosts"
              :key="post.id"
              :to="postUrl(post)"
              class="group flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div class="flex-1 min-w-0">
                <h2 class="text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors leading-snug">
                  {{ post.title }}
                </h2>
                <p v-if="post.excerpt" class="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate">
                  {{ post.excerpt }}
                </p>
                <!-- 标签 + 日期/阅读时长同一行，时间右对齐 -->
                <div class="mt-1.5 flex items-center gap-1.5">
                  <div class="flex flex-wrap gap-1.5 flex-1 min-w-0">
                    <span
                      v-for="tag in post.tags ? post.tags.slice(0, 4) : []"
                      :key="tag.id"
                      class="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] sm:text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400"
                    >
                      {{ tag.name }}
                    </span>
                  </div>
                  <div class="shrink-0 ml-auto flex items-center gap-1 text-[10px] text-slate-300 dark:text-slate-600 tabular-nums">
                    <time :datetime="post.createdAt">{{ formatPostDateCompact(post.createdAt) }}</time>
                    <span aria-hidden="true">·</span>
                    <span>{{ readingTime(post) }} 分钟</span>
                  </div>
                </div>
              </div>

              <svg class="w-4 h-4 sm:w-5 sm:h-5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </NuxtLink>
          </TransitionGroup>

          <!-- 空状态 -->
          <div v-else class="text-center py-24 text-gray-400 dark:text-slate-500">
            <svg class="w-12 h-12 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-lg font-medium">暂无文章</p>
            <p class="text-sm mt-1">在后台管理中创建文章并发布即可显示</p>
          </div>

          <!-- 分页 -->
          <div v-if="totalPages > 1" class="mt-8 flex items-center justify-center gap-2">
            <button
              class="page-btn"
              :disabled="currentPage === 1"
              @click="currentPage--"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              v-for="p in totalPages"
              :key="p"
              class="page-btn"
              :class="p === currentPage ? 'active' : ''"
              @click="currentPage = p"
            >
              {{ p }}
            </button>

            <button
              class="page-btn"
              :disabled="currentPage === totalPages"
              @click="currentPage++"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

        </div>

        <!-- 右：标签侧边栏（桌面端） -->
        <aside v-if="allTags.length" class="hidden lg:block w-44 xl:w-52 shrink-0 sticky top-24">
          <div class="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
            <p class="text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">标签</p>
            <div class="flex flex-wrap gap-1.5">
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors"
                :class="!activeTag
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-200 dark:bg-slate-200 dark:text-slate-900'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-transparent dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-slate-200'"
                @click="activeTag = null"
              >
                全部
                <span class="opacity-60 tabular-nums">{{ allPosts ? allPosts.length : 0 }}</span>
              </button>
              <button
                v-for="{ tag, count } in allTags"
                :key="tag"
                type="button"
                class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors"
                :class="activeTag === tag
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-200 dark:bg-slate-200 dark:text-slate-900'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-transparent dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-slate-200'"
                @click="toggleTag(tag)"
              >
                {{ tag }}
                <span class="opacity-60 tabular-nums">{{ count }}</span>
              </button>
            </div>
          </div>
        </aside>

      </div>
    </div>
  </div>
</template>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-6px);
}
.list-move {
  transition: transform 0.2s ease;
}
</style>
