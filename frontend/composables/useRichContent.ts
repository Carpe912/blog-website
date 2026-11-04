/**
 * useRichContent — 富文本（HTML）内容预处理
 *
 * 后台富文本编辑器直接保存 HTML，前台渲染前需要做两件事：
 *  1. 给 h1~h3 补上 id，供目录锚点跳转
 *  2. 把 <pre><code> 包装成 .code-block-wrapper，复用代码块工具栏与复制按钮
 */
export function useRichContent() {
  function slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\u4e00-\u9fa5-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80)
  }

  /** 提取纯文本，用于阅读时长、摘要兜底 */
  function toPlainText(html: string): string {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function render(html: string): string {
    if (!html) return ''

    // 1. 代码块：补齐 wrapper 与语言标记
    let out = html.replace(
      /<pre([^>]*)>\s*<code([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi,
      (_m, _preAttrs, codeAttrs, body) => {
        const langMatch = String(codeAttrs).match(/language-([\w-]+)/i)
        const lang = langMatch?.[1] ?? 'plaintext'
        return `<div class="code-block-wrapper" data-lang="${lang}"><pre><code class="hljs language-${lang}">${body}</code></pre></div>`
      },
    )

    // 2. 标题：补 id（已存在则跳过）
    out = out.replace(
      /<h([1-3])([^>]*)>([\s\S]*?)<\/h\1>/gi,
      (match, level, attrs, inner) => {
        if (/\sid=/.test(attrs)) return match
        const text = String(inner).replace(/<[^>]+>/g, '').trim()
        const id = slugify(text) || `heading-${level}`
        return `<h${level} id="${id}"${attrs}>${inner}</h${level}>`
      },
    )

    return out
  }

  return { render, toPlainText, slugify }
}
