<template>
  <div class="max-w-3xl">
    <div class="flex items-center gap-3 mb-6">
      <NuxtLink to="/admin/posts" class="text-gray-400 hover:text-gray-600 text-sm">← 返回列表</NuxtLink>
      <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100">编辑文章</h2>
    </div>
    <div v-if="pending" class="text-gray-400 py-10 text-center">加载中...</div>
    <PostForm
      v-else
      :initial="post"
      :tags="allTags"
      :loading="saving"
      @submit="handleUpdate"
    />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const route = useRoute()
const router = useRouter()
const postsApi = usePostsApi()
const tagsApi = useTagsApi()
const saving = ref(false)
const post = ref<any>(null)
const allTags = ref<any[]>([])
const pending = ref(true)

const id = Number(route.params.id)

const [postRes, tagsRes] = await Promise.all([postsApi.get(id), tagsApi.list()])
post.value = postRes
allTags.value = tagsRes
pending.value = false

async function handleUpdate(formData: any) {
  saving.value = true
  try {
    await postsApi.update(id, formData)
    router.push('/admin/posts')
  } catch (e: any) {
    alert(e?.data?.message || '更新失败')
  } finally {
    saving.value = false
  }
}
</script>
