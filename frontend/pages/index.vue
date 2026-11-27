<script setup lang="ts">
import { indexArticleGroups, type ArchivePost, type ArticleGroup, type ArticlePosition } from '~/utils/articleSeries'

definePageMeta({ layout: 'default' })

const config = useRuntimeConfig()
const postsApi = usePostsApi()

// ── 显示方式：卡片 / 列表 ────────────────────────────────────────────────
// 默认列表（信息密度高、按系列分组好扫读），需要摘要卡片时再切到卡片视图。
// 列表在前，和默认视图保持一致。
const viewOptions = [
  { value: 'list', label: '列表视图' },
  { value: 'card', label: '卡片视图' },
] as const
type ViewMode = typeof viewOptions[number]['value']
const viewPreference = useCookie<ViewMode>('blog-archive-view', {
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
})
const view = computed<ViewMode>({
  get: () => (viewPreference.value === 'card' ? 'card' : 'list'),
  set: value => { viewPreference.value = value },
})

useSeoMeta({
  title: config.public.siteName,
  description: config.public.siteDescription,
  ogTitle: config.public.siteName,
  ogDescription: config.public.siteDescription,
})

const { data: postsData, error } = await useAsyncData('all-posts', () =>
  postsApi.list({ published: 'true', limit: 1000 }),
  {
    // 从详情页返回首页时复用已加载的列表，避免每次都重新拉全量数据
    getCachedData: key => useNuxtApp().payload.data[key] ?? useNuxtApp().static.data[key],
  },
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
  searching.value = true
  searchTimer = setTimeout(async () => {
    try {
      const posts = await postsApi.search(q, 20)
      if (request === searchRequest) searchResults.value = posts
    } catch {
      if (request === searchRequest) searchResults.value = []
    } finally {
      if (request === searchRequest) searching.value = false
    }
  }, 250)
}

watch(searchQuery, queueSearch)
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
  const source = searchResults.value
    ? searchResults.value.map(post => ({ ...post, tags: post.tags?.length ? post.tags : tagsById.get(post.id) ?? [] }))
    : allPosts.value
  // 多选按「任一命中」取并集；一个都没选时不过滤，等同于全部
  if (activeTags.value.length === 0) return source
  return source.filter(p =>
    p.tags?.some(t => activeTags.value.includes(t.name)),
  )
})

const openCatalog = shallowRef<{ group: ArticleGroup; currentSlug?: string } | null>(null)
// 学习路线弹窗：按依赖顺序排的 95 篇，数据在 utils/learningPath.ts
const openLearningPath = ref(false)

function openArticleCatalog(slug: string, groupKey: string) {
  const group = articleGroups.value.byKey.get(groupKey)
  if (group) openCatalog.value = { group, currentSlug: slug }
}

// 归档按系列分组（卡片和列表共用）：一篇文章只归入它所属的第一个系列，
// 没有系列的统一落到「独立文章」组；组内按篇目序号，组间按最近更新排，兜底组固定最后。
const UNSECTIONED_KEY = 'unsectioned'

interface ArchiveRow {
  post: ArchivePost
  position?: ArticlePosition
  topic?: ArticlePosition
}

interface ArchiveSection {
  key: string
  title: string
  group?: ArticleGroup
  rows: ArchiveRow[]
  latest: number
  // 整组都没有专题/序号时就不渲染对应列，避免留出整列空白
  hasTopic: boolean
  hasPosition: boolean
}

// 系列之间的顺序可以手动拖拽调整，顺序记在 cookie 里（独立文章组不参与，固定最后）
const sectionOrder = useCookie<string[]>('blog-section-order', {
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
})
const orderIndex = computed(() => {
  const index = new Map<string, number>()
  for (const [position, key] of (sectionOrder.value ?? []).entries()) index.set(key, position)
  return index
})

const draggingSection = ref<string | null>(null)
const dragOverSection = ref<string | null>(null)

function startSectionDrag(event: DragEvent, key: string) {
  draggingSection.value = key
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', key)
  }
}

function dragSectionOver(event: DragEvent, key: string) {
  if (!draggingSection.value || draggingSection.value === key) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dragOverSection.value = key
}

function dropSection(key: string) {
  const from = draggingSection.value
  draggingSection.value = null
  dragOverSection.value = null
  if (!from || from === key) return

  // 只在系列之间重排，独立文章组不参与
  const keys = sections.value.map(section => section.key).filter(k => k !== UNSECTIONED_KEY)
  const fromIndex = keys.indexOf(from)
  const toIndex = keys.indexOf(key)
  if (fromIndex < 0 || toIndex < 0) return
  keys.splice(toIndex, 0, keys.splice(fromIndex, 1)[0])
  sectionOrder.value = keys
}

