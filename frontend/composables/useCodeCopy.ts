/**
 * useCodeCopy — 为代码块注入「复制」按钮
 *
 * 在客户端 mounted 后，找到所有 .code-block-wrapper，
 * 读取其 data-lang 属性显示语言标签，并注入复制按钮。
 *
 * 用法：
 *   const articleRef = ref<HTMLElement | null>(null)
 *   useCodeCopy(articleRef)
 */
export function useCodeCopy(articleRef: Ref<HTMLElement | null>) {
  if (!import.meta.client) return

  const inject = () => {
    const article = articleRef.value
    if (!article) return

    article.querySelectorAll<HTMLElement>('.code-block-wrapper').forEach((wrapper) => {
      // 避免重复注入
      if (wrapper.querySelector('.code-toolbar')) return

      const lang = wrapper.dataset.lang ?? ''
      const pre  = wrapper.querySelector('pre')
      const code = wrapper.querySelector('code')
      if (!pre || !code) return

      // 工具栏容器
      const toolbar = document.createElement('div')
      toolbar.className = 'code-toolbar'

      // 语言标签
      if (lang && lang !== 'plaintext') {
        const label = document.createElement('span')
        label.className = 'code-lang'
        label.textContent = lang
        toolbar.appendChild(label)
      }

      // 复制按钮
      const btn = document.createElement('button')
      btn.className = 'code-copy-btn'
      btn.textContent = '复制'
      btn.setAttribute('aria-label', '复制代码')

      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(code.textContent ?? '')
          btn.textContent = '✓ 已复制'
          btn.classList.add('copied')
          setTimeout(() => {
            btn.textContent = '复制'
            btn.classList.remove('copied')
          }, 2000)
        } catch {
          // 降级：选中文本
          const range = document.createRange()
          range.selectNodeContents(code)
          window.getSelection()?.removeAllRanges()
          window.getSelection()?.addRange(range)
          btn.textContent = '已选中'
          setTimeout(() => { btn.textContent = '复制' }, 2000)
        }
      })

      toolbar.appendChild(btn)
      wrapper.insertBefore(toolbar, pre)
    })
  }

  onMounted(() => nextTick(inject))
  // 文章路由切换时重新注入
  watch(articleRef, () => nextTick(inject))
}
