<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()

const navItems = [
  {
    to: '/admin',
    label: '概览',
    icon: 'M4 13h6V4H4v9zm0 7h6v-4H4v4zm10 0h6V11h-6v9zm0-16v4h6V4h-6z',
  },
  {
    to: '/admin/posts',
    label: '文章',
    icon: 'M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1zM8 9h8M8 13h8M8 17h5',
  },
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

<template>
  <div class="min-h-screen bg-white dark:bg-ink-900">
    <!-- 侧边栏 -->
    <aside
      class="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-slate-200/80
             bg-white dark:border-ink-700 dark:bg-ink-850"
    >
      <!-- 品牌 -->
      <div class="flex h-16 items-center px-6">
        <NuxtLink to="/admin" class="flex items-center gap-2.5">
          <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 dark:bg-white">
            <svg class="h-3.5 w-3.5 text-white dark:text-ink-850" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5V6a2 2 0 012-2h12a2 2 0 012 2v13.5M8 8h8M8 12h5" />
            </svg>
          </span>
          <span class="text-sm font-semibold tracking-tight text-slate-900 dark:text-ink-50">
            {{ config.public.siteName }}
          </span>
        </NuxtLink>
      </div>

      <!-- 导航 -->
      <nav class="flex-1 space-y-0.5 px-3 py-4">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors"
          :class="isActive(item.to)
            ? 'bg-slate-100 text-slate-900 dark:bg-ink-700 dark:text-ink-50'
            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-ink-300 dark:hover:bg-ink-700/60 dark:hover:text-ink-50'"
        >
          <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <path :d="item.icon" />
          </svg>
          {{ item.label }}
        </NuxtLink>
      </nav>

      <!-- 底部 -->
      <div class="border-t border-slate-100 p-3 dark:border-ink-700">
        <NuxtLink
          to="/"
          target="_blank"
          class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-slate-500
                 transition-colors hover:bg-slate-50 hover:text-slate-900
                 dark:text-ink-300 dark:hover:bg-ink-700/60 dark:hover:text-ink-50"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 4h6v6M20 4l-9 9M10 4H5a1 1 0 00-1 1v14a1 1 0 001 1h14a1 1 0 001-1v-5" />
          </svg>
          查看博客
        </NuxtLink>
        <button
          type="button"
          class="mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-slate-500
                 transition-colors hover:bg-slate-50 hover:text-red-600
                 dark:text-ink-300 dark:hover:bg-ink-700/60 dark:hover:text-red-400"
          @click="logout"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 17l5-5-5-5M20 12H9M12 4H6a2 2 0 00-2 2v12a2 2 0 002 2h6" />
          </svg>
          退出登录
        </button>
      </div>
    </aside>

    <!-- 主内容 -->
    <div class="ml-60">
      <main class="mx-auto max-w-5xl px-10 py-12">
        <slot />
      </main>
    </div>
  </div>
</template>
