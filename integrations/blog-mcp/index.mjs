// 博客 MCP 服务：向 MCP 客户端提供文章查询、编辑和发布能力。
// 传输方式：Streamable HTTP，无状态（每个请求新建 server + transport）
// 上游：本机博客后端 http://127.0.0.1:3001/api
import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const PORT = Number(process.env.MCP_PORT || 3010);
const API_BASE = process.env.BLOG_API_BASE || "http://127.0.0.1:3001/api";
const TOKEN = (process.env.MCP_TOKEN || "").trim();
const MAX_CONTENT_CHARS = 40000;

// 调用博客后端接口，统一解包 { success, data }
async function apiGet(path, params = {}) {
  const url = new URL(API_BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`博客接口返回 ${res.status}：${url.pathname}${url.search}`);
  const json = await res.json();
  if (json && json.success === false) throw new Error(json.message || "博客接口返回失败");
  return json.data;
}

// 调用博客后端的写接口
async function apiPost(path, body) {
  return apiSend("POST", path, body);
}

// 调用博客后端的更新接口
async function apiPatch(path, body) {
  return apiSend("PATCH", path, body);
}

// 调用博客后端的删除接口（成功返回 204，无响应体）
async function apiDelete(path) {
  const url = new URL(API_BASE + path);
  const res = await fetch(url, {
    method: "DELETE",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(`博客接口返回 ${res.status}：${json.message || res.statusText}`);
  }
  return null;
}

async function apiSend(method, path, body) {
  const url = new URL(API_BASE + path);
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`博客接口返回 ${res.status}：${json.message || res.statusText}`);
  if (json && json.success === false) throw new Error(json.message || "博客接口返回失败");
  return json.data;
}

// 粗判传入正文是不是 HTML：一个标签都没有就当作 Markdown
function looksLikeHtml(text) {
  return /<\/?[a-z][\s\S]*>/i.test(text);
}

// 轻量 Markdown → HTML，只在模型没按 HTML 输出时兜底
function markdownToHtml(md) {
  const blocks = String(md).replace(/\r\n/g, "\n").split(/\n{2,}/);
  const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s) =>
    escape(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');

  return blocks
    .map((block) => {
      const lines = block.split("\n");
      const fence = block.match(/^```[^\n]*\n([\s\S]*?)\n?```$/);
      if (fence) return `<pre><code>${escape(fence[1])}</code></pre>`;
      const heading = block.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        const level = heading[1].length;
        return `<h${level}>${inline(heading[2])}</h${level}>`;
      }
      if (lines.every((l) => /^\s*[-*+]\s+/.test(l))) {
        return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*+]\s+/, ""))}</li>`).join("")}</ul>`;
      }
      if (lines.every((l) => /^\s*\d+\.\s+/.test(l))) {
        return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\s*\d+\.\s+/, ""))}</li>`).join("")}</ol>`;
      }
      return `<p>${inline(block).replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");
}

// 把正文 HTML 转成便于模型阅读的纯文本
function htmlToText(html = "") {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|pre)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// 列表只回必要字段，避免把几千字正文塞给模型
function toSummary(post) {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt || "",
    series: post.series ?? null,
    topic: post.topic ?? null,
    tags: (post.tags || []).map((t) => t.name),
    createdAt: post.publishedAt || post.createdAt || null,
    readingTime: post.readingTime ?? null,
    url: `https://47.116.6.132/blog/${post.slug || post.id}`,
  };
}

