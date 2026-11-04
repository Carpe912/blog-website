<script setup lang="ts">
/**
 * ArticleToc — 文章目录侧栏
 *
 * 交互：
 *  - 拖拽右侧手柄调宽度（200~480），拖到 200 以下松手自动折叠
 *  - 折叠后在屏幕左侧边缘显示展开按钮，点一下恢复
 *  - 标题被截断时，鼠标移上去浮层显示完整文字
 *  - 宽度与折叠状态记在 localStorage，重进保持
 */
interface TocHeading {
  id: string
  text: string
  level: 2 | 3
}

defineProps<{
  headings: TocHeading[]
  activeId: string
}>()

/** 通知父级当前占用的宽度（折叠时为 0），用于正文让位 */
const emit = defineEmits<{ 'update:width': [number] }>()

const DEFAULT_WIDTH = 272
const MIN_WIDTH = 120 // 拖拽允许的最小值
const MAX_WIDTH = 480
const COLLAPSE_THRESHOLD = 200 // 松手时低于此宽度自动折叠
const WIDTH_KEY = 'blog-toc-width'
const COLLAPSED_KEY = 'blog-toc-collapsed'

const width = ref(DEFAULT_WIDTH)
const collapsed = ref(false)
const dragging = ref(false)

const tip = reactive({ visible: false, text: '', top: 0, left: 0 })

function syncWidth() {
  emit('update:width', collapsed.value ? 0 : width.value)
}

onMounted(() => {
  const saved = Number(localStorage.getItem(WIDTH_KEY))
  if (Number.isFinite(saved) && saved >= COLLAPSE_THRESHOLD && saved <= MAX_WIDTH) {
    width.value = saved
  }
  collapsed.value = localStorage.getItem(COLLAPSED_KEY) === '1'
  syncWidth()
})

watch([width, collapsed], syncWidth)

/* ── 拖拽 ─────────────────────────────────────────────── */
let startX = 0
let startWidth = 0

function startDrag(e: PointerEvent) {
  dragging.value = true
  startX = e.clientX
  startWidth = width.value
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', endDrag)
  window.addEventListener('pointercancel', endDrag)
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'
}

function onDragMove(e: PointerEvent) {
  const next = startWidth + (e.clientX - startX)
  width.value = Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next)))
}

function endDrag() {
  dragging.value = false
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('pointercancel', endDrag)
  document.body.style.userSelect = ''
  document.body.style.cursor = ''

  if (width.value < COLLAPSE_THRESHOLD) {
    collapse()
    return
  }
  localStorage.setItem(WIDTH_KEY, String(width.value))
}

/* ── 折叠 / 展开 ──────────────────────────────────────── */
function collapse() {
  collapsed.value = true
  localStorage.setItem(COLLAPSED_KEY, '1')
  hideTip()
}

function expand() {
  if (width.value < COLLAPSE_THRESHOLD) width.value = DEFAULT_WIDTH
  collapsed.value = false
  localStorage.setItem(COLLAPSED_KEY, '0')
  syncWidth()
}

function resetWidth() {
  width.value = DEFAULT_WIDTH
  localStorage.setItem(WIDTH_KEY, String(DEFAULT_WIDTH))
}

/* ── 截断文字的完整提示 ───────────────────────────────── */
function showTip(e: Event, text: string) {
  const el = e.currentTarget as HTMLElement
  // 没有真正被截断就不打扰
  if (el.scrollWidth <= el.clientWidth + 1) {
    tip.visible = false
    return
  }
  const rect = el.getBoundingClientRect()
  tip.text = text
  tip.top = Math.round(rect.top + rect.height / 2)
  tip.left = Math.round(rect.right + 10)
  tip.visible = true
}

function hideTip() {
  tip.visible = false
}

onBeforeUnmount(hideTip)
</script>

<template>
  <!-- 折叠状态：左侧边缘的展开按钮 -->
  <button
    v-if="collapsed"
    type="button"
    class="fixed left-0 top-1/2 z-30 hidden h-14 w-6 -translate-y-1/2 items-center justify-center
           rounded-r-md border border-l-0 border-slate-200 bg-white text-slate-400 shadow-sm
           transition-colors hover:text-slate-700
           dark:border-ink-700 dark:bg-ink-800 dark:text-ink-400 dark:hover:text-ink-50 xl:flex"
    title="展开目录"
    aria-label="展开目录"
    @click="expand"
  >
    <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 5l7 7-7 7" />
    </svg>
  </button>

  <!-- 展开状态：可调宽度的目录栏 -->
  <div v-if="!collapsed" class="fixed inset-y-0 left-0 z-30 hidden xl:block" :style="{ width: width + 'px' }">
    <aside
      class="h-full overflow-y-auto border-r border-slate-200/70 bg-white px-6 py-9
             dark:border-ink-700/70 dark:bg-ink-800"
      @scroll="hideTip"
    >
      <div class="mb-3 flex items-center justify-between">
        <p class="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-ink-400">
          目录
        </p>
        <button
          type="button"
          class="-mr-2 flex h-6 w-6 items-center justify-center rounded text-slate-300
                 transition-colors hover:bg-slate-100 hover:text-slate-600
                 dark:text-ink-500 dark:hover:bg-ink-700 dark:hover:text-ink-100"
          title="收起目录"
          aria-label="收起目录"
          @click="collapse"
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
          </svg>
        </button>
      </div>

      <nav @mouseleave="hideTip">
        <a
          v-for="h in headings"
          :key="h.id"
          :href="`#${h.id}`"
          class="block truncate border-l-2 py-[5px] pr-2 text-[12.5px] leading-relaxed transition-colors"
          :class="[
            h.level === 3 ? 'pl-6' : 'pl-3',
            activeId === h.id
              ? 'border-slate-900 font-medium text-slate-900 dark:border-ink-200 dark:text-ink-50'
              : 'border-transparent text-slate-400 hover:text-slate-700 dark:text-ink-300 dark:hover:text-ink-100',
          ]"
          @mouseenter="showTip($event, h.text)"
          @focus="showTip($event, h.text)"
          @blur="hideTip"
        >
          {{ h.text }}
        </a>
      </nav>
    </aside>

    <!-- 宽度拖拽手柄 -->
    <div
      class="absolute inset-y-0 -right-[3px] z-10 w-[6px] cursor-col-resize touch-none
             transition-colors hover:bg-slate-300/60 dark:hover:bg-ink-600/60"
      :class="dragging ? 'bg-slate-300/80 dark:bg-ink-600/80' : ''"
      title="拖动调整宽度，双击恢复默认"
      @pointerdown.prevent="startDrag"
      @dblclick="resetWidth"
    />
  </div>

  <!-- 被截断标题的完整文字 -->
  <div
    v-if="tip.visible"
    class="pointer-events-none fixed z-50 max-w-[320px] rounded-md bg-slate-900/95 px-2.5 py-1.5
           text-[12px] leading-snug text-white shadow-lg
           dark:bg-ink-100 dark:text-ink-900"
    :style="{ top: tip.top + 'px', left: tip.left + 'px', transform: 'translateY(-50%)' }"
  >
    {{ tip.text }}
  </div>
</template>
