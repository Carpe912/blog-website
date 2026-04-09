<template>
  <div class="max-w-3xl">
    <div class="flex items-center gap-3 mb-6">
      <NuxtLink to="/admin/posts" class="text-gray-400 hover:text-gray-600 text-sm">← 返回列表</NuxtLink>
      <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100">新建文章</h2>
    </div>
    <PostForm :tags="allTags" :loading="saving" @submit="handleCreate" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const postsApi = usePostsApi()
const tagsApi = useTagsApi()
const router = useRouter()
const saving = ref(false)
const allTags = ref<any[]>([])

allTags.value = await tagsApi.list()

async function handleCreate(formData: any) {
  saving.value = true
  try {
    await postsApi.create(formData)
    router.push('/admin/posts')
  } catch (e: any) {
    alert(e?.data?.message || '创建失败')
  } finally {
    saving.value = false
  }
}
</script>