const TOOLS = [
  {
    name: "list_posts",
    title: "列出博客文章",
    description: "按时间倒序列出已发布的博客文章摘要（标题、摘要、发布时间）。只返回已发布内容，不含草稿。",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 50, default: 10, description: "返回条数，默认 10，最多 50" },
        page: { type: "integer", minimum: 1, default: 1, description: "页码，默认 1" },
      },
    },
  },
  {
    name: "get_post",
    title: "读取文章全文（可选原始 HTML）",
    description:
      "按 id 读取一篇已发布文章。默认返回纯文本；传 raw=true 返回原始 HTML，不转换、不截断（按 offset/limit 分段），适合在 update_post 前拿到可安全修改的原文。草稿会被拒绝。",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "integer", minimum: 1, description: "文章 id，可从 list_posts 或 search_posts 得到" },
        raw: {
          type: "boolean",
          default: false,
          description: "true 返回原始 HTML（用于精确修改正文），false 返回纯文本",
        },
        offset: {
          type: "integer",
          minimum: 0,
          default: 0,
          description: "仅 raw=true 时生效：从第几个字符开始读，默认 0",
        },
        limit: {
          type: "integer",
          minimum: 1000,
          maximum: 40000,
          default: 20000,
          description: "仅 raw=true 时生效：本次最多返回多少字符，默认 20000",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "search_posts",
    title: "语义搜索文章",
    description: "用自然语言搜索博客文章（后端为向量语义检索 + 字面命中加权）。适合先定位再 get_post 读全文。",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "搜索词或一句话描述，例如「Cordis 插件运行时」" },
        limit: { type: "integer", minimum: 1, maximum: 20, default: 5, description: "返回条数，默认 5" },
      },
      required: ["query"],
    },
  },
  {
    name: "create_post",
    title: "新建文章（可直接发布）",
    description:
      "把一篇文章写入博客。生成系列文章时主动填写 series 和 topic，沿用现有目录的名称；归属不明确或是独立文章时可省略。默认存为草稿；传 publish=true 则立即发布。正文优先用 HTML，纯 Markdown 会自动转换。摘要与标签由后端生成。",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", maxLength: 200, description: "文章标题" },
        content: {
          type: "string",
          description: "文章正文，推荐 HTML 片段（<h2>、<p>、<ul>、<pre><code> 等）；仅当完全不含标签时按 Markdown 处理",
        },
        excerpt: { type: "string", maxLength: 500, description: "可选摘要，留空由后端自动生成" },
        series: { type: "string", maxLength: 160, description: "所属系列全名，按既有目录填写；独立文章可省略" },
        topic: { type: "string", maxLength: 160, description: "所属主题或专题全名；没有明确主题可省略" },
        publish: {
          type: "boolean",
          default: false,
          description: "是否直接发布：true 立即上线，false（默认）存为草稿等人工确认",
        },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "update_post",
    title: "更新文章",
    description:
      "按 id 修改已有文章（草稿或已发布都可以）。只更新传入的字段；正文优先 HTML，纯 Markdown 会自动转换。改标题或正文后，摘要与标签会由后端重新生成。",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "integer", minimum: 1, description: "文章 id，可从 list_posts / search_posts 得到" },
        title: { type: "string", maxLength: 200, description: "新标题，不传则不改" },
        content: {
          type: "string",
          description: "新正文，推荐 HTML 片段；仅当完全不含标签时按 Markdown 处理；不传则不改",
        },
        excerpt: { type: "string", maxLength: 500, description: "新摘要，不传则不改" },
        series: { type: "string", maxLength: 160, description: "新所属系列名称；不传则不改，空字符串清除" },
        topic: { type: "string", maxLength: 160, description: "新所属主题名称；不传则不改，空字符串清除" },
        publish: {
          type: "boolean",
          description: "true 发布上线，false 退回草稿，不传则保持原状态",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_posts",
    title: "批量删除文章",
    description:
      "按 id 永久删除一篇或多篇文章（草稿、已发布都可以），删除后无法恢复。必须显式传 confirm=true 才会执行；单次最多 20 篇。不确定 id 时先用 list_posts 或 search_posts 确认。",
    inputSchema: {
      type: "object",
      properties: {
        ids: {
          type: "array",
          items: { type: "integer", minimum: 1 },
          minItems: 1,
          maxItems: 20,
          description: "要删除的文章 id 列表，单次最多 20 个",
        },
        confirm: {
          type: "boolean",
          description: "必须传 true 才执行删除，防止模型误删",
        },
      },
      required: ["ids", "confirm"],
    },
  },
];

