<script setup lang="ts">
// 学习路线弹窗：按依赖顺序把 95 篇排成 12 批，每批标明这一批的门槛
import { learningPath, learningPathCount } from '~/utils/learningPath'

const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement | null>(null)

// 每批第一篇在全表中的起始序号，跨批连续编号
const stageStarts = computed(() => {
  let next = 1
  return learningPath.map((stage) => {
    const start = next
    next += stage.items.length
    return start
  })
})

onMounted(() => dialog.value?.showModal())

function closeOnBackdrop(event: MouseEvent) {
  if (event.target === dialog.value) dialog.value?.close()
}
</script>

<template>
  <dialog
    ref="dialog"
    aria-labelledby="learning-path-title"
    aria-describedby="learning-path-intro"
    class="learning-path-dialog overflow-hidden rounded-2xl border border-[var(--reader-line)] bg-[var(--reader-paper)] p-0 text-[var(--reader-ink)] shadow-2xl open:flex open:flex-col"
    @close="emit('close')"
    @click="closeOnBackdrop"
  >
    <header class="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--reader-line)] bg-[var(--reader-surface)] p-4 sm:p-5">
      <div class="min-w-0">
        <p class="mb-1 text-sm tabular-nums text-[var(--reader-muted)]">{{ learningPathCount }} 篇 · 约 63 小时</p>
        <h2 id="learning-path-title" class="reader-display text-xl font-bold leading-snug sm:text-2xl">学习路线</h2>
        <p id="learning-path-intro" class="mt-2 text-sm leading-relaxed text-[var(--reader-muted)]">
          按依赖顺序排列：从语言执行到业务语义查询，每批读完都有一件能拿出来验证的产出。
        </p>
      </div>
      <button
        type="button"
        aria-label="关闭学习路线"
        autofocus
        class="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-[var(--reader-line)] bg-[var(--reader-paper)] text-2xl leading-none transition-colors hover:text-[var(--reader-accent)]"
        @click="dialog?.close()"
      >
        <span aria-hidden="true">×</span>
      </button>
    </header>

    <div class="min-h-0 overflow-y-auto overscroll-contain px-4 pb-6 sm:px-5" role="region" aria-label="学习路线文章列表">
      <section v-for="(stage, index) in learningPath" :key="stage.name" class="mt-5">
        <div class="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-b border-[var(--reader-line)] pb-2">
          <span class="text-xs tabular-nums text-[var(--reader-muted)]">{{ String(index + 1).padStart(2, '0') }}</span>
          <h3 class="reader-display text-base font-bold">{{ stage.name }}</h3>
          <span class="text-xs text-[var(--reader-muted)]">{{ stage.goal }}</span>
          <span class="ml-auto text-xs tabular-nums text-[var(--reader-muted)]">{{ stage.items.length }} 篇</span>
        </div>
        <ul class="divide-y divide-[var(--reader-line)]">
          <li v-for="(item, offset) in stage.items" :key="item.slug">
            <NuxtLink
              :to="`/blog/${item.slug}`"
              :prefetch="false"
              class="group flex min-h-11 items-baseline gap-2.5 py-2.5 transition-colors hover:text-[var(--reader-accent)]"
            >
              <span class="w-[3ch] shrink-0 text-xs tabular-nums text-[var(--reader-muted)]">
                {{ String(stageStarts[index] + offset).padStart(2, '0') }}
              </span>
              <span class="reader-display min-w-0 flex-1 text-[15px] leading-relaxed">{{ item.title }}</span>
              <span aria-hidden="true" class="ml-auto shrink-0 text-sm text-[var(--reader-accent)]">↗</span>
            </NuxtLink>
          </li>
        </ul>
      </section>
    </div>
  </dialog>
</template>

<style scoped>
.learning-path-dialog {
  width: min(54rem, calc(100% - 2rem));
  max-height: min(44rem, calc(100dvh - 2rem));
}

.learning-path-dialog::backdrop {
  background: rgb(27 21 16 / 61%);
}
</style>
