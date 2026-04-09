<script setup lang="ts">
const config = useRuntimeConfig()
const route = useRoute()

const isActive = (path: string) => route.path === path

const navLinks = [
  { label: '首页', to: '/' },
  { label: '标签', to: '/tags' },
  { label: '关于', to: '/about' },
]

// 移动端菜单
const mobileOpen = ref(false)
watch(() => route.path, () => { mobileOpen.value = false })
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/95">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 h-[3.25rem] flex items-center justify-between gap-4">

      <!-- Logo / 站点名 -->
      <NuxtLink to="/" class="flex items-center gap-2.5 shrink-0 group">
        <div class="w-7 h-7 rounded border border-slate-300 bg-slate-50 flex items-center justify-center dark:border-slate-600 dark:bg-slate-900">
          <svg class="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <span class="font-semibold text-slate-900 dark:text-slate-100 text-base tracking-tight">{{ config.public.siteName }}</span>
      </NuxtLink>

      <div class="flex items-center gap-1 sm:gap-2">
        <!-- 桌面端导航 -->
        <nav class="hidden sm:flex items-center gap-1">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="px-3 py-1.5 rounded text-sm font-medium transition-colors"
            :class="isActive(link.to)
              ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/80'"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>

        <ThemeToggle />

        <!-- 移动端汉堡按钮 -->
        <button
          class="sm:hidden p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          :aria-label="mobileOpen ? '关闭菜单' : '打开菜单'"
          @click="mobileOpen = !mobileOpen"
        >
          <svg class="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path v-if="!mobileOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 移动端菜单 -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div v-if="mobileOpen" class="sm:hidden border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 pb-4 pt-2 space-y-1">
        <NuxtLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="block px-4 py-2.5 rounded text-sm font-medium transition-colors"
          :class="isActive(link.to)
            ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
            : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'"
        >
          {{ link.label }}
        </NuxtLink>
      </div>
    </Transition>
  </header>
</template>
