import {
  AI_ENGINEERING, FRONTEND, HARNESS, JAVASCRIPT, MCP, ONTOLOGY,
  frontendTopicOrder, inferLegacyCatalog, normalizeMemberships, readCatalogHeader,
  type ArticleCatalog, type CatalogPosition as Position,
} from '../../backend/src/modules/posts/article-catalog'

export interface ArchivePost {
  id: number
  slug: string
  title: string
  createdAt: string
  content?: string
  series?: string | null
  topic?: string | null
  memberships?: ArticleCatalog[]
  excerpt?: string | null
  readingTime?: number | null
  tags?: { id: number; name: string }[]
}

interface Chapter {
  post: ArchivePost
  topic: string
  firstInSeries: boolean
  topicOrder?: number
  number?: number
  total?: number
  seriesPosition?: Position
  topicPosition?: Position
}

export interface ArticlePosition extends Position {
  kind: 'topic' | 'series'
  title: string
  groupKey: string
  parentSeries?: string
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

function seriesKey(title: string) {
  return `series:${title}`
}

function topicKey(series: string | null, topic: string) {
  return `topic:${JSON.stringify([series, topic])}`
}

export function indexArticleGroups(posts: ArchivePost[]) {
  const groups = new Map<string | null, Chapter[]>()
  const groupKeysBySlug = new Map<string, Set<string>>()
  for (const post of posts) {
    const header = readCatalogHeader(post.content ?? '')
    const legacy = inferLegacyCatalog(post.slug, header)
    // 只有缺少归属字段的旧版响应才从正文推断归属。
    const memberships = post.memberships ?? normalizeMemberships([
      post.series === undefined && post.topic === undefined ? legacy : post,
    ])
    const keys = new Set<string>()
    groupKeysBySlug.set(post.slug, keys)
    for (const { series, topic } of memberships) {
      const key = series ? seriesKey(series) : null
      const firstInSeries = key !== null && !keys.has(key)
      if (key) keys.add(key)
      if (topic) keys.add(topicKey(series, topic))

      const matchesSeries = Boolean(series && legacy.series === series)
      const matchesTopic = Boolean(topic && legacy.topic === topic && legacy.series === series)
      const chapter: Chapter = {
        post,
        topic: topic ?? '',
        firstInSeries,
        topicOrder: series === FRONTEND ? frontendTopicOrder(topic ?? '') : undefined,
        number: matchesSeries || matchesTopic ? header.number : undefined,
        total: matchesSeries || matchesTopic ? header.total : undefined,
        seriesPosition: matchesSeries ? header.seriesPosition : undefined,
        topicPosition: matchesTopic ? header.topicPosition : undefined,
      }
      if (!groups.has(series)) groups.set(series, [])
      groups.get(series)!.push(chapter)
    }
  }

  const byKey = new Map<string, ArticleGroup>()
  const positionsBySlug = new Map<string, Map<string, ArticlePosition>>()
  function register(group: ArticleGroup) {
    byKey.set(group.key, group)
    let index = 0
    for (const section of group.sections) {
      for (const chapter of section.chapters) {
        index += 1
        const slug = chapter.post.slug
        const position = group.kind === 'series' ? chapter.seriesPosition : chapter.topicPosition
        if (!positionsBySlug.has(slug)) positionsBySlug.set(slug, new Map())
        positionsBySlug.get(slug)!.set(group.key, {
          kind: group.kind,
          title: group.title,
          groupKey: group.key,
          parentSeries: group.parentSeries,
          ...(position ?? { index, total: group.count }),
        })
      }
    }
  }

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
    if (title) {
      // 一篇文章可出现在多个专题目录，在同一系列目录里只显示一次。
      const seriesSections = sections
        .map(section => ({ ...section, chapters: section.chapters.filter(chapter => chapter.firstInSeries) }))
        .filter(section => section.chapters.length)
      register({
        kind: 'series',
        key: seriesKey(title),
        title,
        description: descriptions.get(title),
        count: seriesSections.reduce((sum, section) => sum + section.chapters.length, 0),
        topicCount: namedTopics.length,
        sections: seriesSections,
      })
    }

    for (const [index, section] of namedTopics.entries()) {
      register({
        kind: 'topic',
        key: topicKey(title, section.topic),
        title: section.topic,
        parentSeries: title ?? undefined,
        count: section.chapters.length,
        topicPosition: title ? { index: index + 1, total: namedTopics.length } : undefined,
        sections: [{ topic: '', chapters: section.chapters }],
      })
    }
  }
  const positions = new Map<string, ArticlePosition[]>()
  for (const [slug, byGroup] of positionsBySlug) {
    positions.set(slug, Array.from(groupKeysBySlug.get(slug)!, key => byGroup.get(key)!))
  }
  return { byKey, positions }
}
