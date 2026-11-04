<template>
  <div>
    <PostForm mode="create" :loading="saving" @submit="handleCreate" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false, middleware: 'admin' })

const postsApi = usePostsApi()
const router = useRouter()
const saving = ref(false)

async function handleCreate(formData: any) {
  saving.value = true
  try {
    const post = await postsApi.create(formData)
    // 创建成功后进入编辑态，避免打断写作心流
    await router.replace(`/admin/posts/${post.id}`)
  } catch (e: any) {
    alert(e?.data?.message || '创建失败')
  } finally {
    saving.value = false
  }
}
</script>
