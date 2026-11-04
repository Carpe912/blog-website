<template>
  <div>
    <PostForm
      v-if="post"
      mode="edit"
      :initial="post"
      :loading="saving"
      @submit="handleUpdate"
    />
    <div v-else class="flex min-h-screen items-center justify-center text-sm text-slate-400">
      加载中…
    </div>

    <!-- 保存提示 -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="translate-y-2 opacity-0"
    >
      <div
        v-if="savedTip"
        class="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2
               text-xs text-white shadow-lg dark:bg-white dark:text-slate-900"
      >
        已保存
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false, middleware: 'admin' })

const route = useRoute()
const postsApi = usePostsApi()
const saving = ref(false)
const savedTip = ref(false)
const post = ref<any>(null)

const id = Number(route.params.id)

try {
  post.value = await postsApi.get(id)
} catch {
  await navigateTo('/admin/posts')
}

async function handleUpdate(formData: any) {
  saving.value = true
  try {
    post.value = await postsApi.update(id, formData)
    savedTip.value = true
    setTimeout(() => (savedTip.value = false), 1600)
  } catch (e: any) {
    alert(e?.data?.message || '更新失败')
  } finally {
    saving.value = false
  }
}
</script>
