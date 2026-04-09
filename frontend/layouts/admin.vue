<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
    <!-- Sidebar -->
    <aside class="w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col fixed inset-y-0 left-0 z-30">
      <div class="h-14 flex items-center px-5 border-b border-gray-200 dark:border-gray-700">
        <NuxtLink to="/" class="text-sm font-semibold text-primary-600 dark:text-primary-400">← 返回前台</NuxtLink>
      </div>
      <nav class="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          :class="isActive(item.to)
            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
        >
          <span class="text-base">{{ item.icon }}</span>
          {{ item.label }}
        </NuxtLink>
      </nav>
      <div class="p-4 border-t border-gray-200 dark:border-gray-700">
        <button
          @click="logout"
          class="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors text-left px-3 py-2"
        >
          退出登录
        </button>
      </div>
    </aside>

    <!-- Main content -->
    <div class="ml-56 flex-1 flex flex-col min-h-screen">
      <header class="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-6 sticky top-0 z-20">
        <h1 class="text-base font-semibold text-gray-800 dark:text-gray-100">博客管理后台</h1>
      </header>
      <main class="flex-1 p-6">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const navItems = [
  { to: '/admin', icon: '📊', label: '仪表盘' },
  { to: '/admin/posts', icon: '📝', label: '文章管理' },
  { to: '/admin/tags', icon: '🏷️', label: '标签管理' },
]

function isActive(path: string) {
  if (path === '/admin') return route.path === '/admin'
  return route.path.startsWith(path)
}

function logout() {
  useCookie('admin_token').value = null
  router.push('/admin/login')
}
</script>
