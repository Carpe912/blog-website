export const CATALOG_NAME_MAX_LENGTH = 160;

export interface CatalogPosition {
  index: number;
  total: number;
}

export interface ArticleCatalog {
  series: string | null;
  topic: string | null;
}

export function normalizeCatalogName(value?: string | null): string | null {
  const name = value?.trim().replace(/\s+/g, ' ');
  return name && name.length <= CATALOG_NAME_MAX_LENGTH ? name : null;
}

export const FRONTEND = 'AI 时代前端工程能力技术博客系列'
export const AI_ENGINEERING = 'AI 系统与 Agent 工程'
export const JAVASCRIPT = 'JavaScript 与编程语言核心机制'
export const ONTOLOGY = '本体论与知识图谱'
export const MCP = 'MCP 协议与 SDK 工程实践'
export const HARNESS = 'DeepSeek Harness 源码解析'

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

const aiEngineeringTopics = new Set([
  '操作系统与系统编程',
  '大模型原理与工程应用',
  '通用 Agent Harness 工程',
  '信息检索与 RAG 工程',
  '编译原理与 Coding Agent',
  '业务流程建模与工作流',
  'SQL 与数据库应用工程',
  '服务部署与分布式工程',
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

export function readCatalogHeader(content: string) {
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

  const fields = lines
    .flatMap(line => line.split(/[｜|]|\s+·\s+(?=系列|专题|主题|总篇目|篇目|第)/))
    .map(field => field.trim())
  const metadata = fields.join('\n')
  const series = metadata.match(/^(?:所属)?系列\s*[:：]\s*([^\n]+)/m)?.[1]?.trim()
  const topicLine = fields.find(field => /^(?:专题|主题)(?:[一二三四五六七八九十\d]+)?\s*[:：]/.test(field)) ?? ''
  const topic = topicLine
    .replace(/^(?:专题|主题)\s*[:：]\s*/, '')
    .replace(/^(?:专题|主题)[一二三四五六七八九十\d]+\s*[:：]\s*/, '')
    .replace(/\s+·\s+补充专题$/, '')
    .trim()
  const chapter = metadata.match(/^(?:篇目(?:编号)?\s*[:：]\s*(?:第\s*)?(\d+)(?:\s*[/／]\s*(\d+))?|第\s*(\d+)\s*篇)/m)
  const seriesPosition = readPosition(metadata.match(/^总篇目\s*[:：]\s*(\d+)\s*[/／]\s*(\d+)/m))
  const topicPosition = readPosition(metadata.match(/^(?:专题|主题)篇目\s*[:：]\s*(\d+)\s*[/／]\s*(\d+)/m))

  return {
    series,
    topic,
    number: seriesPosition?.index ?? (Number(chapter?.[1] ?? chapter?.[3]) || undefined),
    total: seriesPosition?.total ?? (Number(chapter?.[2]) || undefined),
    seriesPosition,
    topicPosition,
  }
}

function readPosition(match: RegExpMatchArray | null): CatalogPosition | undefined {
  if (!match) return
  const index = Number(match[1])
  const total = Number(match[2])
  if (index > 0 && index <= total) return { index, total }
}

export function frontendTopicOrder(topic: string) {
  const order = frontendTopics.findIndex(names => names.includes(topic));
  return order < 0 ? frontendTopics.length : order;
}

export function inferLegacyCatalog(
  slug: string,
  header: ReturnType<typeof readCatalogHeader>,
): ArticleCatalog {
  const series = normalizeCatalogName(header.series);
  const topic = normalizeCatalogName(header.topic);
  const { number, seriesPosition } = header;
  const order = frontendTopics.findIndex(names => topic !== null && names.includes(topic));

  if (series && series !== FRONTEND) return { series, topic };
  if (standaloneExtensions.has(slug)) return { series: null, topic: null };
  if (seriesPosition?.total === 41 && topic && aiEngineeringTopics.has(topic)) return { series: AI_ENGINEERING, topic };
  if (series === FRONTEND || (order > 0 && number) || frontendJavaScript.has(slug)) {
    return { series: FRONTEND, topic: frontendTopics[order]?.[0] ?? topic };
  }
  if (order === 0 || topic === JAVASCRIPT) return { series: JAVASCRIPT, topic };
  if (topic && ontologyTopics.has(topic) && number) return { series: ONTOLOGY, topic };
  if (topic === MCP || mcpIntroductions.has(slug)) return { series: MCP, topic: null };
  if (harnessArticles.has(slug)) return { series: HARNESS, topic };
  return { series: null, topic };
}
