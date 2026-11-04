<template>
  <div>
    <!-- 页头 -->
    <div class="flex items-end justify-between gap-6 pb-6">
      <div>
        <h1 class="text-[1.35rem] font-semibold tracking-tight text-slate-900 dark:text-ink-50">
          文章
        </h1>
        <p class="mt-1 text-[13px] text-slate-400 dark:text-ink-400">
          共 {{ meta.total }} 篇 · {{ publishedCount }} 篇已发布
        </p>
      </div>

      <NuxtLink to="/admin/posts/new" class="btn-solid">
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
          stroke-linecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        新建文章
      </NuxtLink>
    </div>

    <!-- 筛选 -->
    <div class="flex flex-wrap items-center gap-3 border-y border-slate-200/80 py-3 dark:border-ink-700">
      <div class="relative">
        <svg class="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
        <input
          v-model="search"
          type="search"
          placeholder="搜索标题或正文"
          class="h-8 w-64 rounded-md border border-slate-200 bg-white pl-8 pr-3 text-[13px]
                 text-slate-700 outline-none transition placeholder:text-slate-400
                 focus:border-slate-400 focus:ring-2 focus:ring-slate-100
                 dark:border-ink-600 dark:bg-ink-850 dark:text-ink-100 dark:focus:border-ink-400 dark:focus:ring-ink-700"
          @input="debouncedLoad"
        />
      </div>

      <div class="flex items-center gap-1">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          type="button"
          class="rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors"
          :class="publishedFilter === tab.value
            ? 'bg-slate-900 text-white dark:bg-white dark:text-ink-850'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-ink-300 dark:hover:bg-ink-700 dark:hover:text-ink-100'"
          @click="publishedFilter = tab.value; page = 1; loadPosts()"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- 列表 -->
    <div class="mt-1">
      <div
        v-if="loading"
        class="divide-y divide-slate-100 dark:divide-ink-700"
      >
        <div v-for="i in 4" :key="i" class="flex animate-pulse items-center gap-4 py-5">
          <div class="h-4 w-1/2 rounded bg-slate-100 dark:bg-ink-700" />
          <div class="ml-auto h-3 w-20 rounded bg-slate-100 dark:bg-ink-700" />
        </div>
      </div>

      <div
        v-else-if="!posts.length"
        class="flex flex-col items-center justify-center py-24 text-center"
      >
        <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 dark:bg-ink-700">
          <svg class="h-5 w-5 text-slate-300 dark:text-ink-500" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1zM8 9h8M8 13h5" />
          </svg>
        </div>
        <p class="text-sm font-medium text-slate-500 dark:text-ink-300">
          {{ search || publishedFilter ? '没有匹配的文章' : '还没有文章' }}
        </p>
        <p class="mt-1 text-[13px] text-slate-400 dark:text-ink-400">
          {{ search || publishedFilter ? '换个关键词或筛选条件试试' : '写下第一篇，从这里开始' }}
        </p>
        <NuxtLink v-if="!search && !publishedFilter" to="/admin/posts/new" class="btn-ghost mt-5">
          新建文章 →
        </NuxtLink>
      </div>

      <ul v-else class="divide-y divide-slate-100 dark:divide-ink-700">
        <li
          v-for="post in posts"
          :key="post.id"
          class="group relative flex items-start gap-4 py-5 transition-colors"
        >
          <div class="min-w-0 flex-1">
            <NuxtLink :to="`/admin/posts/${post.id}`" class="block">
              <h2 class="truncate text-[15px] font-medium leading-snug text-slate-800 transition-colors
                         group-hover:text-slate-950 dark:text-ink-100 dark:group-hover:text-ink-50">
                {{ post.title }}
              </h2>
              <p v-if="post.excerpt" class="mt-1 line-clamp-1 text-[13px] leading-relaxed text-slate-400 dark:text-ink-400">
                {{ post.excerpt }}
              </p>
            </NuxtLink>

            <div class="mt-2 flex items-center gap-2.5 text-[11px] text-slate-400 dark:text-ink-400 tabular-nums">
              <span
                class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
                :class="post.published
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                  : 'bg-slate-100 text-slate-500 dark:bg-ink-700 dark:text-ink-300'"
              >
                {{ post.published ? '已发布' : '草稿' }}
              </span>
              <span>{{ formatDate(post.createdAt) }}</span>
              <span class="text-slate-300 dark:text-ink-600">·</span>
              <span>{{ post.readingTime ?? 1 }} 分钟</span>
            </div>
          </div>

          <!-- 行内操作（悬停显示） -->
          <div class="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <NuxtLink
              :to="`/blog/${post.slug}`"
              target="_blank"
              class="action-btn"
              title="预览"
            >
              <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </NuxtLink>
            <NuxtLink :to="`/admin/posts/${post.id}`" class="action-btn" title="编辑">
              <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
              </svg>
            </NuxtLink>
            <button type="button" class="action-btn hover:!text-red-600" title="删除" @click="deletePost(post)">
              <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a1 1 0 01-1 1H7a1 1 0 01-1-1L5 6" />
              </svg>
            </button>
          </div>
        </li>
      </ul>
    </div>

    <!-- 分页 -->
    <div v-if="meta.totalPages > 1" class="mt-8 flex items-center justify-center gap-1.5">
      <button class="page-btn" :disabled="page === 1" @click="page--; loadPosts()">
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"><path d="M15 19l-7-7 7-7" /></svg>
      </button>
      <span class="px-2 text-xs text-slate-400 tabular-nums">{{ page }} / {{ meta.totalPages }}</span>
      <button class="page-btn" :disabled="page === meta.totalPages" @click="page++; loadPosts()">
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const postsApi = usePostsApi()
const posts = ref<any[]>([])
const meta = ref({ total: 0, page: 1, limit: 10, totalPages: 1 })
const loading = ref(true)
const search = ref('')
const publishedFilter = ref('')
const page = ref(1)
const publishedCount = ref(0)

