/**
 * useMarked — 配置 marked 渲染器
 *  - 标题自动生成 id（供 TOC 锚点跳转）
 *  - 代码块使用 highlight.js 语法高亮
 *  - 代码块附带语言标签（copy 按钮由 useCodeCopy 在客户端注入）
 */
import { marked } from 'marked'

// highlight.js 按需引入常用语言，减少包体积
import hljs from 'highlight.js/lib/core'
import langBash       from 'highlight.js/lib/languages/bash'
import langCss        from 'highlight.js/lib/languages/css'
import langDiff       from 'highlight.js/lib/languages/diff'
import langGo         from 'highlight.js/lib/languages/go'
import langJava       from 'highlight.js/lib/languages/java'
import langJs         from 'highlight.js/lib/languages/javascript'
import langJson       from 'highlight.js/lib/languages/json'
import langMarkdown   from 'highlight.js/lib/languages/markdown'
import langNginx      from 'highlight.js/lib/languages/nginx'
import langPython     from 'highlight.js/lib/languages/python'
import langRust       from 'highlight.js/lib/languages/rust'
import langShell      from 'highlight.js/lib/languages/shell'
import langSql        from 'highlight.js/lib/languages/sql'
import langTs         from 'highlight.js/lib/languages/typescript'
import langXml        from 'highlight.js/lib/languages/xml'
import langYaml       from 'highlight.js/lib/languages/yaml'

hljs.registerLanguage('bash',       langBash)
hljs.registerLanguage('sh',         langShell)
hljs.registerLanguage('shell',      langShell)
hljs.registerLanguage('css',        langCss)
hljs.registerLanguage('diff',       langDiff)
hljs.registerLanguage('go',         langGo)
hljs.registerLanguage('java',       langJava)
hljs.registerLanguage('javascript', langJs)
hljs.registerLanguage('js',         langJs)
hljs.registerLanguage('json',       langJson)
hljs.registerLanguage('markdown',   langMarkdown)
hljs.registerLanguage('md',         langMarkdown)
hljs.registerLanguage('nginx',      langNginx)
hljs.registerLanguage('python',     langPython)
hljs.registerLanguage('py',         langPython)
hljs.registerLanguage('rust',       langRust)
hljs.registerLanguage('sql',        langSql)
hljs.registerLanguage('typescript', langTs)
hljs.registerLanguage('ts',         langTs)
hljs.registerLanguage('xml',        langXml)
hljs.registerLanguage('html',       langXml)
hljs.registerLanguage('yaml',       langYaml)
hljs.registerLanguage('yml',        langYaml)

let configured = false

function setupMarked() {
  if (configured) return
  configured = true

  marked.use({
    renderer: {
      // 标题加 id，供 TOC 锚点使用
      // raw 在部分 marked 版本的某些 heading 场景下可能为 undefined，
      // 降级用 text（先剥离内联 HTML 标签再生成 id）
      heading({ text, depth, raw }: { text: string; depth: number; raw?: string }) {
        const source = (raw ?? text)
          .replace(/^#{1,6}\s+/, '')   // 去掉 raw 里的 ## 前缀
          .replace(/<[^>]+>/g, '')     // 去掉内联 HTML（如 <code>）
        const id = source
          .toLowerCase()
          .trim()
          .replace(/\s+/g, '-')
          .replace(/[^\w\u4e00-\u9fa5-]/g, '')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 80)
        return `<h${depth} id="${id}">${text}</h${depth}>\n`
      },

      // 代码块：hljs 高亮 + data-lang 属性（供 useCodeCopy 读取）
      code({ text, lang }: { text: string; lang?: string }) {
        const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
        const highlighted = hljs.highlight(text, { language }).value
        return `<div class="code-block-wrapper" data-lang="${language}"><pre><code class="hljs language-${language}">${highlighted}</code></pre></div>\n`
      },
    },
  })
}

/** 渲染 Markdown 字符串为 HTML，自动初始化配置 */
export function useMarked() {
  setupMarked()
  return {
    render: (markdown: string): string => marked(markdown) as string,
  }
}
