/**
 * useRichContent — 富文本（HTML）内容预处理
 *
 * 后台富文本编辑器直接保存 HTML，前台渲染前需要做三件事：
 *  1. 给 h1~h3 补上 id，供目录锚点跳转
 *  2. 给代码块做服务端语法高亮（内容里可能只有纯文本，编辑器不一定带 hljs 标记）
 *  3. 把 <pre><code> 包装成 .code-block-wrapper，复用代码块工具栏与复制按钮
 */
import hljs from 'highlight.js/lib/common'

/** 语言别名 → highlight.js 语言名 */
const LANG_ALIAS: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  md: 'markdown',
  py: 'python',
  html: 'xml',
  vue: 'xml',
  svg: 'xml',
  txt: 'plaintext',
  text: 'plaintext',
  plain: 'plaintext',
  plaintext: 'plaintext',
}

/** 仅转义，不做高亮 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** 编辑器输出的是 HTML 实体，高亮前先还原成源码 */
function decodeEntities(html: string): string {
  return html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

/** 用 highlight.js 生成带 hljs-* 类名的 HTML */
function highlightCode(raw: string, rawLang: string): string {
  // 内容里已经有 hljs 标记（编辑器保存时已高亮），直接复用
  if (/class="hljs-/.test(raw)) return raw

  const code = decodeEntities(raw)
  const lang = LANG_ALIAS[rawLang.toLowerCase()] ?? rawLang.toLowerCase()

  if (!lang || lang === 'plaintext' || !hljs.getLanguage(lang)) {
    return escapeHtml(code)
  }

  try {
    return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
  } catch {
    return escapeHtml(code)
  }
}

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

    // 1. 代码块：语法高亮 + wrapper + 语言标记
    let out = html.replace(
      /<pre([^>]*)>\s*<code([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi,
      (_m, _preAttrs, codeAttrs, body) => {
        const langMatch = String(codeAttrs).match(/language-([\w-]+)/i)
        const rawLang = langMatch?.[1] ?? 'plaintext'
        const lang = rawLang.toLowerCase()
        return `<div class="code-block-wrapper" data-lang="${lang}"><pre><code class="hljs language-${lang}">${highlightCode(
          body,
          rawLang,
        )}</code></pre></div>`
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
