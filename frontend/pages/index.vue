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

// ── 标签筛选（多选，空选 = 全部）─────────────────────────────────────────
// 标签随文章接口一起返回，直接按全量列表聚合，无需额外请求
const activeTags = useState<string[]>('blog-tags', () => [])

const allTags = computed(() => {
  const map = new Map<string, number>()
  for (const post of allPosts.value) {
    for (const tag of post.tags ?? []) {
      map.set(tag.name, (map.get(tag.name) ?? 0) + 1)
    }
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    // 按使用次数倒序；同频时按字符串码点排序。
    // 不能用 localeCompare：Node 与浏览器的中文排序规则不同，会导致 SSR 与客户端渲染顺序不一致
    .sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
})

const filteredPosts = computed<any[]>(() => {
  // 搜索结果不带 tags，按 id 从全量列表补齐，保证标签筛选对搜索结果同样生效
  const tagsById = new Map(allPosts.value.map((p: any) => [p.id, p.tags ?? []]))
  const source = (Array.isArray(searchResults.value) ? searchResults.value : allPosts.value).map(
    (p: any) => ({ ...p, tags: p.tags?.length ? p.tags : tagsById.get(p.id) ?? [] }),
  )
  // 多选按「任一命中」取并集；一个都没选时不过滤，等同于全部
  if (activeTags.value.length === 0) return source
  return source.filter((p: any) =>
    p.tags.some((t: any) => activeTags.value.includes(t.name)),
  )
})

function toggleTag(name: string) {
  activeTags.value = activeTags.value.includes(name)
    ? activeTags.value.filter((n) => n !== name)
    : [...activeTags.value, name]
}

function removeTag(name: string) {
  activeTags.value = activeTags.value.filter((n) => n !== name)
}

const statusText = computed(() => {
  if (searching.value) return '搜索中…'
  if (searchQuery.value.trim()) return `${filteredPosts.value.length} 篇匹配`
  if (activeTags.value.length) return `${filteredPosts.value.length} 篇`
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
  <!-- 左侧标签栏常驻，正文给它让出一栏宽度 -->
  <div class="xl:pl-60">
    <div class="reader-column pb-20 pt-8 sm:pt-12">
      <h1 class="sr-only">文章</h1>

      <section aria-label="文章列表">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--reader-line)] pb-4">
          <div role="status" class="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm tabular-nums text-[var(--reader-muted)]">
            <template v-if="error">文章列表</template>
            <template v-else>
              <button
                v-for="name in activeTags"
                :key="name"
                type="button"
                class="tag-text inline-flex items-center gap-1 rounded-sm border border-[var(--reader-line)] bg-[var(--reader-surface)] px-2 py-0.5 text-[13px] leading-5 text-[var(--reader-ink)] transition-colors hover:border-[var(--reader-accent)] hover:text-[var(--reader-accent)]"
                :title="`取消筛选 #${name}`"
                @click="removeTag(name)"
              >
                #{{ name }}
                <span aria-hidden="true" class="text-sm leading-none opacity-60">×</span>
                <span class="sr-only">取消筛选</span>
              </button>
              <span>{{ statusText }}</span>
            </template>
          </div>
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

        <!-- 移动端：标签收进折叠面板，避免标签墙压住列表 -->
        <details v-if="allTags.length" class="tag-text mt-4 rounded-md border border-[var(--reader-line)] xl:hidden">
          <summary class="cursor-pointer px-4 py-3 text-[15px] font-medium text-[var(--reader-muted)]">
            标签{{ activeTags.length ? ` · 已选 ${activeTags.length} 个` : '' }}
            <span class="ml-1 text-[11px] tabular-nums opacity-60">{{ allTags.length }}</span>
          </summary>
          <div class="flex max-h-72 flex-wrap items-baseline gap-x-4 gap-y-1.5 overflow-y-auto border-t border-[var(--reader-line)] px-4 py-3 text-[13px]">
            <button
              type="button"
              class="py-0.5 transition-colors"
              :class="activeTags.length === 0
                ? 'font-medium text-[var(--reader-ink)] underline decoration-[var(--reader-accent)] underline-offset-4'
                : 'text-[var(--reader-muted)] hover:text-[var(--reader-ink)]'"
              :aria-pressed="activeTags.length === 0"
              @click="activeTags = []"
            >
              全部
            </button>
            <button
              v-for="tag in allTags"
              :key="tag.name"
              type="button"
              class="py-0.5 transition-colors"
              :class="activeTags.includes(tag.name)
                ? 'font-medium text-[var(--reader-ink)] underline decoration-[var(--reader-accent)] underline-offset-4'
                : 'text-[var(--reader-muted)] hover:text-[var(--reader-ink)]'"
              :aria-pressed="activeTags.includes(tag.name)"
              @click="toggleTag(tag.name)"
            >
              #{{ tag.name }}<span class="ml-1 text-[11px] tabular-nums opacity-60">{{ tag.count }}</span>
            </button>
          </div>
        </details>

        <ul v-if="filteredPosts.length" class="divide-y divide-[var(--reader-line)] border-b border-[var(--reader-line)]">
          <li v-for="post in filteredPosts" :key="post.id" class="group relative py-6 sm:py-8">
            <div class="grid grid-cols-[minmax(0,1fr)_1.25rem] items-start gap-x-4 gap-y-2 sm:grid-cols-[6rem_minmax(0,1fr)_1.25rem] sm:gap-x-6">
              <time
                :datetime="post.createdAt"
                class="col-span-2 pt-0.5 text-[13px] tabular-nums text-[var(--reader-muted)] sm:col-span-1 sm:pt-1.5"
              >
                {{ formatDate(post.createdAt) }}
              </time>
              <div class="min-w-0">
                <h2 class="reader-display text-xl font-bold leading-snug sm:text-2xl">
                  <!-- 链接用伪元素铺满整行：标题、摘要点哪都能进文章 -->
                  <NuxtLink
                    :to="`/blog/${post.slug}`"
                    class="transition-colors group-hover:text-[var(--reader-accent)] after:absolute after:inset-0 after:content-['']"
                  >
                    {{ post.title }}
                  </NuxtLink>
                </h2>

                <!-- 标签紧跟标题，z-10 保证能盖住上面的整行链接 -->
                <div
                  v-if="post.tags?.length"
                  class="tag-text relative z-10 mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12px] leading-5"
                  aria-label="文章标签"
                >
                  <button
                    v-for="tag in post.tags"
                    :key="tag.id"
                    type="button"
                    class="transition-colors"
                    :class="activeTags.includes(tag.name)
                      ? 'text-[var(--reader-accent)]'
                      : 'text-[var(--reader-muted)] hover:text-[var(--reader-accent)]'"
                    :aria-pressed="activeTags.includes(tag.name)"
                    @click="toggleTag(tag.name)"
                  >
                    #{{ tag.name }}
                  </button>
                </div>

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
            </div>
          </li>
        </ul>

        <p v-else class="border-b border-[var(--reader-line)] py-16 text-center text-sm text-[var(--reader-muted)]">
          {{ error ? '文章暂时无法加载' : searchQuery.trim() ? '没有找到匹配的文章' : activeTags.length ? '所选标签下暂无文章' : '暂无文章' }}
        </p>
      </section>
    </div>

    <!-- 桌面端：左侧标签栏常驻，不折叠 -->
    <aside
      v-if="allTags.length"
      aria-label="标签筛选"
      class="tag-text fixed bottom-6 left-0 top-12 z-30 hidden w-60 overflow-y-auto border-r border-[var(--reader-line)] bg-[var(--reader-paper)] px-5 py-2 xl:block"
    >
      <p class="mb-3 text-[15px] font-semibold text-[var(--reader-ink)]">标签</p>
      <nav aria-label="按标签筛选文章" class="grid gap-0.5">
        <button
          type="button"
          class="flex items-baseline justify-between gap-2 border-l-2 py-[5px] pl-3 pr-2 text-left text-sm transition-colors"
          :class="activeTags.length === 0
            ? 'border-[var(--reader-accent)] bg-[var(--reader-surface)] font-medium text-[var(--reader-accent)]'
            : 'border-transparent text-[var(--reader-muted)] hover:border-[var(--reader-line)] hover:text-[var(--reader-ink)]'"
          :aria-pressed="activeTags.length === 0"
          @click="activeTags = []"
        >
          <span>全部</span>
          <span class="shrink-0 text-[11px] tabular-nums opacity-60">{{ allPosts.length }}</span>
        </button>
        <button
          v-for="tag in allTags"
          :key="tag.name"
          type="button"
          class="flex items-baseline justify-between gap-2 border-l-2 py-[5px] pl-3 pr-2 text-left text-sm transition-colors"
          :class="activeTags.includes(tag.name)
            ? 'border-[var(--reader-accent)] bg-[var(--reader-surface)] font-medium text-[var(--reader-accent)]'
            : 'border-transparent text-[var(--reader-muted)] hover:border-[var(--reader-line)] hover:text-[var(--reader-ink)]'"
          :title="`#${tag.name}`"
          :aria-pressed="activeTags.includes(tag.name)"
          @click="toggleTag(tag.name)"
        >
          <span class="min-w-0 truncate">#{{ tag.name }}</span>
          <span class="shrink-0 text-[11px] tabular-nums opacity-60">{{ tag.count }}</span>
        </button>
      </nav>
    </aside>
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

/* 标签统一用宋体，与站点标题一致 */
.tag-text {
  font-family: var(--reader-display);
}
</style>
