export interface ArchivePost {
  id: number
  slug: string
  title: string
  createdAt: string
  content?: string
  excerpt?: string | null
  readingTime?: number | null
  tags?: { id: number; name: string }[]
}

interface Chapter {
  post: ArchivePost
  topic: string
  topicOrder?: number
  number?: number
  total?: number
}

export interface ArticleSeries {
  title: string
  description?: string
  count: number
  sections: { topic: string; chapters: Chapter[] }[]
}

const FRONTEND = 'AI 时代前端工程能力技术博客系列'
const JAVASCRIPT = 'JavaScript 与编程语言核心机制'
const ONTOLOGY = '本体论与知识图谱'
const MCP = 'MCP 协议与 SDK 工程实践'
const HARNESS = 'DeepSeek Harness 源码解析'

const descriptions = new Map([
  [FRONTEND, '从 JavaScript、浏览器到前端架构与响应式系统。'],
  [JAVASCRIPT, '从对象模型、异步执行到类型转换与元编程。'],
  [ONTOLOGY, '从知识表示与领域本体到知识图谱和业务智能。'],
  [MCP, '从 JSON-RPC 和传输机制到 MCP 客户端与 SDK。'],
  [HARNESS, '理解 Agent 运行时、插件体系和状态管理。'],
])

const frontendTopics = [
  ['JavaScript 与编程语言基础'],
  ['浏览器运行机制'],
  ['计算机网络与 Web 协议'],
  ['前端工程化与软件设计'],
  ['数据建模与状态管理'],
  ['Vue、React 与响应式系统'],
  ['复杂交互与图形系统', '图形系统与可视化技术'],
  ['性能、安全与质量保障', '性能、安全与质量工程'],
  ['高级工程师系统设计'],
]

const ontologyTopics = new Set([
  '知识工程与本体论基础',
  'RDF、RDFS 与语义知识表示',
  'OWL 与形式化本体建模',
  '知识图谱的工程化建模与数据治理',
  '知识图谱查询、检索与数据集成',
  '本体驱动的 Agent 应用与业务智能系统',
])

// 两套历史 JavaScript 篇目使用过同一个专题名，正式目录的前七篇以 slug 区分。
const frontendJavaScript = new Set([
  'h83ot7fvkas', 'hh1zsqy8dg5', 'xe5tab5mw9w', 'y1k5kw0be44',
  'yk49gbdg8ku', 'z0xs5gadp0v', 'zqegi3gr7p6',
])
const standaloneExtensions = new Set(['xe44iu5ev6b', 'xnork0qkjtb', '2e3qtnknbyn', '2wbkrs7g3w1'])

// 这些前导文章发布时还没有统一的系列标记。
const mcpIntroductions = new Set(['wo0wpicerwi', 'xgecj28y8n5', 'xtar6dzdqdz', 'y5nqosekzmp'])
const harnessArticles = new Set([
  'q9yneqlsn41', 'rdj9963549x', 'reseu7gvbhe', 'rs05j8ik642', 'rv2cp8prs4b',
  '0gdr0t8bdzj', '0gyzpucq35j', '0ir5ax4fecn', '0k2rdaw7wxv', '0kxi6qwlfsv',
  '0lzrn7milc8', '0ompa0k2l2b', '0qcjy7e5pmd', '0vsic9zxv5t', '1ybzgb3f4v1',
  'fj4g0rkf19r', 'ttn4bpy4p1m', 'tunu5z1r7uk', 'tw623779hzw', 'twqnqfjmq84', 'txhc3gqbx8j',
])

