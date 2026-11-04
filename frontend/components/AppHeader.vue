<script setup lang="ts">
const config = useRuntimeConfig()

// 仅保留主题切换，导航交给内容本身
</script>

<template>
  <header
    class="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-md
           dark:border-slate-800/80 dark:bg-slate-950/80"
  >
    <div class="mx-auto flex h-14 max-w-4xl items-center justify-between px-6 sm:px-8">
      <!-- 品牌 -->
      <NuxtLink to="/" class="group flex items-center gap-2.5">
        <span class="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 dark:bg-white">
          <svg class="h-3 w-3 text-white dark:text-slate-900" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5V6a2 2 0 012-2h12a2 2 0 012 2v13.5M8 8h8M8 12h5" />
          </svg>
        </span>
        <span class="text-[13.5px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {{ config.public.siteName }}
        </span>
      </NuxtLink>

      <div class="flex items-center gap-1">
        <NuxtLink
          to="/"
          class="hidden rounded-md px-2.5 py-1.5 text-[13px] font-medium text-slate-500 transition-colors
                 hover:bg-slate-100 hover:text-slate-900 sm:inline-flex
                 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          文章
        </NuxtLink>
        <ThemeToggle />
      </div>
    </div>
  </header>
</template>
