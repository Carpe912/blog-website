/**
 * 首屏主题：只跟随系统
 * 尽早写入 html.dark，避免深色模式下的白屏闪烁。
 * 手动切换已移除，本地不再保存主题偏好。
 */
;(function () {
  try {
    var dark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', dark)
  } catch (e) {
    /* ignore */
  }
})()
