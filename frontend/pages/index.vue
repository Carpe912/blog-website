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

const allPosts = computed<any[]>(() => {
  const list = ((postsData.value as any)?.data ?? []) as any[]
  // 列表统一按创建时间倒序，避免接口排序变化导致顺序不稳
  return [...list].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
})

// 搜索：走接口的语义搜索，能按「概念」找文章（如搜 cordis 会带出讲 Cordis 的几篇）
const searchQuery = useState('blog-search', () => '')
const searchResults = ref<any[] | null>(null)
const searching = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null

async function runSearch(q: string) {
  searching.value = true
  try {
    searchResults.value = await postsApi.search(q)
  } catch {
    searchResults.value = []
  } finally {
    searching.value = false
  }
}

watch(searchQuery, (raw) => {
  const q = raw.trim()
  if (searchTimer) clearTimeout(searchTimer)
  if (!q) {
    searchResults.value = null
    searching.value = false
    return
  }
  // 输入时防抖，避免每敲一个字就请求一次
  searching.value = true
  searchTimer = setTimeout(() => runSearch(q), 250)
})

// 从文章页返回时搜索词还在，需要补一次请求
onMounted(() => {
  const q = searchQuery.value.trim()
  if (q && !searchResults.value) runSearch(q)
})

// ── 标签筛选 ───────────────────────────────────────────────────────────────
// 标签随文章接口一起返回，直接按全量列表聚合，无需额外请求
const activeTag = useState('blog-tag', () => '')
const tagExpanded = ref(false)

const allTags = computed(() => {
  const map = new Map<string, number>()
  for (const post of allPosts.value) {
    for (const tag of post.tags ?? []) {
      map.set(tag.name, (map.get(tag.name) ?? 0) + 1)
    }
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
})

// 默认只露前 12 个，避免标签墙压住列表；选中的标签即使被折叠也要显示
const visibleTags = computed(() => {
  if (tagExpanded.value) return allTags.value
  const top = allTags.value.slice(0, 12)
  if (activeTag.value && !top.some((t) => t.name === activeTag.value)) {
    const active = allTags.value.find((t) => t.name === activeTag.value)
    if (active) return [...top, active]
  }
  return top
})

const filteredPosts = computed<any[]>(() => {
  // 搜索结果不带 tags，按 id 从全量列表补齐，保证标签筛选对搜索结果同样生效
  const tagsById = new Map(allPosts.value.map((p: any) => [p.id, p.tags ?? []]))
  const source = (Array.isArray(searchResults.value) ? searchResults.value : allPosts.value).map(
    (p: any) => ({ ...p, tags: p.tags?.length ? p.tags : tagsById.get(p.id) ?? [] }),
  )
  if (!activeTag.value) return source
  return source.filter((p: any) => p.tags.some((t: any) => t.name === activeTag.value))
})

function toggleTag(name: string) {
  activeTag.value = activeTag.value === name ? '' : name
}

const statusText = computed(() => {
  if (searchQuery.value.trim()) {
    return searching.value ? '搜索中…' : `${filteredPosts.value.length} 篇匹配`
  }
  if (activeTag.value) return `#${activeTag.value} · ${filteredPosts.value.length} 篇`
  return `${allPosts.value.length} 篇文章`
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
  <div class="reader-column pb-20 pt-8 sm:pt-12">
    <h1 class="sr-only">文章</h1>

    <section aria-label="文章列表">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--reader-line)] pb-4">
        <p role="status" class="text-sm tabular-nums text-[var(--reader-muted)]">
          {{ error ? '文章列表' : statusText }}
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

      <div
        v-if="allTags.length"
        class="flex flex-wrap items-baseline gap-x-4 gap-y-1.5 border-b border-[var(--reader-line)] py-3 text-[13px]"
      >
        <button
          type="button"
          class="py-0.5 transition-colors"
          :class="activeTag
            ? 'text-[var(--reader-muted)] hover:text-[var(--reader-ink)]'
            : 'font-medium text-[var(--reader-ink)] underline decoration-[var(--reader-accent)] underline-offset-4'"
          :aria-pressed="!activeTag"
          @click="activeTag = ''"
        >
          全部
        </button>
        <button
          v-for="tag in visibleTags"
          :key="tag.name"
          type="button"
          class="py-0.5 transition-colors"
          :class="activeTag === tag.name
            ? 'font-medium text-[var(--reader-ink)] underline decoration-[var(--reader-accent)] underline-offset-4'
            : 'text-[var(--reader-muted)] hover:text-[var(--reader-ink)]'"
          :aria-pressed="activeTag === tag.name"
          @click="toggleTag(tag.name)"
        >
          #{{ tag.name }}<span class="ml-1 text-[11px] tabular-nums opacity-60">{{ tag.count }}</span>
        </button>
        <button
          v-if="allTags.length > 12"
          type="button"
          class="py-0.5 text-[var(--reader-accent)] hover:underline"
          @click="tagExpanded = !tagExpanded"
        >
          {{ tagExpanded ? '收起' : `全部 ${allTags.length} 个标签` }}
        </button>
      </div>

      <ul v-if="filteredPosts.length" class="divide-y divide-[var(--reader-line)] border-b border-[var(--reader-line)]">
        <li v-for="post in filteredPosts" :key="post.id">
          <NuxtLink
            :to="`/blog/${post.slug}`"
            class="group grid grid-cols-[minmax(0,1fr)_1.25rem] items-start gap-x-4 gap-y-2 py-6 sm:grid-cols-[6rem_minmax(0,1fr)_1.25rem] sm:gap-x-6 sm:py-8"
          >
            <time
              :datetime="post.createdAt"
              class="col-span-2 pt-0.5 text-[13px] tabular-nums text-[var(--reader-muted)] sm:col-span-1 sm:pt-1.5"
            >
              {{ formatDate(post.createdAt) }}
            </time>
            <div class="min-w-0">
              <h2 class="reader-display text-xl font-bold leading-snug group-hover:text-[var(--reader-accent)] sm:text-2xl">
                {{ post.title }}
              </h2>
              <p
                v-if="post.excerpt"
                :title="post.excerpt"
                class="reader-display mt-2 line-clamp-2 break-words text-[15px] leading-relaxed text-[var(--reader-muted)]"
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
        {{ error ? '文章暂时无法加载' : searchQuery.trim() ? '没有找到匹配的文章' : activeTag ? '该标签下暂无文章' : '暂无文章' }}
      </p>
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
</style>
