/**
 * 主题：始终跟随系统
 *
 * 不再提供手动切换按钮，颜色模式完全由 prefers-color-scheme 决定。
 * 首屏的 class 由 public/theme-init.js 在 <head> 里先行设置（避免闪烁），
 * 这里负责系统主题变化时同步，并把历史遗留的本地偏好清掉。
 */
export default defineNuxtPlugin(() => {
  try {
    localStorage.removeItem('nuxt-blog-theme')
  } catch {
    /* 隐私模式下 localStorage 可能不可用，忽略 */
  }

  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const apply = () => document.documentElement.classList.toggle('dark', mq.matches)

  apply()
  mq.addEventListener('change', apply)
})
