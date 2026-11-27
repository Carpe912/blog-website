// 学习路线：按「从语言执行到业务语义查询」的依赖顺序排列的 95 篇，
// 顺序是人工定的，不随发布时间变化；slug 用来跳转，title 用于展示和兜底匹配。
export interface LearningStep {
  slug: string
  title: string
}

export interface LearningStage {
  name: string
  goal: string
  items: LearningStep[]
}

export const learningPath: LearningStage[] = [
  {
    name: '代码怎么跑起来',
    goal: '能解释任何诡异表现',
    items: [
      { slug: 'h83ot7fvkas', title: "JavaScript 是如何运行的：从源代码到执行结果" },
      { slug: 'hh1zsqy8dg5', title: "执行上下文、作用域与闭包：JavaScript 如何管理变量" },
      { slug: 'xe5tab5mw9w', title: "this、原型链与继承：理解 JavaScript 的对象模型" },
      { slug: 'i2enezdun4l', title: "对象属性与属性描述符：数据属性、访问器属性与对象元编程" },
      { slug: 'kwjftmjmfv0', title: "JavaScript 类型转换与相等性：从抽象操作到隐式类型转换" },
      { slug: 'mcn5x1hq7kp', title: "JavaScript Proxy 与 Reflect：从对象内部方法到元编程机制" },
      { slug: 'kkbavxb8b8x', title: "JavaScript 对象内部方法与 Receiver：属性访问、继承与代理语义" },
      { slug: 'j07s9qal7jo', title: "JavaScript 内存管理与垃圾回收：从对象可达性到内存泄漏" },
    ],
  },
  {
    name: '异步与运行时',
    goal: '说得清调度顺序',
    items: [
      { slug: 'imwero74uxy', title: "JavaScript 异步编程模型：回调、Promise 与任务调度" },
      { slug: 'jsv6lc8upkl', title: "JavaScript Promise 深度解析：异步状态机、链式调用与错误传播" },
      { slug: 'k5ehgp917ia', title: "JavaScript async/await 深度解析：从异步函数执行模型到状态机" },
      { slug: 'it1p5t1jnql', title: "JavaScript 事件循环与任务调度：从浏览器渲染到 Node.js Event Loop" },
      { slug: 'jz0a3yjdcoj', title: "JavaScript 异步函数的工程实践：异常边界、并发控制与取消" },
      { slug: 'ni9v0p6cmd9', title: "浏览器架构详解：多进程、多线程与页面运行环境" },
      { slug: 'nocnh6ou1vh', title: "浏览器渲染原理：从 HTML、CSS 到屏幕上的像素" },
      { slug: 'nvyt4mdlfap', title: "浏览器事件系统：DOM、事件传播与事件委托" },
    ],
  },
  {
    name: '网络与存储',
    goal: '判断问题出在哪一层',
    items: [
      { slug: 'oec1jmk0n85', title: "计算机网络基础：从 IP、TCP、UDP 到 DNS" },
      { slug: 'ok47c60d59z', title: "HTTPS 原理详解：TLS 握手、证书与数据加密" },
      { slug: 'otrqcy3y4ib', title: "HTTP 缓存机制：强缓存、协商缓存与缓存策略设计" },
      { slug: 'ooil9uettyq', title: "HTTP 协议演进：HTTP/1.1、HTTP/2 与 HTTP/3" },
      { slug: 'oveo3j01xxm', title: "Web 通信机制：Ajax、Fetch、SSE 与 WebSocket" },
      { slug: 'o03j8cmgmiu', title: "浏览器存储机制：Cookie、LocalStorage、IndexedDB 与缓存" },
      { slug: 'p0vq8c18ei6', title: "网络请求的可靠性设计：超时、重试、幂等与断线重连" },
    ],
  },
  {
    name: '数据怎么表示',
    goal: '能选对数据结构',
    items: [
      { slug: 'qy7q1a2zy7y', title: "数据建模基础：从业务概念到计算机中的数据结构" },
      { slug: 'rz3l4ufo3wo', title: "树、图与 DAG：复杂业务关系如何在计算机中表达" },
      { slug: 'wd7c9f8d1p7', title: "数据规范化与不可变数据：如何管理复杂应用的数据" },
      { slug: 'v57wx5smx2m', title: "状态机详解：如何管理复杂交互与业务流程" },
      { slug: 'ws0404grerm', title: "数据序列化与反序列化：JSON、XML 与 Schema" },
      { slug: 'lbo5z6cwsmt', title: "JavaScript 字符串与 Unicode：从 UTF-16 编码到字符遍历" },
      { slug: 'l0p1iyrw8g2', title: "JavaScript Number 与 IEEE 754：浮点数表示、精度误差与数值计算" },
      { slug: 'zqegi3gr7p6', title: "TypeScript 类型系统：从静态类型到类型编程" },
    ],
  },
  {
    name: '状态与框架',
    goal: '能手写响应式系统',
    items: [
      { slug: 'uvszx77ftw5', title: "前端状态管理的本质：状态、事件与状态转换" },
      { slug: 'y281b9yb9x4', title: "虚拟 DOM 与 Diff 算法：框架如何高效更新页面" },
      { slug: 'vqn00yyulm8', title: "声明式 UI 与响应式系统：依赖追踪、Effect、调度与更新传播" },
      { slug: '411o4k2asgx', title: "React Fiber 架构：任务调度、优先级与并发渲染" },
      { slug: 'yij25qkqbpn', title: "Vue 编译器原理：从模板 AST 到 Render 函数" },
      { slug: 'mgobj9llakj', title: "JavaScript 代理对象与响应式系统：从依赖追踪到调度更新" },
      { slug: 'mk9e5jwbqvi', title: "JavaScript 计算属性与副作用系统：从惰性求值到异步状态管理" },
    ],
  },
  {
    name: '工程与架构',
    goal: '能设计分层与插件',
    items: [
      { slug: 'pb6n4azhia6', title: "前端模块化演进：CommonJS、AMD、ES Module 与模块加载" },
      { slug: 'phlm3bo2zwp', title: "前端构建工具原理：Webpack、Vite 与现代构建体系" },
      { slug: 'q8986e3wuyh', title: "前端架构设计：分层架构、模块化与依赖管理" },
      { slug: 'qgx15fuhd8m', title: "插件化架构详解：如何设计可扩展的前端系统" },
      { slug: 'qtzzuzzvkvl', title: "Monorepo 与工程协作：大型前端项目如何组织代码" },
      { slug: 'pycl8rg60sr', title: "软件设计原则与设计模式：如何构建低耦合系统" },
      { slug: 'x3v2tpspft7', title: "DDD 与领域模型：如何让软件结构贴近业务语义" },
      { slug: 'd9t042ydfdc', title: "大型前端系统设计：从需求分析、领域建模到架构落地" },
    ],
  },
  {
    name: '质量与交互',
    goal: '能拿出量化优化',
    items: [
      { slug: 'ajumovsnj7a', title: "前端性能工程：加载、渲染、内存与运行时优化" },
      { slug: 'bzqmi30w752', title: "Web 安全体系：XSS、CSRF、CORS、CSP 与权限边界" },
      { slug: 'clenvb65k66', title: "前端工程质量体系：测试策略、自动化、可观测性与持续交付" },
      { slug: '4puoaz9ob4y', title: "二维图形系统基础：坐标系、向量、矩阵与仿射变换" },
      { slug: '57mqwegp08l', title: "图形渲染引擎：SVG、Canvas、WebGL 与场景图" },
      { slug: '7pdt4ic5j42', title: "富文本编辑器架构：Document Model、Transaction、Selection 与协同" },
    ],
  },
  {
    name: '模型与检索',
    goal: '懂 RAG 的每一环',
    items: [
      { slug: 'lfwyml5ceem', title: "大语言模型是如何工作的：Token、Embedding、Attention 与模型能力" },
      { slug: 'lmslr2txd8o', title: "大模型上下文与推理机制：Context Window、Prefill、Decode 与 KV Cache" },
      { slug: 'lsf1qau1t66', title: "大模型 API 与输出控制：结构化输出、工具调用及模型选型" },
      { slug: '7e16dv63r6l', title: "全文检索原理：倒排索引、TF-IDF 与 BM25" },
      { slug: '7pm2fbhqjad', title: "Embedding、向量数据库与近似搜索机制" },
      { slug: '7wz9uihluqj', title: "混合检索与重排序：关键词、向量、Reranker 与 RRF" },
      { slug: '878d1ect6bb', title: "文档解析与知识索引工程：Chunking、元数据、权限与增量更新" },
    ],
  },
  {
    name: 'Agent 工程',
    goal: '能搭出可用的 Agent',
    items: [
      { slug: 'm1nl7k1op5g', title: "Agent Harness 与 Runtime 架构：从模型 API 到智能执行系统" },
      { slug: 'm6ecgfdkccz', title: "Context Engineering：上下文装配、Token Budget、缓存与压缩" },
      { slug: 'mftetf7lla3', title: "Agent Memory 与 Session：会话状态、记忆检索与长期知识管理" },
      { slug: 'mse1psk33th', title: "Agent 能力系统设计：Tool、Skill、MCP、权限与执行管线" },
      { slug: 'ncdmsv5lyzl', title: "Agent 任务规划与可靠工作流：Planning、Subagent、Checkpoint 与恢复" },
      { slug: '770oeqau0d3', title: "Agent 安全与质量治理：信任边界、提示注入、权限审批与评估" },
      { slug: '7alll0p06il', title: "企业级 Agent Harness 综合设计：基于 TypeScript 的可扩展运行时" },
      { slug: '8hn62vh8jh2', title: "Agentic RAG 与企业知识检索架构：查询规划、证据融合与质量评估" },
    ],
  },
  {
    name: '协议与源码',
    goal: '能改造一个框架',
    items: [
      { slug: 'xgecj28y8n5', title: "JSON-RPC 2.0 协议深度解析：从消息结构、调用模型到传输机制与工程实践" },
      { slug: 'wo0wpicerwi', title: "MCP 底层通信机制、传输模式与安全鉴权架构：从 JSON-RPC 到 OAuth 2.1 的完整解析" },
      { slug: 'xtar6dzdqdz', title: "MCP TypeScript SDK 架构深度解析：从 McpServer、Protocol 到 Transport 的完整执行链路" },
      { slug: 'y5nqosekzmp', title: "MCP Client 深度解析：连接生命周期、能力发现、多 Server 聚合与 Agent 工具路由" },
      { slug: '2ven6h0ydur', title: "MCP SDK 源码深度解析：Multi-Round-Trip Request 多轮请求机制与状态安全设计" },
      { slug: '0qcjy7e5pmd', title: "DeepSeek Harness 核心技术解析：深入理解 Cordis 插件运行时" },
      { slug: 'fj4g0rkf19r', title: "深入理解 DeepSeek Harness 的 Projection：从事件日志到状态投影，再到快照、缓存与客户端同步" },
      { slug: '1ybzgb3f4v1', title: "DeepSeek Harness 中的 Checkpoint 机制详解：从状态快照到 Agent 执行恢复" },
    ],
  },
  {
    name: '业务语义',
    goal: '能建一套领域本体',
    items: [
      { slug: 'vio1q8ib5xj', title: "从数据到知识：本体论、知识表示与知识工程的演进" },
      { slug: 'waik3zism0m', title: "RDF 深度解析：三元组、图模型、IRI 与统一知识表示" },
      { slug: 'whhaf71xj5q', title: "RDFS 深度解析：Class、subClassOf、domain、range 与基础推理" },
      { slug: 'wqcjdnh06j3', title: "OWL 深度解析：从 RDF/RDFS 到形式化本体语言" },
      { slug: 'w2s84o5nhym', title: "领域本体建模：概念、类、实例、属性、关系与约束" },
      { slug: 'xby8yyxwtwv', title: "知识图谱的工程化建模：实体、关系、标识符、属性与本体设计方法" },
      { slug: 'xwewtfvojuv', title: "SPARQL 深度解析：RDF 查询语言、图模式匹配与知识检索" },
      { slug: 'yh7wn8g9o75', title: "多源知识融合与实体对齐：从 WMS、TMS、GPS 到统一领域知识模型" },
    ],
  },
  {
    name: '语义查询',
    goal: '能交付查询链路',
    items: [
      { slug: 'lkejxnhwuyy', title: "01｜Text-to-SQL 的本质：计算机如何将自然语言转换为数据库查询" },
      { slug: 'lsnrmu1mxe4', title: "03｜Schema Linking：自然语言如何匹配数据库中的表、字段与关联关系" },
      { slug: 'luy40fl3h3n', title: "04｜Entity Linking 与 Value Linking：如何理解业务实体与真实数据" },
      { slug: 'lzrcb8i7nu7', title: "05｜RAG for Text-to-SQL：如何利用数据库结构、业务知识与历史 SQL" },
      { slug: 'ms0t1x2s5uq', title: "06｜Text-to-SQL 核心生成策略：从直接生成到复杂查询规划" },
      { slug: 'n33ka98lsno', title: "07｜SQL AST 与约束生成：如何保证生成语句的合法性" },
      { slug: 'nu3recjh1px', title: "09｜Semantic Layer 语义层：如何让 Agent 真正理解企业业务" },
      { slug: 'obcpcnlmi2t', title: "10｜从 Text-to-SQL 到 Text-to-DSL：如何实现确定性的语义查询编译器" },
      { slug: 'qv6282c4e7o', title: "11｜Agentic Text-to-SQL：查询规划、工具调用与多轮数据分析" },
      { slug: 'rudnkbze2pv', title: "12｜企业级 Agent 查询引擎的架构设计与工程实践" },
      { slug: 'zrx5bpp3ge5', title: "知识图谱与 GraphRAG：从实体关系检索到全局知识组织" },
      { slug: '0elci61mk8w', title: "本体驱动的运输管理 Agent 综合实践：从领域建模到生产级业务智能系统" },
    ],
  },
]

/** 全部篇目数，用于按钮上的角标 */
export const learningPathCount = learningPath.reduce((n, stage) => n + stage.items.length, 0)
