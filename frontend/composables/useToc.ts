/**
 * useToc — 文章目录（Table of Contents）
 *
 * 用法：
 *   const articleRef = ref<HTMLElement | null>(null)
 *   const { headings, activeId } = useToc(renderedHtml, articleRef)
 *
 * - headings：从 HTML 字符串解析出的 h1/h2/h3 标题列表（SSR 安全）
 * - activeId：当前滚动到的标题 id（客户端 IntersectionObserver 驱动）
 */
export const DEFAULT_TOC_WIDTH = 408

export interface TocHeading {
  id: string
  text: string
  level: 1 | 2 | 3
}

/**
 * h1 是否值得进目录。
 *
 * 编辑器里有不少 h1 其实是图表标签或示例数据（"U+4E2D"、"50K"、"😀"），
 * 一律收进目录会把侧栏撑满噪音，所以只保留"像标题"的：
 *  - 含中文且不短于 6 个字，或
 *  - 足够长的纯英文标题（>= 12 字符）
 */
function isTocHeading1(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  const hasCjk = /[\u4e00-\u9fa5]/.test(t)
  return hasCjk ? t.length >= 6 : t.length >= 12
}

export function useToc(
  contentHtml: Ref<string>,
  articleRef: Ref<HTMLElement | null>,
) {
  // ── 从 HTML 字符串解析标题（SSR 安全，无需 DOM）──────────────────────────
  const headings = computed<TocHeading[]>(() => {
    const result: TocHeading[] = []
    const regex = /<h([123])[^>]*\sid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/gi
    let match: RegExpExecArray | null
    // eslint-disable-next-line no-cond-assign
    while ((match = regex.exec(contentHtml.value)) !== null) {
      const level = parseInt(match[1]) as 1 | 2 | 3
      // 去掉内联 HTML 标签（如 <code>）
      const text = match[3].replace(/<[^>]+>/g, '').trim()
      if (level === 1 && !isTocHeading1(text)) continue
      result.push({ level, id: match[2], text })
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

      const els = Array.from(article.querySelectorAll<HTMLElement>('h1[id], h2[id], h3[id]'))
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
