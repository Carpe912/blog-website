<script setup lang="ts">
import type { ArticleSeries } from '~/utils/articleSeries'

defineProps<{ series: ArticleSeries }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement | null>(null)

onMounted(() => dialog.value?.showModal())

function closeOnBackdrop(event: MouseEvent) {
  if (event.target === dialog.value) dialog.value?.close()
}
</script>

<template>
  <dialog
    id="article-series-dialog"
    ref="dialog"
    aria-labelledby="article-series-title"
    aria-describedby="article-series-count"
    class="series-dialog overflow-hidden rounded-2xl border border-[var(--reader-line)] bg-[var(--reader-paper)] p-0 text-[var(--reader-ink)] shadow-2xl open:flex open:flex-col"
    @close="emit('close')"
    @click="closeOnBackdrop"
  >
    <header class="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--reader-line)] bg-[var(--reader-surface)] p-4 sm:p-5">
      <div class="min-w-0">
        <p id="article-series-count" class="mb-1 text-sm font-medium tabular-nums text-[var(--reader-accent)]">{{ series.count }} 篇文章</p>
        <h2 id="article-series-title" class="reader-display text-xl font-bold leading-snug sm:text-2xl">{{ series.title }}</h2>
      </div>
      <button
        type="button"
        aria-label="关闭系列目录"
        autofocus
        class="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-[var(--reader-line)] bg-[var(--reader-paper)] text-2xl leading-none transition-colors hover:text-[var(--reader-accent)]"
        @click="dialog?.close()"
      >
        <span aria-hidden="true">×</span>
      </button>
    </header>
    <div class="min-h-0 overflow-y-auto overscroll-contain px-4 pb-3 sm:px-5" aria-label="系列文章目录" role="region">
      <section v-for="section in series.sections" :key="section.topic" class="mt-3">
        <h3 v-if="section.topic" class="mb-1 text-xs font-semibold tracking-wide text-[var(--reader-muted)]">{{ section.topic }}</h3>
        <ul class="divide-y divide-[var(--reader-line)]">
          <li v-for="chapter in section.chapters" :key="chapter.post.id">
            <NuxtLink
              :to="`/blog/${chapter.post.slug}`"
              :prefetch="false"
              class="group flex min-h-11 items-baseline gap-2.5 rounded-sm px-0.5 py-2.5 hover:bg-[var(--reader-surface)] hover:text-[var(--reader-accent)]"
            >
              <span v-if="chapter.number" class="w-[5ch] shrink-0 text-xs tabular-nums text-[var(--reader-muted)]">
                {{ String(chapter.number).padStart(2, '0') }}<template v-if="chapter.total">/{{ chapter.total }}</template>
              </span>
              <span class="reader-display min-w-0 flex-1 text-[15px] leading-relaxed">{{ chapter.post.title }}</span>
              <span aria-hidden="true" class="ml-auto shrink-0 text-sm text-[var(--reader-accent)]">↗</span>
            </NuxtLink>
          </li>
        </ul>
      </section>
    </div>
  </dialog>
</template>

<style scoped>
.series-dialog {
  width: min(39rem, calc(100% - 2rem));
  max-height: min(36rem, calc(100dvh - 2rem));
}

.series-dialog::backdrop {
  background: rgb(27 21 16 / 61%);
}
</style>
