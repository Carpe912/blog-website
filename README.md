# Blog Website

基于 **Nuxt 3 + NestJS + Prisma + PostgreSQL** 的全栈博客系统，采用 Monorepo 结构组织前后端代码。

---

## 项目结构

```
blog-website/
├── package.json                   # 根 workspace（concurrently 同时启动前后端）
│
├── frontend/                      # Nuxt 3 前端（端口 8080）
│   ├── nuxt.config.ts             # Nuxt 配置（runtimeConfig.public.apiBase 指向后端）
│   ├── tailwind.config.ts         # Tailwind + Typography 配置
│   ├── app.vue                    # 根组件（NuxtLayout + NuxtPage）
│   ├── error.vue                  # 全局错误页（404 / 5xx）
│   ├── assets/css/tailwind.css    # 全局样式 + 自定义组件类
│   ├── public/
│   │   ├── favicon.svg
│   │   └── theme-init.js          # 防止暗黑模式 FOUC 的内联脚本
│   ├── composables/
│   │   ├── useApi.ts              # 对接后端的 API composable（Posts / Tags）
│   │   └── useAppTheme.ts         # 主题管理（亮/暗/系统，localStorage 持久化）
│   ├── middleware/
│   │   └── admin.ts               # Admin 路由守卫（校验 admin_token cookie）
│   ├── layouts/
│   │   ├── default.vue            # 默认布局（AppHeader + AppFooter）
│   │   └── admin.vue              # Admin 侧边栏布局
│   ├── components/
│   │   ├── AppHeader.vue          # 顶部导航（移动端汉堡菜单 + 主题切换）
│   │   ├── AppFooter.vue          # 滚动触发的底部固定栏
│   │   ├── BlogCard.vue           # 文章卡片（封面 / 标签 / 阅读时间）
│   │   ├── TagBadge.vue           # 可点击标签徽章（sm/md 尺寸 + active 状态）
│   │   ├── ThemeToggle.vue        # 主题切换下拉菜单
│   │   └── PostForm.vue           # 文章新建/编辑表单（Admin 使用）
│   ├── pages/
│   │   ├── index.vue              # 首页（文章列表 + 标签过滤 + 分页）
│   │   ├── about.vue              # 关于页
│   │   ├── blog/[...slug].vue     # 文章详情（ToC + 阅读进度 + 上下篇）
│   │   ├── tags/
│   │   │   ├── index.vue          # 标签总览页
│   │   │   └── [tag].vue          # 按标签筛选文章
│   │   └── admin/                 # 管理后台（需 admin_token cookie）
│   │       ├── login.vue          # 登录页
│   │       ├── index.vue          # 仪表盘（文章/标签统计）
│   │       ├── posts/
│   │       │   ├── index.vue      # 文章列表（搜索 / 发布状态过滤 / 分页）
│   │       │   ├── new.vue        # 新建文章
│   │       │   └── [id].vue       # 编辑文章
│   │       └── tags/
│   │           └── index.vue      # 标签管理（增删改）
│   └── content/posts/             # Markdown 静态博客内容（@nuxt/content 读取）
│       ├── deploy-with-nginx.md
│       └── markdown-writing-tips.md
│
└── backend/                       # NestJS 后端（端口 3001）
    ├── .env                       # 环境变量（数据库连接 / 端口 / 管理密码）
    ├── nest-cli.json
    ├── tsconfig.json
    ├── package.json
    ├── prisma/
    │   └── schema.prisma          # 数据模型（Post + Tag + PostTag）
    └── src/
        ├── main.ts                # 入口（CORS / cookie-parser / 全局 pipe/filter/interceptor）
        ├── app.module.ts          # 根模块
        ├── prisma/
        │   ├── prisma.module.ts   # PrismaModule（全局）
        │   └── prisma.service.ts  # PrismaService（封装 PrismaClient）
        ├── common/
        │   ├── guards/
        │   │   └── admin.guard.ts          # Admin 路由守卫（校验 cookie/header token）
        │   ├── filters/
        │   │   └── http-exception.filter.ts  # 全局异常过滤器（统一错误格式）
        │   └── interceptors/
        │       └── transform.interceptor.ts  # 统一成功响应格式
        └── modules/
            ├── auth/
            │   ├── auth.module.ts
            │   └── auth.controller.ts     # POST /api/auth/login
            ├── posts/
            │   ├── posts.module.ts
            │   ├── posts.controller.ts    # CRUD /api/posts
            │   ├── posts.service.ts       # 业务逻辑（分页/搜索/slug查询）
            │   └── dto/
            │       ├── create-post.dto.ts
            │       ├── update-post.dto.ts
            │       └── query-post.dto.ts
            └── tags/
                ├── tags.module.ts
                ├── tags.controller.ts     # CRUD /api/tags
                ├── tags.service.ts
                └── dto/
                    ├── create-tag.dto.ts
                    └── update-tag.dto.ts
```

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端框架 | [Nuxt 3](https://nuxt.com) |
| 样式 | [Tailwind CSS](https://tailwindcss.com) + Typography 插件 |
| 静态内容 | [@nuxt/content](https://content.nuxt.com)（Markdown，Shiki 代码高亮） |
| 后端框架 | [NestJS 10](https://nestjs.com) |
| ORM | [Prisma 6](https://prisma.io) |
| 数据库 | PostgreSQL >= 14 |
| 运行时 | Node.js >= 18 |

---

## 本地开发

### 前置条件

- Node.js >= 18
- PostgreSQL >= 14（见下方安装步骤）

---

### 第一步：安装 PostgreSQL（macOS）

```bash
brew install postgresql@16
brew services start postgresql@16

# 若 createdb 不在 PATH，先执行：
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

# 创建数据库
createdb blog_db
```

---

### 第二步：安装依赖

```bash
# 在项目根目录安装所有 workspace 依赖
npm install

# 或分别安装
cd backend && npm install
cd ../frontend && npm install
```

> 安装完成后，`frontend` 的 `postinstall` 会自动运行 `nuxt prepare` 生成类型。

---

### 第三步：配置环境变量

**后端** — 编辑 `backend/.env`：

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/blog_db?schema=public"
PORT=3001
ADMIN_PASSWORD=admin123
CORS_ORIGIN=http://localhost:8080
```

> `CORS_ORIGIN` 需与前端开发端口一致（默认 `8080`）。

---

### 第四步：初始化数据库

```bash
cd backend

# 生成 Prisma Client
npx prisma generate

# 执行迁移（创建表结构）
npx prisma migrate dev --name init
```

---

### 第五步：启动服务

**方式一：根目录一键启动（前后端并行）**

```bash
# 在项目根目录
npm run dev
```

**方式二：分别启动**

```bash
# 终端 1 — 后端（端口 3001）
cd backend && npm run start:dev

# 终端 2 — 前端（端口 8080）
cd frontend && npm run dev
```

---

## 访问地址

| 地址 | 说明 |
|------|------|
| `http://localhost:8080` | 博客前台 |
| `http://localhost:8080/admin/login` | 管理后台登录 |
| `http://localhost:3001/api` | NestJS REST API |

默认管理密码：`admin123`（在 `backend/.env` 的 `ADMIN_PASSWORD` 中修改）

---

## API 接口

所有接口统一响应格式：

```json
// 成功
{ "success": true, "data": ..., "timestamp": "..." }

// 失败
{ "success": false, "statusCode": 400, "message": "...", "timestamp": "...", "path": "..." }
```

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/auth/login` | 登录，Body: `{ "password": "..." }`，返回 `{ token }` |

### 文章（Posts）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/posts` | 文章列表，查询参数：`page` / `limit` / `search` / `published` / `tagId` |
| `GET` | `/api/posts/:id` | 按 ID 查文章 |
| `GET` | `/api/posts/slug/:slug` | 按 slug 查文章 |
| `POST` | `/api/posts` | 创建文章 |
| `PATCH` | `/api/posts/:id` | 更新文章 |
| `DELETE` | `/api/posts/:id` | 删除文章（返回 204） |

### 标签（Tags）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/tags` | 标签列表（含关联文章数） |
| `GET` | `/api/tags/:id` | 按 ID 查标签 |
| `POST` | `/api/tags` | 创建标签 |
| `PATCH` | `/api/tags/:id` | 更新标签 |
| `DELETE` | `/api/tags/:id` | 删除标签 |

---

## 数据模型

```prisma
model Post {
  id          Int       @id @default(autoincrement())
  title       String
  slug        String    @unique
  excerpt     String?
  content     String    @db.Text
  cover       String?
  published   Boolean   @default(false)
  publishedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  tags        PostTag[]
}

model Tag {
  id        Int       @id @default(autoincrement())
  name      String    @unique
  slug      String    @unique
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  posts     PostTag[]
}

model PostTag {
  post   Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  postId Int
  tag    Tag  @relation(fields: [tagId], references: [id], onDelete: Cascade)
  tagId  Int

  @@id([postId, tagId])
}
```

---

## 认证机制

- 后端 `POST /api/auth/login` 校验 `ADMIN_PASSWORD`，返回 base64 token
- 前端将 token 存入 `admin_token` cookie
- `middleware/admin.ts` 拦截所有 `/admin/*` 路由，无 cookie 则重定向到 `/admin/login`
- 后端 `AdminGuard` 从 cookie 或 `Authorization: Bearer <token>` 中读取 token 进行校验

> **注意**：当前 token 为简单 base64 编码，生产环境请替换为 JWT（`@nestjs/jwt`）。

---

## 后端公共模块说明（`src/common/`）

| 文件 | 类型 | 作用 |
|------|------|------|
| `guards/admin.guard.ts` | Guard | 保护需要管理员权限的路由 |
| `filters/http-exception.filter.ts` | Filter | 全局捕获异常，统一错误响应格式 |
| `interceptors/transform.interceptor.ts` | Interceptor | 统一包装成功响应格式 |

---

## NPM Scripts

### 根目录

| 命令 | 说明 |
|------|------|
| `npm run dev` | 并行启动前端（8080）和后端（3001） |
| `npm run build` | 顺序构建后端再构建前端 |
| `npm run dev:frontend` | 仅启动前端 |
| `npm run dev:backend` | 仅启动后端 |

### 后端（`backend/`）

| 命令 | 说明 |
|------|------|
| `npm run start:dev` | 开发模式（热重载） |
| `npm run build` | 构建到 `dist/` |
| `npm run start:prod` | 生产启动 |
| `npm run prisma:generate` | 生成 Prisma Client |
| `npm run prisma:migrate` | 执行数据库迁移 |

### 前端（`frontend/`）

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式（端口 8080） |
| `npm run build` | SSR 构建 |
| `npm run generate` | SSG 静态生成 |
| `npm run preview` | 预览构建产物 |

---

## 注意事项

1. **`cookie-parser` 依赖**：后端使用了 `cookie-parser`，需手动安装：
   ```bash
   cd backend && npm install cookie-parser @types/cookie-parser
   ```

2. **CORS 配置**：`backend/.env` 的 `CORS_ORIGIN` 必须与前端端口一致（默认 `http://localhost:8080`）。

3. **中文标签路由**：`nuxt.config.ts` 中已跳过部分中文标签路由的预渲染，避免 URL 编码问题。

4. **静态内容与数据库内容并存**：`frontend/content/posts/` 下的 Markdown 文件由 `@nuxt/content` 读取（静态），数据库中的文章由后端 API 提供，两者目前相互独立。
