import {
  AI_ENGINEERING, FRONTEND, HARNESS, JAVASCRIPT, MCP, ONTOLOGY,
  frontendTopicOrder, inferLegacyCatalog, readCatalogHeader, type CatalogPosition as Position,
} from '../../backend/src/modules/posts/article-catalog'

export interface ArchivePost {
  id: number
  slug: string
  title: string
  createdAt: string
  content?: string
  series?: string | null
  topic?: string | null
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
  seriesPosition?: Position
  topicPosition?: Position
}

export interface ArticlePosition extends Position {
  kind: 'topic' | 'series'
  title: string
}

export interface ArticleGroup {
  kind: 'topic' | 'series'
  key: string
  title: string
  description?: string
  parentSeries?: string
  count: number
  topicCount?: number
  topicPosition?: Position
  sections: { topic: string; chapters: Chapter[] }[]
}

const descriptions = new Map([
  [FRONTEND, '从 JavaScript、浏览器到前端架构与响应式系统。'],
  [AI_ENGINEERING, '从操作系统、大模型到 Agent、RAG 和业务流程工程。'],
  [JAVASCRIPT, '从对象模型、异步执行到类型转换与元编程。'],
  [ONTOLOGY, '从知识表示与领域本体到知识图谱和业务智能。'],
  [MCP, '从 JSON-RPC 和传输机制到 MCP 客户端与 SDK。'],
  [HARNESS, '理解 Agent 运行时、插件体系和状态管理。'],
])

function getPlacement(post: ArchivePost) {
  const { series: headerSeries, topic: headerTopic, ...chapterMetadata } = readCatalogHeader(post.content ?? '')
  const legacy = inferLegacyCatalog(post.slug, { series: headerSeries, topic: headerTopic, ...chapterMetadata })
  // API 响应中显式的 null 表示无归属；旧版接口缺少字段时沿用历史目录识别。
  const series = post.series === undefined && post.topic === undefined ? legacy.series : post.series ?? null
  const topic = post.series === undefined && post.topic === undefined ? legacy.topic : post.topic ?? null
  if (!series && !topic) return

  // 归属曾被显式改动时，正文里的旧篇号不用于新目录。
  const headerMatches = (!legacy.series || legacy.series === series) && (!legacy.topic || legacy.topic === topic)
  const chapter: Chapter = {
    post,
    topic: topic ?? '',
    topicOrder: series === FRONTEND ? frontendTopicOrder(topic ?? '') : undefined,
    ...(headerMatches ? chapterMetadata : {}),
  }
  return { title: series, chapter }
}

export function indexArticleGroups(posts: ArchivePost[]) {
  const groups = new Map<string | null, Chapter[]>()
  for (const post of posts) {
    const placement = getPlacement(post)
    if (!placement) continue
    const { title, chapter } = placement
    if (!groups.has(title)) groups.set(title, [])
    groups.get(title)!.push(chapter)
  }

  const bySeries = new Map<string, ArticleGroup>()
  const byTopic = new Map<string, ArticleGroup>()
  const positions = new Map<string, ArticlePosition[]>()
  for (const [title, chapters] of groups) {
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
    const sections = Array.from(chaptersByTopic, ([topic, chapters]) => ({ topic, chapters }))
    const namedTopics = sections.filter(section => section.topic)
    const series: ArticleGroup | null = title ? {
      kind: 'series',
      key: `series:${title}`,
      title,
      description: descriptions.get(title),
      count: chapters.length,
      topicCount: namedTopics.length,
      sections,
    } : null

    // 序号跟随完整目录的顺序，搜索或标签筛选只改变可见卡片。
    let seriesIndex = 0
    for (const section of sections) {
      for (const [index, chapter] of section.chapters.entries()) {
        const { post } = chapter
        seriesIndex += 1
        const articlePositions: ArticlePosition[] = []
        if (title) {
          articlePositions.push({
            kind: 'series',
            title,
            ...(chapter.seriesPosition ?? { index: seriesIndex, total: chapters.length }),
          })
        }
        if (section.topic) {
          articlePositions.push({
            kind: 'topic',
            title: section.topic,
            ...(chapter.topicPosition ?? { index: index + 1, total: section.chapters.length }),
          })
        }
        positions.set(post.slug, articlePositions)
        if (series && series.count > 1) bySeries.set(post.slug, series)
      }
    }

    for (const [index, section] of namedTopics.entries()) {
      if (section.chapters.length < 2) continue
      const topic: ArticleGroup = {
        kind: 'topic',
        key: `topic:${JSON.stringify([title, section.topic])}`,
        title: section.topic,
        parentSeries: title ?? undefined,
        count: section.chapters.length,
        topicPosition: title ? { index: index + 1, total: namedTopics.length } : undefined,
        sections: [{ topic: '', chapters: section.chapters }],
      }
      for (const { post } of section.chapters) byTopic.set(post.slug, topic)
    }
  }
  return { series: bySeries, topic: byTopic, positions }
}
