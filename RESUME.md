# 简历项目描述 · 个人技术博客平台

> 本文件包含两个版本：
> - **详细版**：用于项目介绍、面试展开讲解、个人作品集页面
> - **精简版**：直接复制进简历的一段话 / 条目

---

## 一、详细版

### 项目名称

**个人全栈技术博客平台**（[sunlingyue.cn](https://sunlingyue.cn)）

### 项目概述

从零独立完成的全栈个人博客平台，覆盖前端开发、后端 API、数据库设计、服务器配置、Nginx 反向代理、域名与 HTTPS 接入、CI/CD 自动化部署，以及基于 Claude API 的 AI 内容自动生成系统，是一套端到端的完整工程实践。

---

### 技术栈

| 层次 | 技术 |
|------|------|
| **前端** | Nuxt 3（Vue 3 SSR）、TypeScript、Tailwind CSS、marked |
| **后端** | NestJS、Prisma ORM、PostgreSQL |
| **服务器** | 阿里云 ECS（Ubuntu）、Nginx、PM2、宝塔面板 |
| **AI 自动化** | Claude API（claude-opus）、GitHub Search API、TypeScript |
| **CI/CD** | GitHub Actions + SSH 自动部署 / 宝塔 Webhook |
| **域名 & HTTPS** | 阿里云域名、Let's Encrypt SSL 证书（宝塔申请） |

---

### 各模块详细说明

#### 1. 前端（Nuxt 3）

- 采用 **Nuxt 3 SSR 模式**，兼顾首屏渲染性能与 SEO。
- 使用 `useAsyncData` + 自定义 `usePostsApi` composable 统一封装所有 API 调用，前后端解耦清晰。
- 页面包括：博客首页（含标签筛选、分页）、文章详情页（Markdown 渲染、阅读时长、上一篇/下一篇导航）、标签聚合页、关于页、完整后台管理系统（文章增删改查、标签管理、登录鉴权）。
- Tailwind CSS 实现完整的**深色/浅色主题切换**，主题状态持久化至 `localStorage`，切换无闪烁（通过内联脚本在 `<head>` 预设 class）。
- 详情页支持文章目录（TOC）、代码块高亮、图片圆角等排版优化，整体视觉风格简洁克制。

#### 2. 后端（NestJS + Prisma + PostgreSQL）

- 使用 **NestJS** 按模块化组织代码，包含 `posts`、`tags`、`auth` 三个模块，每模块分离 Controller / Service / DTO。
- **Prisma** 作为 ORM，数据库 schema 定义清晰，支持 `prisma migrate` 版本化管理，生产环境使用 `migrate deploy` 保证安全。
- 数据模型：`Post`（文章）、`Tag`（标签）、`PostTag`（多对多关联），关系查询通过 Prisma `include` 处理，返回结果统一 `formatPost` 序列化。
- API 接口完备，除常规 CRUD 外，额外实现：
  - `GET /posts/slug/:slug` — 按 slug 查询文章（前台路由需要）
  - `GET /posts/slug/:slug/adjacent` — 查询上一篇/下一篇（`createdAt` 时序比较，两次并行查询）
- 全局拦截器（`TransformInterceptor`）统一响应格式，全局异常过滤器（`HttpExceptionFilter`）统一错误处理。
- 管理后台通过 `AdminGuard` + Cookie 鉴权保护，前台完全公开，无需登录。

#### 3. 服务器配置

- **系统**：阿里云 ECS，Ubuntu，公网 IP `47.116.6.132`，域名 `sunlingyue.cn`。
- **Node 环境**：通过 `nvm` 管理 Node.js 版本（v22 LTS），避免与系统包管理器冲突。
- **进程守护**：使用 **PM2** 分别启动前端（端口 3000）和后端（端口 3001），配置 `pm2 save` + `pm2 startup` 实现开机自启。
- **数据库**：PostgreSQL 本机运行（端口 5432），修改 `pg_hba.conf` 将认证方式改为 `md5` 密码模式，创建专用数据库 `blog_db`。

#### 4. Nginx 反向代理 & HTTPS

- Nginx 统一监听 80/443 端口，按路径前缀分发请求：
  - `/api/` → 反向代理至 NestJS（:3001）
  - `/`（其余）→ 反向代理至 Nuxt SSR（:3000）
- 代理配置正确传递 `X-Real-IP`、`X-Forwarded-For`、`X-Forwarded-Proto` 等 Header，支持 WebSocket Upgrade。
- **端口安全**：3000、3001、5432 端口不对外暴露（防火墙规则关闭），所有流量必须经由 Nginx 进入。
- 通过宝塔面板申请 **Let's Encrypt 免费 SSL 证书**，启用 HTTPS 并强制 HTTP → HTTPS 重定向。

#### 5. CI/CD 自动化部署

实现两套自动部署方案（可按场景选用）：

**方案一：GitHub Actions + SSH**
- 推送到 `main` 分支触发 workflow，通过 SSH 远程连接服务器。
- 自动执行：`git pull` → 安装依赖 → `prisma migrate deploy` → `npm run build` → `pm2 restart`，全流程无需手动干预。
- Secrets 管理：`SSH_HOST`、`SSH_PORT`、`SSH_USER`、`SSH_PRIVATE_KEY` 存储在 GitHub 仓库 Secrets，不暴露于代码中。

**方案二：宝塔 Webhook**
- GitHub 仓库配置 Webhook，push 事件触发宝塔 HTTP 接口，服务器本地执行部署脚本 `deploy.sh`。
- 部署脚本用 `set -e` 保证任意步骤失败即终止，日志写入 `/www/wwwlogs/deploy.log` 方便排查。

#### 6. AI 自动生成文章系统

这是整个项目最有技术含量的 "bonus" 模块，用 TypeScript 实现，可独立运行：

**核心流程：**
1. **关键词轮换**：维护 12 个技术主题（富文本编辑器、RAG、向量数据库、LLM 推理引擎等），每次运行自动轮换到下一个，避免内容重复。
2. **GitHub 搜索**：调用 GitHub Search API，按关键词搜索 Star 数最高的开源仓库，过滤掉已写过的（通过 `published-log.json` 记录历史）。
3. **信息抓取**：对选定仓库抓取 README、近期 Commits、最新 Release Notes、核心源码文件，构建结构化上下文。
4. **两阶段 AI 生成**：
   - **规划阶段**：用 Claude 分析仓库复杂度，决定写单篇还是连载（2-4篇），输出每篇的标题和写作重点（XML 格式，便于解析）。
   - **生成阶段**：对每篇分别调用 Claude（`claude-opus-4-6`，开启 `adaptive thinking`，`max_tokens: 32000`），生成 4000 字以上的深度中文技术文章，包含作者观点、代码分析、横向对比。
5. **自动发布**：生成完成后调用博客后端 API，自动创建文章并打标签，发布成功记录到历史文件，下次不再重复。

**提示词设计亮点：**
- System Prompt 设定"10年经验工程师"人格，强调有观点、不套模板、语言有个性。
- 规划 Prompt 和生成 Prompt 分离，规划阶段轻量（2k tokens），生成阶段开放上限（32k tokens）。
- 连载文章通过 Prompt 上下文传递篇章关系，首篇交代背景，中间篇跳过重复介绍，末篇做全局评价。
- 支持 `--dry-run` 参数只生成不发布，方便调试提示词效果。

---

### 遇到的挑战与解决方案

| 挑战 | 解决方案 |
|------|----------|
| Nuxt 3 SSR 与后端 API 的跨域问题 | 通过 Nginx 将 `/api/` 统一代理到后端，前端只需请求同域地址，彻底绕过 CORS |
| PostgreSQL `peer` 认证导致 Prisma 连接失败 | 修改 `pg_hba.conf` 改为 `md5` 认证，允许密码登录 |
| PM2 在非交互式 Shell 中找不到 nvm 的 Node | 在部署脚本中手动 `source $NVM_DIR/nvm.sh` 加载 nvm 环境变量 |
| Claude 生成文章结构不稳定导致解析失败 | 要求 AI 输出严格 XML 格式，编写容错解析逻辑（fallback 到原始文本） |
| 连载文章各篇重复介绍项目背景 | 在 Prompt 中根据 `partIndex` 动态注入"直接进入主题"或"交代背景"的指令 |

---

## 二、精简版（直接用于简历）

### 条目写法（适合项目经历一栏）

---

**个人全栈技术博客平台** | Nuxt 3 · NestJS · PostgreSQL · Nginx · Claude API　　*2024.xx — 至今*

- 独立完成从零搭建：Nuxt 3 SSR 前端 + NestJS RESTful 后端 + PostgreSQL 数据库，实现文章管理、标签筛选、分页、深色模式等完整博客功能。
- 完成服务器全套配置：阿里云 ECS 部署，Nginx 反向代理（区分 `/api/` 与前端路由），Let's Encrypt HTTPS，PM2 进程守护 + 开机自启，防火墙端口策略。
- 配置 GitHub Actions CI/CD，推送 `main` 分支自动触发 SSH 远程部署（拉代码 → 数据库迁移 → 构建 → 重启），全程免手动。
- 开发 AI 内容生成脚本：调用 Claude API 两阶段生成深度技术文章（规划连载结构 → 逐篇生成 4000+ 字），结合 GitHub Search API 自动选题、去重，发布至博客，实现内容自动化运营。

---

### 一段话写法（适合自我介绍或作品集描述）

> 独立设计并落地了一套完整的个人技术博客平台（sunlingyue.cn），前端基于 Nuxt 3 SSR、后端基于 NestJS + Prisma + PostgreSQL，部署在阿里云 ECS，Nginx 反向代理 + Let's Encrypt HTTPS + PM2 进程守护，并通过 GitHub Actions 实现推送即自动部署。此外开发了一套 AI 内容自动化系统：利用 GitHub Search API 自动选题，调用 Claude API 两阶段生成（先规划连载结构，再逐篇深度写作），自动发布到博客，将内容生产成本降到接近零。整个项目从代码到服务器配置到 AI 工程化均独立完成，是我对全栈工程能力的完整验证。

---

## 三、面试时可以展开讲的要点

> 记录一些面试官可能追问的问题，以及可以展开的角度

**Q: 为什么选 Nuxt 3 而不是纯 Vue 或 Next.js？**
- Nuxt 3 原生 SSR，对 SEO 友好（博客场景需要）；对比 Next.js，生态是 Vue，更熟悉；`useAsyncData` 等封装让数据请求写起来很自然。

**Q: Prisma 和直接写 SQL 相比有什么取舍？**
- Prisma 提供类型安全的 ORM，schema 即文档，迁移版本化管理，对于中小型项目大幅提高开发效率；代价是复杂查询（如原生 JOIN）不如直接写 SQL 灵活，但博客场景下复杂度有限，值得。

**Q: AI 生成的文章质量如何控制？**
- 两阶段分离（规划 + 生成）是关键，规划阶段让 Claude 决定文章结构，生成阶段专注于内容深度；System Prompt 中明确"有观点、不套模板"等写作风格约束；开启 `adaptive thinking` 让模型在生成前进行推理，内容深度明显提升。

**Q: 部署遇到过什么坑？**
- PostgreSQL `peer` 认证、PM2 找不到 nvm Node、Nginx 代理时 WebSocket Header 漏传等，均已逐一排查解决，具体方案记录在项目 `DEPLOY.md` 中。

**Q: 这个项目和你的工程能力有什么关系？**
- 这是一个端到端的"一个人的全栈"，而不是只写前端或只写后端。从产品设计到代码实现到服务器运维到 AI 工程化，每一层都需要独立决策和解决问题，是对工程综合能力最真实的验证。
