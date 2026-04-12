<script setup lang="ts">
import { ref, onMounted, onUnmounted } from '#imports'
const config = useRuntimeConfig()
const year = new Date().getFullYear()

const visible = ref(false)

onMounted(() => {
  const onScroll = () => { visible.value = window.scrollY > 80 }
  window.addEventListener('scroll', onScroll, { passive: true })
  onUnmounted(() => window.removeEventListener('scroll', onScroll))
})
</script>

<template>
  <footer
    class="fixed bottom-0 inset-x-0 z-10 pointer-events-none"
  >
    <Transition name="footer-fade">
      <div
        v-if="visible"
        class="pointer-events-auto border-t border-slate-200 bg-white/80 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/80"
      >
        <div class="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2">

          <!-- 左：站点信息 -->
          <p class="font-medium text-sm text-slate-700 dark:text-slate-300">{{ config.public.siteName }}</p>

          <!-- 右：链接 + 版权 -->
          <div class="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
            <nav class="flex items-center gap-3">
              <NuxtLink to="/" class="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">首页</NuxtLink>
              <NuxtLink to="/tags" class="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">标签</NuxtLink>
            </nav>
            <span class="text-slate-300 dark:text-slate-700">|</span>
            <span>© {{ year }} {{ config.public.author }}</span>
          </div>

        </div>
      </div>
    </Transition>
  </footer>
</template>

<style scoped>
.footer-fade-enter-active,
.footer-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.footer-fade-enter-from,
.footer-fade-leave-to {
  opacity: 0;
  transform: translateY(100%);
}
</style>
