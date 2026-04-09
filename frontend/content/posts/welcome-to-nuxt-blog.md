---
title: 欢迎使用 Nuxt Blog！
date: 2025-03-01
tags:
  - 教程
  - 技术
excerpt: 这是你的第一篇博客文章。本篇会介绍博客的功能特性，以及如何写你自己的文章。
cover: ''
---

# 欢迎使用 Nuxt Blog！

很高兴你能看到这篇文章。这个博客系统基于 **Nuxt 3** + **@nuxt/content** 构建，写文章只需要在 `content/posts/` 目录下创建 Markdown 文件即可，构建后就会自动生成对应的页面。

## 如何写一篇新文章？

在 `content/posts/` 目录下新建一个 `.md` 文件，例如 `my-first-post.md`。文件名会成为文章的 URL（`/blog/my-first-post`）。

每篇文章开头需要填写 **Frontmatter**（文章元信息）：

```yaml
---
title: 文章标题
date: 2025-03-15
tags:
  - 标签一
  - 标签二
excerpt: 文章的简短描述，会显示在卡片列表中
cover: /images/my-cover.jpg   # 可选，封面图
---
```

## 支持的 Markdown 语法

### 文字样式

**粗体**、*斜体*、~~删除线~~、`行内代码`

### 引用块

> 好的文章不是写出来的，而是改出来的。
> ——佚名

### 代码块（自动语法高亮）

```typescript
// TypeScript 示例
interface Post {
  title: string
  date: string
  tags: string[]
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
```

```bash
# 安装依赖
npm install

# 本地开发
npm run dev

# 构建静态文件（用于服务器部署）
npm run generate
```

### 列表

**无序列表：**

- Nuxt 3 全栈框架
- @nuxt/content 内容管理
- Tailwind CSS 样式
- 自动代码高亮

**有序列表：**

1. 新建 Markdown 文件
2. 填写 Frontmatter 元信息
3. 正文用 Markdown 写作
4. 运行 `npm run generate` 构建

### 表格

| 功能 | 说明 | 状态 |
|------|------|------|
| 文章列表 | 首页展示所有文章卡片 | ✅ |
| 文章详情 | Markdown 渲染 + 代码高亮 | ✅ |
| 标签筛选 | 按标签过滤文章 | ✅ |
| 目录导航 | 文章内容右侧 ToC | ✅ |
| 静态部署 | nginx 托管，无需 Node | ✅ |

### 图片

图片放在 `public/images/` 目录下，然后在文章里引用：

```markdown
![描述文字](/images/my-image.jpg)
```

## 部署到云服务器

构建完成后，将 `.output/public/` 目录上传到服务器，用 nginx 配置一个静态站点即可：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/blog;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

祝你写作愉快！ 🎉
