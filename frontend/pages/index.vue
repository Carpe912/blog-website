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

const { data: postsData, error } = await useAsyncData('all-posts', () =>
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
  <div class="reader-column pb-20">
    <header class="pb-12 pt-14 sm:pb-16 sm:pt-20">
      <div aria-hidden="true" class="mb-5 h-0.5 w-8 bg-[var(--reader-accent)]" />
      <h1 class="reader-display text-5xl font-bold leading-tight sm:text-7xl">文章</h1>
      <p v-if="config.public.siteDescription" class="mt-4 max-w-xl text-base leading-relaxed text-[var(--reader-muted)]">
        {{ config.public.siteDescription }}
      </p>
    </header>

    <section aria-label="文章列表">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--reader-line)] pb-4">
        <p role="status" class="text-sm tabular-nums text-[var(--reader-muted)]">
          {{ error ? '文章列表' : searchQuery.trim() ? `${filteredPosts.length} 篇匹配` : `${allPosts.length} 篇文章` }}
        </p>
        <label class="archive-search flex w-full items-center gap-2 rounded-md border border-[var(--reader-line)] bg-[var(--reader-surface)] px-3 text-[var(--reader-muted)] sm:w-56">
          <svg aria-hidden="true" class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <path d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
          <input
            v-model="searchQuery"
            type="search"
            aria-label="搜索文章"
            placeholder="搜索文章"
            class="min-h-10 min-w-0 flex-1 rounded-sm bg-transparent text-sm text-[var(--reader-ink)] placeholder:text-[var(--reader-muted)]"
          />
        </label>
      </div>

      <ul v-if="pagedPosts.length" class="divide-y divide-[var(--reader-line)] border-b border-[var(--reader-line)]">
        <li v-for="post in pagedPosts" :key="post.id">
          <NuxtLink
            :to="`/blog/${post.slug}`"
            class="group grid grid-cols-[minmax(0,1fr)_1.25rem] items-start gap-x-4 gap-y-2 py-6 sm:grid-cols-[6rem_minmax(0,1fr)_1.25rem] sm:gap-x-6 sm:py-8"
          >
            <time
              :datetime="post.publishedAt || post.createdAt"
              class="col-span-2 pt-0.5 text-[13px] tabular-nums text-[var(--reader-muted)] sm:col-span-1 sm:pt-1.5"
            >
              {{ formatDate(post.publishedAt || post.createdAt) }}
            </time>
            <div class="min-w-0">
              <h2 class="reader-display text-xl font-bold leading-snug group-hover:text-[var(--reader-accent)] sm:text-2xl">
                {{ post.title }}
              </h2>
              <p
                v-if="post.excerpt"
                :title="post.excerpt"
                class="mt-2 line-clamp-2 break-words text-[15px] leading-relaxed text-[var(--reader-muted)]"
              >
                {{ post.excerpt }}
              </p>
              <p class="mt-3 text-xs tabular-nums text-[var(--reader-muted)]">{{ post.readingTime ?? 1 }} 分钟阅读</p>
            </div>
            <span aria-hidden="true" class="pt-1 text-right text-[var(--reader-accent)]">↗</span>
          </NuxtLink>
        </li>
      </ul>

      <p v-else class="border-b border-[var(--reader-line)] py-16 text-center text-sm text-[var(--reader-muted)]">
        {{ error ? '文章暂时无法加载' : searchQuery.trim() ? '没有找到匹配的文章' : '暂无文章' }}
      </p>

      <nav v-if="totalPages > 1" aria-label="文章分页" class="mt-8 flex items-center justify-between gap-4 text-sm">
        <button type="button" class="archive-page-btn" :disabled="currentPage === 1" @click="currentPage--">上一页</button>
        <span class="tabular-nums text-[var(--reader-muted)]">{{ currentPage }} / {{ totalPages }}</span>
        <button type="button" class="archive-page-btn" :disabled="currentPage === totalPages" @click="currentPage++">下一页</button>
      </nav>
    </section>
  </div>
</template>

<style scoped>
.archive-search:focus-within {
  outline: 2px solid var(--reader-accent);
  outline-offset: 2px;
}

.archive-search input:focus {
  outline: none;
}

.archive-page-btn {
  @apply min-h-10 rounded-md border px-3 transition-colors disabled:opacity-50;
  border-color: var(--reader-line);
}

.archive-page-btn:hover:enabled {
  color: var(--reader-accent);
  border-color: var(--reader-accent);
}
</style>
