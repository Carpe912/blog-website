<script setup lang="ts">
definePageMeta({ layout: 'default' })

const config = useRuntimeConfig()
const tagsApi = useTagsApi()

useSeoMeta({
  title: `所有标签 · ${config.public.siteName}`,
})

const tags = await tagsApi.list() as any[]
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-12">
    <div class="mb-8">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100 mb-1">所有标签</h1>
      <p class="text-gray-500 dark:text-slate-400 text-sm">共 {{ tags.length }} 个标签</p>
    </div>

    <div class="flex flex-wrap gap-3">
      <NuxtLink
        v-for="tag in tags"
        :key="tag.id"
        :to="`/tags/${encodeURIComponent(tag.name)}`"
        class="group flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-primary-200 hover:bg-primary-50 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-primary-800 dark:hover:bg-primary-950/40 transition-all"
      >
        <span class="font-medium text-gray-800 dark:text-slate-200 group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">{{ tag.name }}</span>
        <span class="text-xs bg-gray-100 group-hover:bg-primary-100 text-gray-500 group-hover:text-primary-600 dark:bg-slate-800 dark:group-hover:bg-primary-900/50 dark:text-slate-400 dark:group-hover:text-primary-300 px-2 py-0.5 rounded-full transition-colors font-medium">
          {{ tag._count ? tag._count.posts : 0 }}
        </span>
      </NuxtLink>
    </div>
  </div>
</template>
