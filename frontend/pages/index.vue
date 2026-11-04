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

const { data: postsData } = await useAsyncData('all-posts', () =>
  postsApi.list({ published: 'true', limit: 1000 }),
)

const allPosts = computed<any[]>(() => (postsData.value as any)?.data ?? [])

// 搜索
const searchQuery = useState('blog-search', () => '')
const filteredPosts = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return allPosts.value
  return allPosts.value.filter(
    (p: any) =>
      p.title?.toLowerCase().includes(q) || p.excerpt?.toLowerCase().includes(q),
  )
})

// 分页
const PAGE_SIZE = 10
const currentPage = ref(1)
watch(searchQuery, () => (currentPage.value = 1))

const totalPages = computed(() => Math.ceil(filteredPosts.value.length / PAGE_SIZE))
const pagedPosts = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredPosts.value.slice(start, start + PAGE_SIZE)
})

function formatDate(date: string) {
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-6 sm:px-8">
    <!-- 页头 -->
    <header class="pb-14 pt-20 sm:pt-24">
      <h1 class="text-[2rem] font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-[2.4rem]">
        {{ config.public.siteName }}
      </h1>
      <p class="mt-4 max-w-xl text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">
        {{ config.public.siteDescription }}
      </p>
      <p class="mt-6 text-[12px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 tabular-nums">
        {{ allPosts.length }} Articles
      </p>
    </header>

    <!-- 搜索 -->
    <div class="relative border-t border-slate-200/80 pt-8 dark:border-slate-800">
      <svg class="pointer-events-none absolute left-0 top-[2.65rem] h-4 w-4 text-slate-300 dark:text-slate-600"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <path d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
      </svg>
      <input
        v-model="searchQuery"
        type="search"
        placeholder="搜索文章"
        class="w-full border-0 bg-transparent py-2 pl-7 pr-8 text-[14px] text-slate-800 outline-none
               placeholder:text-slate-300 dark:text-slate-200 dark:placeholder:text-slate-600"
      />
      <button
        v-if="searchQuery"
        type="button"
        class="absolute right-0 top-[2.65rem] text-slate-300 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
        aria-label="清除搜索"
        @click="searchQuery = ''"
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round"><path d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>

    <!-- 列表 -->
    <div class="mt-2">
      <ul
        v-if="pagedPosts.length"
        class="divide-y divide-slate-100 border-t border-slate-200/80 dark:divide-slate-800/80 dark:border-slate-800"
      >
        <li v-for="post in pagedPosts" :key="post.id">
          <NuxtLink
            :to="`/blog/${post.slug}`"
            class="group grid gap-2 py-8 sm:grid-cols-[7.5rem_1fr] sm:gap-6"
          >
            <!-- 日期 -->
            <div class="flex items-start pt-1 text-[12px] font-medium tracking-wide text-slate-400 dark:text-slate-500 tabular-nums">
              {{ formatDate(post.publishedAt || post.createdAt) }}
            </div>

            <!-- 内容 -->
            <div class="min-w-0">
              <h2
                class="text-[1.05rem] font-medium leading-snug text-slate-800 transition-colors
                       group-hover:text-slate-950 dark:text-slate-200 dark:group-hover:text-white"
              >
                {{ post.title }}
              </h2>
              <p
                v-if="post.excerpt"
                class="mt-2 line-clamp-2 text-[13.5px] leading-relaxed text-slate-500 dark:text-slate-400"
              >
                {{ post.excerpt }}
              </p>
              <div class="mt-3 flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                <span>{{ post.readingTime ?? 1 }} 分钟阅读</span>
                <span class="text-slate-300 transition-all group-hover:translate-x-0.5 dark:text-slate-700">→</span>
              </div>
            </div>
          </NuxtLink>
        </li>
      </ul>

      <!-- 空状态 -->
      <div
        v-else
        class="flex flex-col items-center justify-center border-t border-slate-200/80 py-28 text-center dark:border-slate-800"
      >
        <svg class="mb-5 h-9 w-9 text-slate-200 dark:text-slate-700" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1zM8 9h8M8 13h5" />
        </svg>
        <p class="text-sm font-medium text-slate-400 dark:text-slate-500">
          {{ searchQuery ? '没有找到匹配的文章' : '还没有文章' }}
        </p>
        <p class="mt-1.5 text-[13px] text-slate-400 dark:text-slate-600">
          {{ searchQuery ? '换个关键词试试' : '第一篇文章正在路上' }}
        </p>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="totalPages > 1" class="flex items-center justify-center gap-2 py-14">
      <button
        class="page-btn"
        :disabled="currentPage === 1"
        @click="currentPage--"
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"><path d="M15 19l-7-7 7-7" /></svg>
      </button>
      <span class="px-2 text-[12px] text-slate-400 tabular-nums">{{ currentPage }} / {{ totalPages }}</span>
      <button
        class="page-btn"
        :disabled="currentPage === totalPages"
        @click="currentPage++"
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.page-btn {
  @apply flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500
         transition-colors hover:border-slate-300 hover:text-slate-900
         disabled:cursor-not-allowed disabled:opacity-35
         dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200;
}
</style>
