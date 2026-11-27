<script setup lang="ts">
import { indexArticleGroups, type ArchivePost, type ArticleGroup, type ArticlePosition } from '~/utils/articleSeries'

definePageMeta({ layout: 'default' })

const config = useRuntimeConfig()
const postsApi = usePostsApi()

const groupingOptions = [
  { value: 'article', label: '逐篇显示' },
  { value: 'topic', label: '按专题分组' },
  { value: 'series', label: '按系列分组' },
] as const
type GroupingMode = typeof groupingOptions[number]['value']
const groupingPreference = useCookie<GroupingMode>('blog-archive-grouping', {
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
})
const grouping = computed<GroupingMode>({
  get: () => groupingPreference.value === 'topic' || groupingPreference.value === 'series'
    ? groupingPreference.value
    : 'article',
  set: value => { groupingPreference.value = value },
})

useSeoMeta({
  title: config.public.siteName,
  description: config.public.siteDescription,
  ogTitle: config.public.siteName,
  ogDescription: config.public.siteDescription,
})

const { data: postsData, error } = await useAsyncData('all-posts', () =>
  postsApi.list({ published: 'true', limit: 1000 }),
)

const allPosts = computed<ArchivePost[]>(() => {
  const list = (postsData.value?.data ?? []) as ArchivePost[]
  // 列表统一按创建时间倒序，避免接口排序变化导致顺序不稳
  return [...list].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
})

const articleGroups = computed(() => indexArticleGroups(allPosts.value))
const activeSeries = useState<string[]>('blog-series-filters', () => [])
const selectedSeries = computed(() => new Set(activeSeries.value))
const postIdsBySeries = computed(() => {
  const idsBySeries = new Map<string, Set<number>>()
  for (const post of allPosts.value) {
    for (const { kind, title } of articleGroups.value.positions.get(post.slug) ?? []) {
      if (kind !== 'series') continue
      if (!idsBySeries.has(title)) idsBySeries.set(title, new Set())
      idsBySeries.get(title)!.add(post.id)
    }
  }
  return idsBySeries
})
const seriesOptions = computed(() => [...postIdsBySeries.value.keys()])
const seriesScope = computed(() => {
  if (!selectedSeries.value.size) return undefined
  const scope = new Set<number>()
  for (const title of selectedSeries.value) {
    for (const id of postIdsBySeries.value.get(title) ?? []) scope.add(id)
  }
  return scope
})
const seriesPosts = computed(() => {
  const scope = seriesScope.value
  return scope ? allPosts.value.filter(post => scope.has(post.id)) : allPosts.value
})

watch(seriesOptions, (options) => {
  const available = activeSeries.value.filter(title => options.includes(title))
  if (available.length !== activeSeries.value.length) activeSeries.value = available
}, { immediate: true })

const seriesFilter = ref<HTMLDetailsElement | null>(null)
function closeSeriesFilter(event: Event) {
  const filter = seriesFilter.value
  if (filter?.open && !filter.contains(event.target as Node)) filter.open = false
}

function dismissSeriesFilter() {
  const filter = seriesFilter.value
  if (!filter?.open) return
  filter.open = false
  filter.querySelector('summary')?.focus()
}

onMounted(() => document.addEventListener('click', closeSeriesFilter))
onUnmounted(() => document.removeEventListener('click', closeSeriesFilter))

// 搜索：走接口的语义搜索，能按「概念」找文章（如搜 cordis 会带出讲 Cordis 的几篇）
const searchQuery = useState('blog-search', () => '')
const searchResults = ref<ArchivePost[] | null>(null)
const searching = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null
let searchRequest = 0

function queueSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  const request = ++searchRequest
  const q = searchQuery.value.trim()
  searchResults.value = null
  if (!q) {
    searching.value = false
    return
  }
  const scope = seriesScope.value
  searching.value = true
  searchTimer = setTimeout(async () => {
    try {
      const posts = await postsApi.search(q, 20, scope ? [...scope] : undefined)
      if (request === searchRequest) searchResults.value = posts
    } catch {
      if (request === searchRequest) searchResults.value = []
    } finally {
      if (request === searchRequest) searching.value = false
    }
  }, 250)
}

watch([searchQuery, seriesScope], queueSearch)
onMounted(queueSearch)
onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
  searchRequest += 1
})

