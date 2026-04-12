/**
 * useToc — 文章目录（Table of Contents）
 *
 * 用法：
 *   const articleRef = ref<HTMLElement | null>(null)
 *   const { headings, activeId } = useToc(renderedHtml, articleRef)
 *
 * - headings：从 HTML 字符串解析出的 h2/h3 标题列表（SSR 安全）
 * - activeId：当前滚动到的标题 id（客户端 IntersectionObserver 驱动）
 */
export interface TocHeading {
  id: string
  text: string
  level: 2 | 3
}

export function useToc(
  contentHtml: Ref<string>,
  articleRef: Ref<HTMLElement | null>,
) {
  // ── 从 HTML 字符串解析标题（SSR 安全，无需 DOM）──────────────────────────
  const headings = computed<TocHeading[]>(() => {
    const result: TocHeading[] = []
    const regex = /<h([23])[^>]*\sid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/gi
    let match: RegExpExecArray | null
    // eslint-disable-next-line no-cond-assign
    while ((match = regex.exec(contentHtml.value)) !== null) {
      result.push({
        level: parseInt(match[1]) as 2 | 3,
        id: match[2],
        // 去掉内联 HTML 标签（如 <code>）
        text: match[3].replace(/<[^>]+>/g, '').trim(),
      })
    }
    return result
  })

  // ── 当前高亮的标题 id（客户端专用）──────────────────────────────────────
  const activeId = ref('')

  if (import.meta.client) {
    let observer: IntersectionObserver | null = null

    const setup = () => {
      observer?.disconnect()
      const article = articleRef.value
      if (!article) return

      const els = Array.from(article.querySelectorAll<HTMLElement>('h2[id], h3[id]'))
      if (els.length === 0) return

      // 顶部留 80px（固定导航高度），底部留 60% 屏高，确保标题进入视口上方时触发
      observer = new IntersectionObserver(
        (entries) => {
          // 找到最靠近顶部且正在可见的标题
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
          if (visible.length > 0) {
            activeId.value = (visible[0].target as HTMLElement).id
          }
        },
        {
          rootMargin: '-80px 0px -60% 0px',
          threshold: 0,
        },
      )
      els.forEach((el) => observer!.observe(el))
    }

    onMounted(() => {
      // 等待 v-html 渲染完成后再查询 DOM
      nextTick(setup)
    })

    // 文章内容切换时重新绑定
    watch(contentHtml, () => nextTick(setup))

    onUnmounted(() => observer?.disconnect())
  }

  return { headings, activeId }
}