const tabs = [
  { label: '全部', value: '' },
  { label: '已发布', value: 'true' },
  { label: '草稿', value: 'false' },
]

let debounceTimer: ReturnType<typeof setTimeout>

async function loadPosts() {
  loading.value = true
  try {
    const params: any = { page: page.value, limit: 10 }
    if (search.value) params.search = search.value
    if (publishedFilter.value !== '') params.published = publishedFilter.value
    const res = await postsApi.list(params)
    posts.value = res.data
    meta.value = res.meta
  } finally {
    loading.value = false
  }
}

async function loadPublishedCount() {
  const res = await postsApi.list({ published: 'true', limit: 1 })
  publishedCount.value = res.meta?.total ?? 0
}

function debouncedLoad() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    page.value = 1
    loadPosts()
  }, 350)
}

async function deletePost(post: any) {
  if (!confirm(`确认删除「${post.title}」？`)) return
  await postsApi.remove(post.id)
  await Promise.all([loadPosts(), loadPublishedCount()])
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

await Promise.all([loadPosts(), loadPublishedCount()])
</script>

<style scoped>
.btn-solid {
  @apply inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-[13px] font-medium
         text-white transition-all hover:bg-slate-800 active:scale-[0.98]
         dark:bg-white dark:text-ink-850 dark:hover:bg-ink-100;
}
.btn-ghost {
  @apply inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-[13px]
         font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50
         dark:border-ink-600 dark:text-ink-200 dark:hover:bg-ink-700;
}
.action-btn {
  @apply flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors
         hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-ink-700 dark:hover:text-ink-100;
}
.page-btn {
  @apply flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500
         transition-colors hover:border-slate-300 hover:text-slate-900
         disabled:cursor-not-allowed disabled:opacity-35
         dark:border-ink-600 dark:text-ink-300 dark:hover:border-ink-500 dark:hover:text-ink-100;
}
</style>