// ── 标签筛选（多选，空选 = 全部）─────────────────────────────────────────
// 标签随文章接口一起返回，直接按全量列表聚合，无需额外请求
const activeTags = useState<string[]>('blog-tags', () => [])

const allTags = computed(() => {
  const map = new Map<string, number>()
  for (const post of seriesPosts.value) {
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

const tagFilters = ref<HTMLElement | null>(null)
const tagsExpanded = ref(false)
const compactTagCount = ref<number | null>(null)
const hasMoreTags = computed(() =>
  compactTagCount.value !== null && compactTagCount.value < allTags.value.length,
)

function measureTagRows() {
  const filters = tagFilters.value
  if (!filters) return

  // 收起时只隐藏超出的按钮，保留尺寸供窗口缩放后重新测量。
  const buttons = Array.from(filters.children)
  const toggleWidth = buttons.pop()!.getBoundingClientRect().width
  const availableWidth = filters.getBoundingClientRect().width
  const gap = Number.parseFloat(getComputedStyle(filters).columnGap)
  let row = 1
  let rowWidth = 0
  let lastCompactIndex = 0

  for (const [index, button] of buttons.entries()) {
    const width = button.getBoundingClientRect().width
    if (rowWidth && rowWidth + gap + width > availableWidth) {
      row += 1
      rowWidth = 0
    }
    if (row > 2) break

    rowWidth += rowWidth ? gap + width : width
    // 第一项是「全部」。第二行需要给末尾的「展开」留位置。
    if (row === 1 || rowWidth + gap + toggleWidth <= availableWidth) {
      lastCompactIndex = index
    }
  }

  compactTagCount.value = row > 2 ? lastCompactIndex : allTags.value.length
}

watch(tagFilters, (filters, _, onCleanup) => {
  if (!filters) return
  measureTagRows()
  const observer = new ResizeObserver(measureTagRows)
  observer.observe(filters)
  onCleanup(() => observer.disconnect())
}, { flush: 'post' })

watch([allTags, activeTags], measureTagRows, { flush: 'post' })

const filteredPosts = computed(() => {
  // 搜索结果不带 tags，按 id 从全量列表补齐，保证标签筛选对搜索结果同样生效
  const tagsById = new Map(allPosts.value.map(p => [p.id, p.tags ?? []]))
  const scope = seriesScope.value
  const source = searchResults.value
    ? searchResults.value
      .filter(post => !scope || scope.has(post.id))
      .map(post => ({ ...post, tags: post.tags?.length ? post.tags : tagsById.get(post.id) ?? [] }))
    : seriesPosts.value
  // 多选按「任一命中」取并集；一个都没选时不过滤，等同于全部
  if (activeTags.value.length === 0) return source
  return source.filter(p =>
    p.tags?.some(t => activeTags.value.includes(t.name)),
  )
})

const openCatalog = shallowRef<{ group: ArticleGroup; currentSlug?: string } | null>(null)

function openArticleCatalog(slug: string, groupKey: string) {
  const group = articleGroups.value.byKey.get(groupKey)
  if (group) openCatalog.value = { group, currentSlug: slug }
}

type ArchiveCard = { group: ArticleGroup; key: string }
  | { post: ArchivePost; key: string; positions: ArticlePosition[] }
const archiveCards = computed(() => {
  const cards: ArchiveCard[] = []
  const groups = articleGroups.value
  const seen = new Set<string>()
  for (const post of filteredPosts.value) {
    const positions = groups.positions.get(post.slug) ?? []
    let stacked = false
    for (const position of positions) {
      if (position.kind !== grouping.value) continue
      const series = position.kind === 'series' ? position.title : position.parentSeries
      if (selectedSeries.value.size && (!series || !selectedSeries.value.has(series))) continue
      const group = groups.byKey.get(position.groupKey)
      if (!group || group.count < 2) continue
      stacked = true
      if (seen.has(group.key)) continue
      cards.push({ group, key: group.key })
      seen.add(group.key)
    }
    if (!stacked) cards.push({ post, key: post.slug, positions })
  }
  return cards
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
  return `${seriesPosts.value.length} 篇文章`
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
  <div class="archive-wide pb-20 pt-8 sm:pt-12">
    <h1 class="sr-only">文章</h1>

    <section aria-label="文章">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--reader-line)] pb-4">
        <div role="status" class="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm tabular-nums text-[var(--reader-muted)]">
          <template v-if="error">文章</template>
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
        <div class="flex w-full max-w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
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
          <details
            v-if="seriesOptions.length"
            ref="seriesFilter"
            class="series-filter relative w-full min-w-0 text-sm text-[var(--reader-ink)] sm:w-60"
            @keydown.esc.stop="dismissSeriesFilter"
          >
            <summary class="flex min-h-[2.625rem] cursor-pointer list-none items-center justify-between gap-2 rounded-md border border-[var(--reader-line)] bg-[var(--reader-surface)] px-3">
              <span class="sr-only">按系列筛选</span>
              <span class="truncate">{{ activeSeries.length === 1 ? activeSeries[0] : activeSeries.length ? `已选 ${activeSeries.length} 个系列` : '全部系列' }}</span>
              <svg aria-hidden="true" class="series-chevron h-3.5 w-3.5 shrink-0 text-[var(--reader-muted)]" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="m4 6 4 4 4-4" />
              </svg>
            </summary>
            <fieldset class="absolute inset-x-0 top-full z-20 mt-1 max-h-64 min-w-0 overflow-y-auto rounded-md border border-[var(--reader-line)] bg-[var(--reader-surface)] p-1.5 shadow-lg">
              <legend class="sr-only">按系列筛选（可多选）</legend>
              <button
                v-if="activeSeries.length"
                type="button"
                class="mb-1 rounded px-2 py-1 text-xs text-[var(--reader-muted)] hover:text-[var(--reader-ink)]"
                @click="activeSeries = []; dismissSeriesFilter()"
              >
                清除系列筛选
              </button>
              <label
                v-for="series in seriesOptions"
                :key="series"
                class="flex min-h-9 cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-[var(--reader-paper)]"
              >
                <input v-model="activeSeries" :value="series" type="checkbox" class="size-4 shrink-0 accent-[var(--reader-accent)]" />
                <span class="min-w-0 flex-1 break-words">{{ series }}</span>
              </label>
            </fieldset>
          </details>
          <fieldset class="flex min-w-0 flex-wrap gap-0.5 self-start rounded-md border border-[var(--reader-line)] p-0.5 sm:shrink-0">
            <legend class="sr-only">卡片分组方式</legend>
            <label v-for="option in groupingOptions" :key="option.value" class="grouping-option cursor-pointer">
              <input v-model="grouping" type="radio" name="archive-grouping" :value="option.value" class="sr-only" />
              <span class="flex min-h-9 items-center rounded px-2.5 text-sm sm:px-3">{{ option.label }}</span>
            </label>
          </fieldset>
        </div>
      </div>

      <div v-if="allTags.length" class="tag-text mt-4 rounded-md border border-[var(--reader-line)] px-4 py-3">
        <div
          ref="tagFilters"
          role="group"
          aria-label="标签筛选"
          class="relative flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] leading-5"
          :class="compactTagCount === null && 'max-h-14 overflow-clip'"
        >
          <button
            type="button"
            class="max-w-full truncate py-0.5 transition-colors"
            :class="activeTags.length === 0
              ? 'font-medium text-[var(--reader-ink)] underline decoration-[var(--reader-accent)] underline-offset-4'
              : 'text-[var(--reader-muted)] hover:text-[var(--reader-ink)]'"
            :aria-pressed="activeTags.length === 0"
            @click="activeTags = []"
          >
            全部<span class="ml-1 text-[11px] tabular-nums opacity-60">{{ seriesPosts.length }}</span>
          </button>
          <button
            v-for="(tag, index) in allTags"
            :key="tag.name"
            type="button"
            class="max-w-full truncate py-0.5 transition-colors"
            :class="[
              activeTags.includes(tag.name)
                ? 'font-medium text-[var(--reader-ink)] underline decoration-[var(--reader-accent)] underline-offset-4'
                : 'text-[var(--reader-muted)] hover:text-[var(--reader-ink)]',
              !tagsExpanded && compactTagCount !== null && index >= compactTagCount && 'absolute left-0 top-0 invisible',
            ]"
            :aria-pressed="activeTags.includes(tag.name)"
            @click="toggleTag(tag.name)"
          >
            #{{ tag.name }}<span class="ml-1 text-[11px] tabular-nums opacity-60">{{ tag.count }}</span>
          </button>
          <button
            type="button"
            class="w-8 shrink-0 whitespace-nowrap py-0.5 text-left text-[var(--reader-accent)] underline-offset-4 hover:underline"
            :class="!hasMoreTags && 'absolute left-0 top-0 invisible'"
            :aria-expanded="tagsExpanded"
            @click="tagsExpanded = !tagsExpanded"
          >
            {{ tagsExpanded ? '收起' : '展开' }}
          </button>
        </div>
      </div>

      <ul v-if="archiveCards.length" class="archive-cards mt-5 grid gap-4 sm:gap-5">
        <template v-for="card in archiveCards" :key="card.key">
          <li v-if="'group' in card" :data-kind="card.group.kind" class="archive-stack relative isolate grid min-w-0">
            <button
              type="button"
              aria-haspopup="dialog"
              class="archive-stack-front flex min-h-48 min-w-0 flex-col rounded-xl border p-5 text-left transition-colors"
              @click="openCatalog = { group: card.group }"
            >
              <span class="text-xs tabular-nums text-[var(--reader-muted)]">
                {{ card.group.kind === 'topic' ? '专题' : '系列' }}
                · {{ card.group.count }} 篇<template v-if="card.group.topicCount"> · {{ card.group.topicCount }} 个专题</template>
              </span>
              <span class="reader-display mt-3 line-clamp-3 text-xl font-bold leading-snug">{{ card.group.title }}</span>
              <span v-if="card.group.description" class="reader-display mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--reader-muted)]">{{ card.group.description }}</span>
              <span class="mt-auto space-y-2.5 pt-3">
                <span v-if="card.group.parentSeries" class="card-placement flex items-baseline gap-2">
                  <span class="card-placement-label">所属系列</span>
                  <span class="min-w-0 flex-1 break-words font-medium">{{ card.group.parentSeries }}</span>
                  <span v-if="card.group.topicPosition" class="shrink-0 tabular-nums">{{ card.group.topicPosition.index }}/{{ card.group.topicPosition.total }}</span>
                </span>
                <span class="flex items-center justify-between gap-2 border-t border-[var(--reader-line)] pt-2 text-sm text-[var(--reader-muted)]">
                  {{ card.group.kind === 'topic' ? '查看专题目录' : '查看系列目录' }} <span aria-hidden="true">→</span>
                </span>
              </span>
            </button>
          </li>
          <li
            v-else
            class="group relative flex min-h-48 min-w-0 flex-col rounded-xl border border-[var(--reader-line)] bg-[var(--reader-surface)] p-5 transition-colors focus-within:border-[var(--reader-accent)] hover:border-[var(--reader-accent)]"
          >
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-[var(--reader-muted)]">
              <time :datetime="card.post.createdAt">{{ formatDate(card.post.createdAt) }}</time>
              <span class="ml-auto">{{ card.post.readingTime ?? 1 }} 分钟阅读</span>
              <span aria-hidden="true" class="text-base leading-none text-[var(--reader-accent)]">↗</span>
            </div>
            <h2 class="reader-display mt-3 text-xl font-bold leading-snug">
              <NuxtLink
                :to="`/blog/${card.post.slug}`"
                class="transition-colors group-hover:text-[var(--reader-accent)] after:absolute after:inset-0 after:rounded-xl after:content-['']"
              >
                <span class="line-clamp-3">{{ card.post.title }}</span>
              </NuxtLink>
            </h2>
            <p v-if="card.post.excerpt" class="reader-display mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--reader-muted)]">
              {{ card.post.excerpt }}
            </p>
            <div v-if="card.positions.length || card.post.tags?.length" class="mt-auto space-y-2.5 pt-4">
              <div v-if="card.post.tags?.length" role="group" aria-label="文章标签" class="tag-text flex flex-wrap gap-1.5 text-xs">
                <button
                  v-for="tag in card.post.tags"
                  :key="tag.id"
                  type="button"
                  class="relative z-10 max-w-full truncate rounded border bg-[var(--reader-paper)] px-2 py-0.5 transition-colors hover:border-[var(--reader-accent)] hover:text-[var(--reader-accent)]"
                  :class="activeTags.includes(tag.name)
                    ? 'border-[var(--reader-accent)] text-[var(--reader-accent)]'
                    : 'border-[var(--reader-line)] text-[var(--reader-muted)]'"
                  :aria-pressed="activeTags.includes(tag.name)"
                  @click="toggleTag(tag.name)"
                >
                  #{{ tag.name }}
                </button>
              </div>
              <div v-if="card.positions.length" role="group" aria-label="文章归属" class="card-placement">
                <button
                  v-for="position in card.positions"
                  :key="position.groupKey"
                  type="button"
                  aria-haspopup="dialog"
                  class="relative z-10 flex min-h-6 w-full items-baseline gap-2 rounded-sm py-0.5 text-left hover:text-[var(--reader-ink)]"
                  @click="openArticleCatalog(card.post.slug, position.groupKey)"
                >
                  <span class="card-placement-label">{{ position.kind === 'series' ? '所属系列' : '所属专题' }}</span>
                  <span class="min-w-0 flex-1 break-words">
                    <span class="font-medium underline decoration-[var(--reader-line)] underline-offset-2">{{ position.title }}</span>
                    <span v-if="position.parentSeries && card.positions.length > 2" class="block opacity-75">{{ position.parentSeries }}</span>
                  </span>
                  <span class="shrink-0 tabular-nums">{{ position.index }}/{{ position.total }}</span>
                </button>
              </div>
            </div>
          </li>
        </template>
      </ul>

      <p v-else class="border-b border-[var(--reader-line)] py-16 text-center text-sm text-[var(--reader-muted)]">
        {{ error ? '文章暂时无法加载' : searchQuery.trim() ? '没有找到匹配的文章' : activeTags.length ? '所选标签下暂无文章' : '暂无文章' }}
      </p>
    </section>
    <ArticleGroupDialog
      v-if="openCatalog"
      :group="openCatalog.group"
      :current-slug="openCatalog.currentSlug"
      @close="openCatalog = null"
    />
  </div>
</template>

<style scoped>
.archive-wide {
  padding-inline: clamp(1.25rem, 4vw, 2.5rem);
}

.archive-cards {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr));
  grid-auto-rows: 1fr;
}

