<script setup lang="ts">
/**
 * PostForm — 沉浸式写作界面
 *
 * 设计参考飞书文档：顶部轻量操作栏 + 大字号标题 + 宽幅正文编辑区。
 * Slug 与摘要由后端自动生成，表单不再暴露这些字段。
 */
const props = defineProps<{
  initial?: any
  loading?: boolean
  mode?: 'create' | 'edit'
}>()

const emit = defineEmits<{ submit: [data: any] }>()

const form = reactive({
  title: '',
  content: '',
  published: false,
})

if (props.initial) {
  form.title = props.initial.title ?? ''
  form.content = props.initial.content ?? ''
  form.published = props.initial.published ?? false
}

// ── 标题高度自适应 ──────────────────────────────────────────────────────────
const titleEl = ref<HTMLTextAreaElement | null>(null)

function autoGrow() {
  const el = titleEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

watch(() => form.title, () => nextTick(autoGrow))
onMounted(() => nextTick(autoGrow))

// ── 状态 ────────────────────────────────────────────────────────────────────
const plainText = computed(() =>
  form.content
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim(),
)

const canSubmit = computed(() => form.title.trim().length > 0 && plainText.value.length > 0)
const isDirty = computed(() => {
  if (!props.initial) return form.title.trim().length > 0 || plainText.value.length > 0
  return (
    form.title !== (props.initial.title ?? '') ||
    form.content !== (props.initial.content ?? '') ||
    form.published !== (props.initial.published ?? false)
  )
})

const charCount = computed(() => plainText.value.replace(/\s/g, '').length)
const readingMinutes = computed(() => Math.max(1, Math.round(charCount.value / 400)))

// ── 提交 ────────────────────────────────────────────────────────────────────
function save(published: boolean) {
  if (!canSubmit.value || props.loading) return
  form.published = published
  emit('submit', {
    title: form.title.trim(),
    content: form.content,
    published,
  })
}

const router = useRouter()
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-slate-900">
    <!-- 顶部操作栏 -->
    <header
      class="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur-sm
             dark:border-slate-800 dark:bg-slate-900/85"
    >
      <div class="mx-auto flex h-14 max-w-5xl items-center gap-3 px-5">
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors
                 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="返回文章列表"
          @click="router.push('/admin/posts')"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div class="flex min-w-0 items-center gap-2 text-sm">
          <span class="truncate font-medium text-slate-800 dark:text-slate-200">
            {{ mode === 'edit' ? '编辑文章' : '新建文章' }}
          </span>
          <span
            class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
            :class="form.published
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'"
          >
            {{ form.published ? '已发布' : '草稿' }}
          </span>
        </div>

        <div class="ml-auto flex items-center gap-2">
          <span class="mr-1 hidden text-xs text-slate-400 dark:text-slate-500 sm:inline tabular-nums">
            {{ charCount }} 字 · 约 {{ readingMinutes }} 分钟
          </span>

          <button
            type="button"
            class="btn-ghost"
            :disabled="!canSubmit || loading"
            @click="save(false)"
          >
            存草稿
          </button>

          <button
            type="button"
            class="btn-solid"
            :disabled="!canSubmit || loading"
            @click="save(true)"
          >
            <svg v-if="loading" class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
              <path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
            </svg>
            {{ loading ? '保存中' : (mode === 'edit' ? '更新' : '发布') }}
          </button>
        </div>
      </div>
    </header>

    <!-- 写作区 -->
    <main class="mx-auto max-w-3xl px-6 pb-32 pt-12 sm:px-8">
      <!-- 标题 -->
      <textarea
        ref="titleEl"
        v-model="form.title"
        rows="1"
        placeholder="无标题"
        class="w-full resize-none border-0 bg-transparent p-0 text-[2.15rem] font-semibold leading-[1.25]
               tracking-tight text-slate-900 outline-none placeholder:text-slate-300
               dark:text-slate-50 dark:placeholder:text-slate-600"
        @keydown.enter.prevent="($event.target as HTMLElement)?.blur()"
      />

      <!-- 辅助信息 -->
      <div class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 dark:text-slate-500">
        <span>链接与摘要将自动生成</span>
        <span class="text-slate-300 dark:text-slate-700">·</span>
        <span>支持 Markdown 快捷输入</span>
      </div>

      <!-- 正文 -->
      <div class="mt-8 -mx-2 sm:mx-0">
        <ClientOnly>
          <RichTextEditor
            v-model="form.content"
            placeholder="从这里开始写正文，输入 / 唤起更多格式…"
          />
          <template #fallback>
            <div class="min-h-[60vh] animate-pulse rounded-xl bg-slate-50 dark:bg-slate-800/40" />
          </template>
        </ClientOnly>
      </div>
    </main>

    <!-- 未保存提示 -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="translate-y-2 opacity-0"
    >
      <div
        v-if="isDirty && !loading"
        class="fixed bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full border border-slate-200
               bg-white/95 px-4 py-2 text-xs text-slate-500 shadow-sm backdrop-blur
               dark:border-slate-700 dark:bg-slate-800/95 dark:text-slate-400"
      >
        有未保存的修改
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.btn-ghost {
  @apply inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-medium
         text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900
         disabled:cursor-not-allowed disabled:opacity-40
         dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white;
}
.btn-solid {
  @apply inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-1.5 text-[13px] font-medium
         text-white transition-all hover:bg-slate-800 active:scale-[0.98]
         disabled:cursor-not-allowed disabled:opacity-40
         dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200;
}
</style>