// 每个请求新建一个实例，保证无状态可水平扩展
function createServer() {
  const server = new Server(
    { name: "sunlingyue-blog", version: "1.0.0" },
    {
      capabilities: { tools: {} },
      instructions:
        "这是个人技术博客的接口，支持读取、存草稿、更新、删除与直接发布。用户问博客写过什么时，先用 search_posts 或 list_posts 定位，再用 get_post 读全文；要精确修改正文时，先用 get_post(raw=true) 拿原始 HTML（长文按 offset 分段取全）再调用 update_post。生成文章时调用 create_post，并主动填入已经确定的 series（系列全名）和 topic（主题全名），同一归属沿用现有目录名称；不确定时省略对应字段。默认存草稿，只有用户明确授权发布时才传 publish=true。修改已有文章时先定位 id，update_post 只传要修改的字段。只有用户明确要求删除时才调用 delete_posts、确认 id 并传 confirm=true。标签由服务端按正文生成。",
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args = {} } = req.params;
    try {
      if (name === "list_posts") {
        const data = await apiGet("/posts", { published: "true", limit: args.limit ?? 10, page: args.page ?? 1 });
        const posts = Array.isArray(data) ? data : data?.data || [];
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ total: data?.meta?.total ?? posts.length, posts: posts.map(toSummary) }, null, 2),
            },
          ],
        };
      }

      if (name === "get_post") {
        const post = await apiGet(`/posts/${Number(args.id)}`);
        if (!post || !post.published) {
          return { content: [{ type: "text", text: `未找到已发布的文章 id=${args.id}` }], isError: true };
        }
        if (args.raw === true) {
          const html = String(post.content ?? "");
          const total = html.length;
          const limit = Math.min(Math.max(Number(args.limit) || 20000, 1000), 40000);
          const offset = Math.min(Math.max(Number(args.offset) || 0, 0), total);
          const chunk = html.slice(offset, offset + limit);
          const end = offset + chunk.length;
          const lines = [
            `标题：${post.title}`,
            `id=${post.id}，slug=${post.slug || post.id}`,
            ...(post.series ? [`所属系列：${post.series}`] : []),
            ...(post.topic ? [`所属主题：${post.topic}`] : []),
            `原始 HTML 共 ${total} 字符，本次返回 ${offset}–${end}`,
            end < total
              ? `后面还有 ${total - end} 字符；继续读取传 offset=${end}。分段边界可能落在标签中间，按 offset 顺序拼接即可还原`
              : "已返回全部正文",
            "----- BEGIN HTML -----",
            chunk,
            "----- END HTML -----",
            "（把 BEGIN 与 END 之间的内容原样作为 update_post 的 content，不要带这两行标记）",
          ];
          return { content: [{ type: "text", text: lines.join("\n") }] };
        }

        const body = htmlToText(post.content);
        const truncated = body.length > MAX_CONTENT_CHARS;
        const tagLine = (post.tags || []).map((t) => t.name).join("、");
        const text = [
          `标题：${post.title}`,
          ...(post.series ? [`所属系列：${post.series}`] : []),
          ...(post.topic ? [`所属主题：${post.topic}`] : []),
          `发布时间：${post.publishedAt || post.createdAt}`,
          `标签：${tagLine || "（无）"}`,
          `链接：https://47.116.6.132/blog/${post.slug || post.id}`,
          "",
          truncated ? body.slice(0, MAX_CONTENT_CHARS) : body,
          truncated ? `\n……（正文过长，已截断到 ${MAX_CONTENT_CHARS} 字）` : "",
        ].join("\n");
        return { content: [{ type: "text", text }] };
      }

      if (name === "search_posts") {
        const query = String(args.query || "").trim();
        if (!query) return { content: [{ type: "text", text: "query 不能为空" }], isError: true };
        const data = await apiGet("/posts/search", { q: query, limit: args.limit ?? 5 });
        const list = Array.isArray(data) ? data : data?.data || [];
        return {
          content: [
            { type: "text", text: list.length ? JSON.stringify(list.map(toSummary), null, 2) : `没有搜到与「${query}」相关的文章` },
          ],
        };
      }

      if (name === "create_post") {
        const title = String(args.title || "").trim();
        const raw = String(args.content || "").trim();
        if (!title || !raw) {
          return { content: [{ type: "text", text: "title 与 content 都不能为空" }], isError: true };
        }
        const content = looksLikeHtml(raw) ? raw : markdownToHtml(raw);
        const publish = args.publish === true || args.published === true;
        const created = await apiPost("/posts", {
          title,
          content,
          ...(args.excerpt ? { excerpt: String(args.excerpt) } : {}),
          ...(typeof args.series === "string" ? { series: args.series.trim() } : {}),
          ...(typeof args.topic === "string" ? { topic: args.topic.trim() } : {}),
          published: publish,
        });
        const tags = (created.tags || []).map((t) => t.name).join("、");
        const head = publish ? "已发布" : "已保存为草稿";
        const lines = [
          `${head}：id=${created.id}`,
          `标题：${created.title}`,
          `slug：${created.slug}`,
          ...(created.series ? [`所属系列：${created.series}`] : []),
          ...(created.topic ? [`所属主题：${created.topic}`] : []),
          `标签：${tags || "（未生成）"}`,
        ];
        if (publish) lines.push(`文章链接：https://47.116.6.132/blog/${created.slug}`);
        lines.push(`后台编辑：https://47.116.6.132/admin/posts/${created.id}`);
        return { content: [{ type: "text", text: lines.join("\n") }] };
      }

      if (name === "update_post") {
        const id = Number(args.id);
        if (!Number.isInteger(id) || id <= 0) {
          return { content: [{ type: "text", text: "id 必须是正整数" }], isError: true };
        }

        const patch = {};
        if (typeof args.title === "string" && args.title.trim()) {
          patch.title = args.title.trim();
        }
        if (typeof args.content === "string" && args.content.trim()) {
          const raw = args.content.trim();
          patch.content = looksLikeHtml(raw) ? raw : markdownToHtml(raw);
        }
        if (args.excerpt !== undefined && args.excerpt !== null) {
          patch.excerpt = String(args.excerpt);
        }
        if (typeof args.publish === "boolean") {
          patch.published = args.publish;
        }
        if (typeof args.series === "string") patch.series = args.series.trim();
        if (typeof args.topic === "string") patch.topic = args.topic.trim();

        if (Object.keys(patch).length === 0) {
          return {
            content: [{ type: "text", text: "没有可更新的字段：请至少传 title、content、excerpt、series、topic 或 publish 之一" }],
            isError: true,
          };
        }

        const updated = await apiPatch(`/posts/${id}`, patch);
        const tags = (updated.tags || []).map((t) => t.name).join("、");
        const touchedContent = Boolean(patch.title || patch.content);
        const lines = [
          `已更新：id=${updated.id}`,
          `标题：${updated.title}`,
          `slug：${updated.slug}`,
          ...(updated.series ? [`所属系列：${updated.series}`] : []),
          ...(updated.topic ? [`所属主题：${updated.topic}`] : []),
          `状态：${updated.published ? "已发布" : "草稿"}`,
          `标签：${tags || "（未生成）"}${touchedContent ? "（正文有改动，标签正在后台重算）" : ""}`,
        ];
        if (updated.published) lines.push(`文章链接：https://47.116.6.132/blog/${updated.slug}`);
        lines.push(`后台编辑：https://47.116.6.132/admin/posts/${updated.id}`);
        return { content: [{ type: "text", text: lines.join("\n") }] };
      }

      if (name === "delete_posts") {
        if (args.confirm !== true) {
          return {
            content: [{ type: "text", text: "未执行删除：必须显式传 confirm=true" }],
            isError: true,
          };
        }

        const rawIds = Array.isArray(args.ids) ? args.ids : [];
        const ids = [...new Set(
          rawIds.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0),
        )];
        if (ids.length === 0) {
          return { content: [{ type: "text", text: "ids 不能为空，且必须是正整数" }], isError: true };
        }
        if (ids.length > 20) {
          return { content: [{ type: "text", text: "单次最多删除 20 篇，请分批调用" }], isError: true };
        }

        const deleted = [];
        const failed = [];
        for (const id of ids) {
          try {
            const post = await apiGet(`/posts/${id}`);
            await apiDelete(`/posts/${id}`);
            deleted.push({
              id,
              title: post?.title || "",
              slug: post?.slug || "",
              published: Boolean(post?.published),
            });
          } catch (e) {
            failed.push({ id, error: e.message });
          }
        }

        const lines = [`删除完成：成功 ${deleted.length} 篇，失败 ${failed.length} 篇`];
        for (const p of deleted) {
          lines.push(`- 已删除 id=${p.id}：${p.title}（${p.published ? "已发布" : "草稿"}，/${p.slug}）`);
        }
        for (const f of failed) {
          lines.push(`- 失败 id=${f.id}：${f.error}`);
        }
        return { content: [{ type: "text", text: lines.join("\n") }], isError: deleted.length === 0 };
      }

      return { content: [{ type: "text", text: `未知工具：${name}` }], isError: true };
    } catch (e) {
      return { content: [{ type: "text", text: `调用失败：${e.message}` }], isError: true };
    }
  });

  return server;
}

const app = express();
app.use(express.json({ limit: "8mb" }));

// 设置了 MCP_TOKEN 才校验；支持 Authorization: Bearer 与 ?token=
app.use((req, res, next) => {
  if (!TOKEN) return next();
  const header = req.headers.authorization || "";
  const provided = header.startsWith("Bearer ") ? header.slice(7).trim() : String(req.query.token || "");
  if (provided !== TOKEN) {
    return res.status(401).json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "unauthorized" } });
  }
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

app.post("/mcp", async (req, res) => {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error("[blog-mcp] 处理请求失败:", e);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: "2.0", id: null, error: { code: -32603, message: "internal error" } });
    }
  }
});

// 无状态模式：不提供服务端推送流，也不维护会话
app.get("/mcp", (_req, res) =>
  res.status(405).json({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "method not allowed" } }),
);
app.delete("/mcp", (_req, res) =>
  res.status(405).json({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "method not allowed" } }),
);

app.listen(PORT, "127.0.0.1", () => {
  console.log(`[blog-mcp] 监听 127.0.0.1:${PORT}/mcp，上游 ${API_BASE}，鉴权 ${TOKEN ? "开启" : "关闭"}`);
});