function endSectionDrag() {
  draggingSection.value = null
  dragOverSection.value = null
}

const sections = computed<ArchiveSection[]>(() => {
  const map = new Map<string, ArchiveSection>()
  for (const post of filteredPosts.value) {
    const positions = articleGroups.value.positions.get(post.slug) ?? []
    const series = positions.find(position => position.kind === 'series')
    const key = series?.groupKey ?? UNSECTIONED_KEY
    let section = map.get(key)
    if (!section) {
      section = {
        key,
        title: series?.title ?? '独立文章',
        group: series ? articleGroups.value.byKey.get(series.groupKey) : undefined,
        rows: [],
        latest: 0,
        hasTopic: false,
        hasPosition: false,
      }
      map.set(key, section)
    }
    section.rows.push({
      post,
      position: series,
      topic: positions.find(position => position.kind === 'topic'),
    })
    section.latest = Math.max(section.latest, Date.parse(post.createdAt) || 0)
  }

  // 组内按篇目序号升序，读起来和目录一致；没有序号的（独立文章）保持时间倒序
  for (const section of map.values()) {
    section.rows.sort((a, b) => (a.position?.index ?? 0) - (b.position?.index ?? 0))
    section.hasTopic = section.rows.some(row => Boolean(row.topic))
    section.hasPosition = section.rows.some(row => Boolean(row.position))
  }

  const order = orderIndex.value
  return [...map.values()].sort((a, b) => {
    if (a.key === UNSECTIONED_KEY) return 1
    if (b.key === UNSECTIONED_KEY) return -1
    // 拖拽过的系列按记录的顺序排，没记录的按最近更新排在后面
    const ai = order.get(a.key)
    const bi = order.get(b.key)
    if (ai !== undefined && bi !== undefined) return ai - bi
    if (ai !== undefined) return -1
    if (bi !== undefined) return 1
    return b.latest - a.latest
  })
})

// 折叠状态按分组 key 记录，默认全部展开
const collapsedSections = ref<Set<string>>(new Set())