function readHeader(content: string) {
  // 只从正文开头读取编排信息，正文里提到的其它系列不参与归档。
  const header = content.slice(0, 2000).split(/<h[1-6]\b|<pre\b|^#{1,6}\s|^\s*```/im)[0] ?? ''
  const lines = header
    .replace(/<\/(?:p|div)\s*>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\*\*|__/g, '')
    .split('\n')
    .map(line => line.replace(/^\s*[-*>]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 4)

  const seriesLine = lines.find(line => /^系列\s*[:：]/.test(line)) ?? ''
  const series = seriesLine.replace(/^系列\s*[:：]\s*/, '').split(/[｜|]|\s+·\s+(?=专题|篇目|第)/)[0]?.trim()
  const topicLine = lines.find(line => /^专题(?:[一二三四五六七八九十\d]+)?\s*[:：]/.test(line)) ?? ''
  const topic = topicLine
    .replace(/^专题\s*[:：]\s*/, '')
    .replace(/^专题[一二三四五六七八九十\d]+\s*[:：]\s*/, '')
    .split(/[｜|]|\s+·\s+补充专题/)[0]?.trim() ?? ''
  const chapter = lines.join('\n').match(
    /(?:^|[\n｜|]|\s+·\s+)\s*(?:篇目(?:编号)?\s*[:：]\s*(?:第\s*)?(\d+)(?:\s*[/／]\s*(\d+))?|第\s*(\d+)\s*篇)/,
  )

  return { series, topic, number: Number(chapter?.[1] ?? chapter?.[3]) || undefined, total: Number(chapter?.[2]) || undefined }
}

function getPlacement(post: ArchivePost) {
  const { series, topic, number, total } = readHeader(post.content ?? '')
  const topicOrder = frontendTopics.findIndex(names => names.includes(topic))
  const chapter: Chapter = { post, topic, number, total }

  if (series && series !== FRONTEND) return { title: series, chapter }
  if (standaloneExtensions.has(post.slug)) return

  if (series === FRONTEND || (topicOrder > 0 && number) || frontendJavaScript.has(post.slug)) {
    chapter.topic = frontendTopics[topicOrder]?.[0] ?? topic
    chapter.topicOrder = topicOrder < 0 ? frontendTopics.length : topicOrder
    return { title: FRONTEND, chapter }
  }
  if (topicOrder === 0 || topic === JAVASCRIPT) return { title: JAVASCRIPT, chapter }
  if (ontologyTopics.has(topic) && number) return { title: ONTOLOGY, chapter }
  if (topic === MCP || mcpIntroductions.has(post.slug)) return { title: MCP, chapter: { ...chapter, topic: '' } }
  if (harnessArticles.has(post.slug)) return { title: HARNESS, chapter }
}

export function indexArticleSeries(posts: ArchivePost[]) {
  const groups = new Map<string, Chapter[]>()
  for (const post of posts) {
    const placement = getPlacement(post)
    if (!placement) continue
    const { title, chapter } = placement
    if (!groups.has(title)) groups.set(title, [])
    groups.get(title)!.push(chapter)
  }

  const bySlug = new Map<string, ArticleSeries>()
  for (const [title, chapters] of groups) {
    if (chapters.length < 2) continue

    chapters.sort((a, b) =>
      (a.topicOrder ?? 0) - (b.topicOrder ?? 0)
      // 前端系列的改版篇目重新编号，在同专题内接在原目录之后。
      || (title === FRONTEND ? Number(Boolean(a.total)) - Number(Boolean(b.total)) : 0)
      || (a.number ?? Infinity) - (b.number ?? Infinity)
      || Date.parse(a.post.createdAt) - Date.parse(b.post.createdAt)
      || a.post.id - b.post.id,
    )

    const chaptersByTopic = new Map<string, Chapter[]>()
    for (const chapter of chapters) {
      if (!chaptersByTopic.has(chapter.topic)) chaptersByTopic.set(chapter.topic, [])
      chaptersByTopic.get(chapter.topic)!.push(chapter)
    }
    const series: ArticleSeries = {
      title,
      description: descriptions.get(title),
      count: chapters.length,
      sections: Array.from(chaptersByTopic, ([topic, chapters]) => ({ topic, chapters })),
    }
    for (const { post } of chapters) bySlug.set(post.slug, series)
  }
  return bySlug
}
