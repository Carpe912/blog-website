<template>
  <div>
    <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">仪表盘</h2>
    <div class="grid grid-cols-2 gap-4 mb-8">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <div class="text-3xl font-bold text-primary-600">{{ stats.posts }}</div>
        <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">文章总数</div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <div class="text-3xl font-bold text-emerald-600">{{ stats.published }}</div>
        <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">已发布</div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <div class="text-3xl font-bold text-amber-600">{{ stats.drafts }}</div>
        <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">草稿</div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <div class="text-3xl font-bold text-violet-600">{{ stats.tags }}</div>
        <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">标签总数</div>
      </div>
    </div>

    <div class="flex gap-3">
      <NuxtLink to="/admin/posts/new" class="btn-primary text-sm">+ 新建文章</NuxtLink>
      <NuxtLink to="/admin/posts" class="btn-secondary text-sm">管理文章</NuxtLink>
      <NuxtLink to="/admin/tags" class="btn-secondary text-sm">管理标签</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const postsApi = usePostsApi()
const tagsApi = useTagsApi()

const stats = reactive({ posts: 0, published: 0, drafts: 0, tags: 0 })

const [postsRes, allRes, tagsRes] = await Promise.all([
  postsApi.list({ limit: 1 }),
  postsApi.list({ published: 'true', limit: 1 }),
  tagsApi.list(),
])

stats.posts = (postsRes as any).meta?.total ?? 0
stats.published = (allRes as any).meta?.total ?? 0
stats.drafts = stats.posts - stats.published
stats.tags = Array.isArray(tagsRes) ? tagsRes.length : 0
</script>
