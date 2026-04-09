;(function () {
  try {
    var k = 'nuxt-blog-theme'
    var t = localStorage.getItem(k)
    var dark = false
    if (t === 'dark') dark = true
    else if (t === 'light') dark = false
    else dark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', dark)
  } catch (e) {
    /* ignore */
  }
})()
