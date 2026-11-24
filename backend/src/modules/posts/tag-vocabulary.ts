/**
 * 标签词表的种子与兜底规则
 *
 * 正式词表不写死在这里：它存在于数据库的 Tag 表，可以随时用
 * POST /api/posts/rebuild-tags 让模型按当时的全部文章重新生成一套更精简的词表，
 * 然后逐篇重打标签。
 *
 * 下面的列表只在数据库里一个标签都没有时作为初始词表。
 */

/** 初始词表（空库时使用） */
export const DEFAULT_TAG_VOCABULARY = [
  'deepseek',
  'harness',
  'cordis',
  '插件机制',
  '源码解析',
  'agent工程',
  '上下文管理',
  '安全与权限',
  '架构设计',
  'javascript',
  'typescript',
  '浏览器',
  '网络与编码',
];

/** 已知标签的简短说明，帮助模型把正文映射到宽标签 */
export const TAG_HINTS: Record<string, string> = {
  deepseek: 'DeepSeek / DSH 相关',
  harness: 'DeepSeek Harness 项目本身',
  cordis: 'Cordis 插件运行时、加载器、Profile/Bundle',
  插件机制: '插件注册、加载、扩展体系',
  源码解析: '读源码、讲实现原理的系列文章',
  agent工程: '任务执行、可靠性、重试、checkpoint、工作流、子 Agent',
  上下文管理: 'compaction、上下文压缩、记忆、会话持久化',
  安全与权限: 'sandbox、审批、隔离、多租户',
  架构设计: '整体架构、分层、存储/客户端设计',
  javascript: 'JS 语言与运行时：事件循环、闭包、原型、异步、内存',
  typescript: 'TS 类型系统、类型编程',
  浏览器: 'DOM、渲染、事件、浏览器进程架构',
  网络与编码: 'HTTP 缓存、CDN、字符编码',
};

/**
 * 模型不可用时的关键词兜底：按顺序命中，最多取 3 个。
 * 这里的候选标签会被词表过滤，词表里没有的自动跳过。
 */
export const TAG_RULES: { test: RegExp; tags: string[] }[] = [
  { test: /deepseek|\bdsh\b/i, tags: ['deepseek', 'harness'] },
  { test: /cordis|loader|bundle|patch/i, tags: ['cordis', '插件机制'] },
  { test: /插件|plugin|扩展体系/i, tags: ['插件机制'] },
  { test: /源码|实现原理|内部机制/i, tags: ['源码解析'] },
  { test: /上下文|compaction|压缩|记忆|会话|projection/i, tags: ['上下文管理'] },
  { test: /权限|安全|sandbox|审批|隔离|多租户/i, tags: ['安全与权限'] },
  { test: /架构|分层|存储|客户端设计/i, tags: ['架构设计'] },
  { test: /typescript|类型系统|类型编程/i, tags: ['typescript'] },
  { test: /javascript|事件循环|闭包|原型|异步|promise|内存|执行上下文|作用域/i, tags: ['javascript'] },
  { test: /浏览器|\bdom\b|渲染|事件委托|cssom/i, tags: ['浏览器'] },
  { test: /http|缓存|cdn|编码|unicode|utf-8|字符/i, tags: ['网络与编码'] },
  { test: /agent|任务|checkpoint|重试|幂等|workflow|subagent|子进程/i, tags: ['agent工程'] },
];
