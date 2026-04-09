# Blog Website

基于 **Nuxt 3 + NestJS + Prisma + PostgreSQL** 的全栈博客系统，采用 Monorepo 结构组织前后端代码。

---

## 项目结构

```
blog-website/
├── package.json               # 根 workspace（concurrently 同时启动前后端）
├── frontend/                  # Nuxt 3 前端
│   ├── composables/
│   │   ├── useApi.ts          # 对接后端的 API composable
│   │   └── useAppTheme.ts     # 主题管理（亮/暗/系统）
│   ├── middleware/
│   │   └── admin.ts           # Admin 路由守卫（cookie 鉴权）
│   ├── layouts/
│   │   ├── default.vue        # 默认布局（Header + Footer）
│   │   └── admin.vue          # Admin 侧边栏布局
│   ├── components/
│   │   ├── PostForm.vue       # 文章新建/编辑表单组件
│   │   ├── BlogCard.vue       # 文章卡片
│   │   ├── TagBadge.vue       # 标签徽章
│   │   ├── AppHeader.vue      # 顶部导航
│   │   ├── AppFooter.vue      # 底部栏
│   │   └── ThemeToggle.vue    # 主题切换
│   ├── pages/
│   │   ├── index.vue          # 首页（文章列表 + 标签过滤）
│   │   ├── about.vue          # 关于页
│   │   ├── blog/[...slug].vue # 文章详情（ToC + 阅读进度）
│   │   ├── tags/[tag].vue     # 按标签筛选
│   │   └── admin/             # 管理后台
│   │       ├── login.vue      # 登录页
│   │       ├── index.vue      # 仪表盘
│   │       ├── posts/
│   │       │   ├── index.vue  # 文章列表（搜索/过滤/分页）
│   │       │   ├── new.vue    # 新建文章
│   │       │   └── [id].vue   # 编辑文章
│   │       └── tags/
│   │           └── index.vue  # 标签管理（增删改）
│   └── content/posts/         # Markdown 博客内容（静态）
└── backend/                   # NestJS 后端
    ├── .env                   # 环境变量（数据库连接、端口、管理密码）
    ├── prisma/
    │   └── schema.prisma      # 数据模型（Post + Tag + PostTag）
    └── src/
        ├── main.ts            # 入口（CORS、全局 ValidationPipe）
        ├── app.module.ts      # 根模块
        ├── prisma/            # PrismaService 全局模块
        └── modules/
            ├── posts/         # 文章 CRUD（分页/搜索/slug 查询）
            ├── tags/          # 标签 CRUD
            └── auth/          # 登录接口（密码校验）
```

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端框架 | [Nuxt 3](https://nuxt.com) |
| 样式 | [Tailwind CSS](https://tailwindcss.com) + Typography |
| 内容（静态） | [@nuxt/content](https://content.nuxt.com)（Markdown） |
| 后端框架 | [NestJS](https://nestjs.com) |
| ORM | [Prisma](https://prisma.io) |
| 数据库 | PostgreSQL |

---

## 本地开发

### 前置条件

- Node.js >= 18
- PostgreSQL >= 14

### 1. 安装 PostgreSQL（macOS）

```bash
brew install postgresql@16
brew services start postgresql@16
createdb blog_db
```

> 若 `createdb` 不在 PATH，先执行：
> ```bash
> export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
> ```

### 2. 安装依赖

```bash
# 安装后端依赖
cd backend && npm install

# 安装前端依赖
cd ../frontend && npm install
```

### 3. 配置环境变量

编辑 `backend/.env`：

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/blog_db?schema=public"
PORT=3001
ADMIN_PASSWORD=admin123
CORS_ORIGIN=http://localhost:4000
```

### 4. 初始化数据库

```bash
cd backend

# 生成 Prisma Client
npx prisma generate

# 执行数据库迁移（创建表结构）
npx prisma migrate dev --name init
```

### 5. 启动服务

**终端 1 — 后端（端口 3001）：**
```bash
cd backend && npm run start:dev
```

**终端 2 — 前端（端口 8080）：**
```bash
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

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/auth/login` | 管理后台登录，Body: `{ "password": "..." }` |

### 文章（Posts）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/posts` | 文章列表，支持查询参数：`page` / `limit` / `search` / `published` / `tagId` |
| `GET` | `/api/posts/:id` | 按 ID 查文章 |
| `GET` | `/api/posts/slug/:slug` | 按 slug 查文章 |
| `POST` | `/api/posts` | 创建文章 |
| `PATCH` | `/api/posts/:id` | 更新文章 |
| `DELETE` | `/api/posts/:id` | 删除文章 |

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