function toggleSection(key: string) {
  const next = new Set(collapsedSections.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  collapsedSections.value = next
}

const allCollapsed = computed(() =>
  sections.value.length > 0
  && sections.value.every(section => collapsedSections.value.has(section.key)),
)

function toggleAllSections() {
  collapsedSections.value = allCollapsed.value
    ? new Set()
    : new Set(sections.value.map(section => section.key))
}

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
          <button
            type="button"
            class="ml-auto flex min-h-[2.625rem] shrink-0 items-center rounded-md border border-[var(--reader-line)] px-3 text-sm text-[var(--reader-muted)] transition-colors hover:text-[var(--reader-ink)]"
            @click="openLearningPath = true"
          >
            学习路线
          </button>
          <button
            v-if="sections.length > 1"
            type="button"
            class="flex min-h-[2.625rem] shrink-0 items-center rounded-md border border-[var(--reader-line)] px-3 text-sm text-[var(--reader-muted)] transition-colors hover:text-[var(--reader-ink)]"
            :title="allCollapsed ? '展开所有分组' : '折叠所有分组后可拖动调整系列顺序'"
            @click="toggleAllSections"
          >
            {{ allCollapsed ? '全部展开' : '全部折叠' }}
          </button>
          <fieldset class="flex shrink-0 self-start gap-0.5 rounded-md border border-[var(--reader-line)] p-0.5">
            <legend class="sr-only">显示方式</legend>
            <button
              v-for="option in viewOptions"
              :key="option.value"
              type="button"
              class="view-toggle grid size-9 place-items-center rounded transition-colors"
              :aria-pressed="view === option.value"
              :title="option.label"
              @click="view = option.value"
            >
              <svg v-if="option.value === 'card'" aria-hidden="true" class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="6" height="6" rx="1" />
                <rect x="11" y="3" width="6" height="6" rx="1" />
                <rect x="3" y="11" width="6" height="6" rx="1" />
                <rect x="11" y="11" width="6" height="6" rx="1" />
              </svg>
              <svg v-else aria-hidden="true" class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <path d="M3 5.5h2M8 5.5h9M3 10h2M8 10h9M3 14.5h2M8 14.5h9" />
              </svg>
              <span class="sr-only">{{ option.label }}</span>
            </button>
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
            全部<span class="ml-1 text-[11px] tabular-nums opacity-60">{{ allPosts.length }}</span>
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

      <div v-if="sections.length" class="mt-5 space-y-7">
        <section
          v-for="section in sections"
          :key="section.key"
          class="archive-section"
          :class="[
            draggingSection === section.key && 'is-dragging',
            dragOverSection === section.key && 'is-drop-target',
          ]"
          @dragover="dragSectionOver($event, section.key)"
          @drop.prevent="dropSection(section.key)"
        >
          <header class="archive-section-head flex items-start gap-3 pb-3">
            <button
              type="button"
              class="group/head flex min-w-0 max-w-full items-start gap-2 text-left"
              :class="collapsedSections.has(section.key) ? 'flex-none' : 'flex-1'"
              :aria-expanded="!collapsedSections.has(section.key)"
              :aria-controls="`section-${section.key}`"
              @click="toggleSection(section.key)"
            >
              <svg
                aria-hidden="true"
                class="archive-section-chevron mt-1 h-3.5 w-3.5 shrink-0 text-[var(--reader-muted)]"
                :class="collapsedSections.has(section.key) && 'is-collapsed'"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <path d="m4 6 4 4 4-4" />
              </svg>
              <span class="min-w-0 flex-1">
                <span class="reader-display block text-base font-bold leading-snug transition-colors group-hover/head:text-[var(--reader-accent)]">{{ section.title }}</span>
                <span class="mt-1 block text-[11px] tracking-[0.12em] text-[var(--reader-muted)]">
                  {{ section.group ? '系列' : '未归入系列' }} · <span class="tabular-nums">{{ section.rows.length }} 篇</span>
                </span>
              </span>
            </button>
            <button
              v-if="section.key !== UNSECTIONED_KEY && collapsedSections.has(section.key)"
              type="button"
              draggable="true"
              class="section-drag hidden shrink-0 cursor-grab self-center rounded p-1.5 text-[var(--reader-muted)] transition-colors hover:text-[var(--reader-ink)] active:cursor-grabbing lg:block"
              aria-label="拖动调整系列顺序"
              title="拖动调整系列顺序"
              @click.stop
              @dragstart="startSectionDrag($event, section.key)"
              @dragend="endSectionDrag"
            >
              <svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <circle cx="6" cy="4" r="1.4" />
                <circle cx="10" cy="4" r="1.4" />
                <circle cx="6" cy="8" r="1.4" />
                <circle cx="10" cy="8" r="1.4" />
                <circle cx="6" cy="12" r="1.4" />
                <circle cx="10" cy="12" r="1.4" />
              </svg>
            </button>
          </header>

          <div v-show="!collapsedSections.has(section.key)" :id="`section-${section.key}`">
            <ul v-if="view === 'card'" class="archive-cards grid gap-4 sm:gap-5">
              <li
                v-for="row in section.rows"
                :key="row.post.id"
                class="group relative flex min-h-48 min-w-0 flex-col rounded-xl border border-[var(--reader-line)] bg-[var(--reader-surface)] p-5 transition-colors focus-within:border-[var(--reader-accent)] hover:border-[var(--reader-accent)]"
              >
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-[var(--reader-muted)]">
                  <time :datetime="row.post.createdAt">{{ formatDate(row.post.createdAt) }}</time>
                  <span class="ml-auto">{{ row.post.readingTime ?? 1 }} 分钟阅读</span>
                  <span aria-hidden="true" class="text-base leading-none text-[var(--reader-accent)]">↗</span>
                </div>
                <h2 class="reader-display mt-3 text-xl font-bold leading-snug">
                  <NuxtLink
                    :to="`/blog/${row.post.slug}`"
                    class="transition-colors group-hover:text-[var(--reader-accent)] after:absolute after:inset-0 after:rounded-xl after:content-['']"
                  >
                    <span class="line-clamp-3">{{ row.post.title }}</span>
                  </NuxtLink>
                </h2>
                <div v-if="row.topic || row.post.tags?.length" class="mt-auto pt-4">
                  <div v-if="row.topic" role="group" aria-label="文章归属" class="card-placement">
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      class="relative z-10 flex min-h-6 w-full items-baseline gap-1.5 rounded-sm py-0.5 text-left hover:text-[var(--reader-ink)]"
                      @click="openArticleCatalog(row.post.slug, row.topic.groupKey)"
                    >
                      <span class="card-placement-label">专题</span>
                      <span class="min-w-0 flex-1 truncate font-medium" :title="row.topic.title">{{ row.topic.title }}</span>
                      <span class="shrink-0 tabular-nums">{{ row.topic.index }}/{{ row.topic.total }}</span>
                    </button>
                  </div>
                  <div v-if="row.post.tags?.length" role="group" aria-label="文章标签" class="tag-text mt-1.5 flex flex-wrap items-center gap-x-2.5 text-[11px] leading-5 text-[var(--reader-muted)]">
                    <button
                      v-for="tag in row.post.tags"
                      :key="tag.id"
                      type="button"
                      class="relative z-10 max-w-full truncate transition-colors hover:text-[var(--reader-accent)]"
                      :class="activeTags.includes(tag.name) && 'font-medium text-[var(--reader-accent)]'"
                      :aria-pressed="activeTags.includes(tag.name)"
                      @click="toggleTag(tag.name)"
                    >
                      #{{ tag.name }}
                    </button>
                  </div>
                </div>
              </li>
            </ul>

            <ul v-else class="archive-list">
              <li
                v-for="row in section.rows"
                :key="row.post.id"
                class="archive-row group relative flex items-baseline gap-3 border-b border-[var(--reader-line)] py-3 sm:gap-4"
              >
                <time class="hidden w-[5.5rem] shrink-0 text-xs tabular-nums text-[var(--reader-muted)] sm:block" :datetime="row.post.createdAt">
                  {{ formatDate(row.post.createdAt) }}
                </time>
                <span class="min-w-0 flex-1">
                  <NuxtLink
                    :to="`/blog/${row.post.slug}`"
                    class="reader-display block text-[15px] font-semibold leading-snug transition-colors after:absolute after:inset-0 after:content-[''] group-hover:text-[var(--reader-accent)]"
                  >
                    {{ row.post.title }}
                  </NuxtLink>
                  <span class="mt-1 flex flex-wrap items-center gap-x-3 text-xs tabular-nums text-[var(--reader-muted)] sm:hidden">
                    <time :datetime="row.post.createdAt">{{ formatDate(row.post.createdAt) }}</time>
                    <span>{{ row.post.readingTime ?? 1 }} 分钟</span>
                  </span>
                </span>
                <template v-if="section.hasTopic">
                  <span v-if="row.topic" class="hidden w-60 shrink-0 truncate text-xs text-[var(--reader-muted)] lg:block" :title="row.topic.title">
                    {{ row.topic.title }}
                  </span>
                  <span v-else class="hidden w-60 shrink-0 lg:block" aria-hidden="true"></span>
                </template>
                <template v-if="section.hasPosition">
                  <span v-if="row.position" class="hidden w-12 shrink-0 text-right text-xs tabular-nums text-[var(--reader-muted)] lg:block">
                    {{ row.position.index }}/{{ row.position.total }}
                  </span>
                  <span v-else class="hidden w-12 shrink-0 lg:block" aria-hidden="true"></span>
                </template>
                <span class="hidden w-[4.5rem] shrink-0 text-right text-xs tabular-nums text-[var(--reader-muted)] sm:block">
                  {{ row.post.readingTime ?? 1 }} 分钟
                </span>
              </li>
            </ul>
          </div>
        </section>
      </div>

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
    <LearningPathDialog v-if="openLearningPath" @close="openLearningPath = false" />
  </div>
