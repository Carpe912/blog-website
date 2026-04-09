<script setup lang="ts">
definePageMeta({ layout: 'default' })

const config = useRuntimeConfig()
const route = useRoute()
const router = useRouter()

// 当前标签（来自 URL 参数 /tags/xxx 或查询参数 ?tag=xxx）
const currentTag = computed(() =>
  (route.params.tag as string) ? decodeURIComponent(route.params.tag as string) : null
)

// 所有文章
const { data: allPosts } = await useAsyncData('all-posts-tags', () =>
  queryContent('/posts')
    .sort({ date: -1 })
    .only(['_path', 'title', 'date', 'tags', 'excerpt', 'cover'])
    .find()
)

// 所有标签（带计数）
const allTags = computed(() => {
  const map = new Map<string, number>()
  for (const post of allPosts.value ?? []) {
    for (const tag of (post.tags ?? [])) {
      map.set(tag, (map.get(tag) ?? 0) + 1)
    }
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count }))
})

// 当前标签下的文章
const filteredPosts = computed(() =>
  currentTag.value
    ? (allPosts.value ?? []).filter(p => p.tags?.includes(currentTag.value!))
    : (allPosts.value ?? [])
)

useSeoMeta({
  title: currentTag.value
    ? `标签「${currentTag.value}」· ${config.public.siteName}`
    : `所有标签 · ${config.public.siteName}`,
  description: `${config.public.siteName} 的文章标签页`,
})

function postUrl(path: string) {
  return `/blog/${path.replace(/^\/posts\//, '')}`
}

function formattedDate(date: string) {
  return new Date(date).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-12">

    <!-- 页头 -->
    <div class="mb-10">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2">
        {{ currentTag ? `「${currentTag}」` : '所有标签' }}
      </h1>
      <p class="text-gray-500 dark:text-slate-400 text-sm">
        {{ currentTag ? `共 ${filteredPosts.length} 篇文章` : `共 ${allTags.length} 个标签，${allPosts?.length} 篇文章` }}
      </p>
    </div>

    <!-- 标签云 -->
    <div class="mb-10 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm dark:bg-slate-900 dark:border-slate-800">
      <p class="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-4">标签云</p>
      <div class="flex flex-wrap gap-2">
        <NuxtLink
          to="/tags"
          class="tag-pill-lg transition-all"
          :class="!currentTag ? 'bg-primary-600 text-white border-primary-600 dark:border-primary-500' : ''"
        >
          全部 <span class="ml-1 opacity-70 text-xs">{{ allPosts?.length }}</span>
        </NuxtLink>
        <NuxtLink
          v-for="{ tag, count } in allTags"
          :key="tag"
          :to="`/tags/${encodeURIComponent(tag)}`"
          class="tag-pill-lg transition-all"
          :class="currentTag === tag ? 'bg-primary-600 text-white border-primary-600 dark:border-primary-500' : ''"
        >
          {{ tag }} <span class="ml-1 opacity-60 text-xs">{{ count }}</span>
        </NuxtLink>
      </div>
    </div>

    <!-- 文章列表 -->
    <div v-if="filteredPosts.length" class="space-y-4">
      <NuxtLink
        v-for="post in filteredPosts"
        :key="post._path"
        :to="postUrl(post._path)"
        class="group flex items-start gap-4 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-primary-200 hover:shadow-md dark:bg-slate-900 dark:border-slate-800 dark:hover:border-primary-800 transition-all"
      >
        <!-- 日期竖线 -->
        <div class="shrink-0 text-center w-14 pt-0.5">
          <p class="text-lg font-bold text-primary-600 dark:text-primary-400 leading-none">
            {{ new Date(post.date).getDate() }}
          </p>
          <p class="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
            {{ new Date(post.date).toLocaleDateString('zh-CN', { month: 'short', year: 'numeric' }) }}
          </p>
        </div>

        <div class="w-px self-stretch bg-gray-100 dark:bg-slate-800 shrink-0" />

        <!-- 文章信息 -->
        <div class="flex-1 min-w-0">
          <h2 class="font-semibold text-gray-900 dark:text-slate-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-1 mb-1.5">
            {{ post.title }}
          </h2>
          <p v-if="post.excerpt" class="text-sm text-gray-500 dark:text-slate-400 line-clamp-1 mb-2">
            {{ post.excerpt }}
          </p>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="tag in post.tags?.slice(0, 4)"
              :key="tag"
              class="tag-pill"
              :class="tag === currentTag ? 'bg-primary-100 border-primary-200 dark:bg-primary-950 dark:border-primary-800' : ''"
            >
              {{ tag }}
            </span>
          </div>
        </div>

        <svg class="w-5 h-5 text-gray-300 dark:text-slate-600 group-hover:text-primary-400 shrink-0 self-center transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </NuxtLink>
    </div>

    <!-- 空状态 -->
    <div v-else class="text-center py-20 text-gray-400 dark:text-slate-500">
      <p class="text-lg font-medium">该标签下暂无文章</p>
    </div>

  </div>
</template>
