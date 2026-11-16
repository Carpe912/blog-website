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
               text-xs text-white shadow-lg dark:bg-white dark:text-ink-850"
      >
        已保存
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
// 后台页面统一关闭页面过渡：编辑器用 layout: false，切到/切回 admin 布局时
// 过渡动画包裹的元素会被父级结构变化替换掉，导致离开动画收不到结束回调，
// 旧页面 DOM 残留，表现为列表和编辑器同时出现在屏幕上。
definePageMeta({ layout: false, middleware: 'admin', pageTransition: false })

const route = useRoute()
const postsApi = usePostsApi()
const saving = ref(false)
const savedTip = ref(false)
const post = ref<any>(null)

const id = Number(route.params.id)

// 不在 setup 顶层 await：顶层 await 会让整个页面进入 Suspense 挂起状态，
// 挂起期间旧页面的 DOM 一直留在文档里，一旦这期间发生布局切换或再次导航，
// 就会卡成两页叠加。改为挂载后取数，页面立刻渲染骨架，不存在挂起窗口。
onMounted(async () => {
  try {
    post.value = await postsApi.get(id)
  } catch {
    await navigateTo('/admin/posts')
  }
})

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