</template>

<style scoped>
.archive-wide {
  padding-inline: clamp(1.25rem, 4vw, 2.5rem);
}

.archive-cards {
  /* 19rem 让 1440 宽排 4 列、1920 宽排 5 列；再宽也不至于碎成 7 列以上 */
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr));
  grid-auto-rows: 1fr;
}

.archive-list {
  border-top: 1px solid var(--reader-line);
}

/* 折叠箭头：展开朝下，收起朝右 */
.archive-section-chevron {
  transition: transform 0.16s ease;
}

.archive-section-chevron.is-collapsed {
  transform: rotate(-90deg);
}

/* 拖拽排序：拖动中的组半透明，目标位置顶部画一条强调色线 */
.archive-section.is-dragging {
  opacity: 0.45;
}

.archive-section.is-drop-target {
  box-shadow: 0 -2px 0 var(--reader-accent);
}

.section-drag:focus-visible {
  outline: 2px solid var(--reader-accent);
  outline-offset: 2px;
}

.card-placement {
  color: var(--reader-muted);
  font-size: 0.6875rem;
  line-height: 1.45;
}

.card-placement-label {
  flex-shrink: 0;
}

.view-toggle {
  color: var(--reader-muted);
}

.view-toggle:hover {
  background: var(--reader-paper);
  color: var(--reader-ink);
}

.view-toggle[aria-pressed='true'] {
  background: var(--reader-surface);
  color: var(--reader-ink);
}

.view-toggle:focus-visible {
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