.archive-stack {
  --stack-face: color-mix(in srgb, var(--reader-surface) 95%, var(--reader-ink));
  --stack-line: color-mix(in srgb, var(--reader-line) 94%, var(--reader-ink));
}

.archive-stack[data-kind="series"] {
  --stack-face: color-mix(in srgb, var(--reader-surface) 94%, var(--reader-accent));
  --stack-line: color-mix(in srgb, var(--reader-line) 90%, var(--reader-accent));
}

.archive-stack[data-kind="series"]::before,
.archive-stack::after {
  position: absolute;
  inset: 0;
  z-index: -1;
  border: 1px solid var(--stack-line);
  border-radius: 0.75rem;
  pointer-events: none;
  content: '';
}

.archive-stack[data-kind="series"]::before {
  transform: translate(7px, 10px);
  background: color-mix(in srgb, var(--stack-face) 91%, var(--reader-ink));
}

.archive-stack::after {
  transform: translate(3.5px, 5px);
  background: color-mix(in srgb, var(--stack-face) 96%, var(--reader-ink));
}

.archive-stack-front {
  border-color: var(--stack-line);
  background: var(--stack-face);
}

.archive-stack-front:is(:hover, :focus-visible) {
  border-color: var(--reader-muted);
}

.card-placement {
  color: var(--reader-muted);
  font-size: 0.6875rem;
  line-height: 1.45;
}

.card-placement-label {
  flex-shrink: 0;
}

.grouping-option span {
  color: var(--reader-muted);
}

.grouping-option:hover span,
.grouping-option input:checked + span {
  color: var(--reader-ink);
}

.grouping-option input:checked + span {
  background: var(--reader-surface);
  font-weight: 600;
}

.grouping-option input:focus-visible + span {
  outline: 2px solid var(--reader-accent);
  outline-offset: 2px;
}

.archive-search:focus-within {
  outline: 2px solid var(--reader-accent);
  outline-offset: 2px;
}

.archive-search input:focus {
  outline: none;
}

.series-filter summary::-webkit-details-marker {
  display: none;
}

.series-filter[open] .series-chevron {
  transform: rotate(180deg);
}

/* 标签统一用宋体，与站点标题一致 */
.tag-text {
  font-family: var(--reader-display);
}
</style>
