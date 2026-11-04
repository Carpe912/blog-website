<template>
  <div>
    <!-- 页头 -->
    <div class="flex items-end justify-between gap-6 pb-8">
      <div>
        <h1 class="text-[1.35rem] font-semibold tracking-tight text-slate-900 dark:text-ink-50">
          概览
        </h1>
        <p class="mt-1 text-[13px] text-slate-400 dark:text-ink-400">
          {{ greeting }}
        </p>
      </div>
      <NuxtLink to="/admin/posts/new" class="btn-solid">
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
          stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
        写文章
      </NuxtLink>
    </div>

    <!-- 数据 -->
    <div class="grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-slate-200/70 dark:bg-ink-700">
      <div
        v-for="item in stats"
        :key="item.label"
        class="bg-white px-6 py-6 dark:bg-ink-850"
      >
        <div class="text-[1.75rem] font-semibold leading-none tracking-tight text-slate-900 dark:text-ink-50 tabular-nums">
          {{ item.value }}
        </div>
        <div class="mt-2.5 text-[12px] font-medium text-slate-400 dark:text-ink-400">
          {{ item.label }}
        </div>
      </div>
    </div>

    <!-- 最近文章 -->
    <section class="mt-12">
      <div class="flex items-center justify-between pb-3">
        <h2 class="text-[13px] font-semibold uppercase tracking-wider text-slate-400 dark:text-ink-400">
          最近编辑
        </h2>
        <NuxtLink to="/admin/posts" class="text-[13px] text-slate-500 hover:text-slate-900 dark:text-ink-300 dark:hover:text-ink-100">
          全部文章 →
        </NuxtLink>
      </div>

      <ul v-if="recent.length" class="divide-y divide-slate-100 border-t border-slate-200/80 dark:divide-ink-700 dark:border-ink-700">
        <li v-for="post in recent" :key="post.id">
          <NuxtLink
            :to="`/admin/posts/${post.id}`"
            class="group flex items-center gap-4 py-4"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-[14px] font-medium text-slate-700 transition-colors group-hover:text-slate-950 dark:text-ink-200 dark:group-hover:text-ink-50">
                {{ post.title }}
              </p>
              <p class="mt-0.5 text-[11px] text-slate-400 dark:text-ink-400 tabular-nums">
                {{ formatDate(post.updatedAt) }}
                <span class="mx-1.5 text-slate-300 dark:text-ink-600">·</span>
                {{ post.published ? '已发布' : '草稿' }}
              </p>
            </div>
            <svg class="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5
                      group-hover:text-slate-500 dark:text-ink-500" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </NuxtLink>
        </li>
      </ul>

      <div
        v-else
        class="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-20 text-center dark:border-ink-700"
      >
        <p class="text-sm font-medium text-slate-500 dark:text-ink-300">还没有文章</p>
        <p class="mt-1 text-[13px] text-slate-400 dark:text-ink-400">写下第一篇，从这里开始</p>
        <NuxtLink to="/admin/posts/new" class="btn-solid mt-5">开始写作</NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const postsApi = usePostsApi()

const stats = reactive([
  { label: '全部文章', value: 0 },
  { label: '已发布', value: 0 },
  { label: '草稿', value: 0 },
])

const recent = ref<any[]>([])

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了，注意休息'
  if (h < 12) return '上午好，今天写点什么'
  if (h < 18) return '下午好，继续创作'
  return '晚上好，记录今天'
})

const [allRes, publishedRes, recentRes] = await Promise.all([
  postsApi.list({ limit: 1 }),
  postsApi.list({ published: 'true', limit: 1 }),
  postsApi.list({ limit: 5 }),
])

stats[0].value = (allRes as any).meta?.total ?? 0
stats[1].value = (publishedRes as any).meta?.total ?? 0
stats[2].value = stats[0].value - stats[1].value
recent.value = (recentRes as any).data ?? []

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}
</script>

<style scoped>
.btn-solid {
  @apply inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-[13px] font-medium
         text-white transition-all hover:bg-slate-800 active:scale-[0.98]
         dark:bg-white dark:text-ink-850 dark:hover:bg-ink-100;
}
</style>
