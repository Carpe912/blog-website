---
title: Nuxt 3 快速上手指南
date: 2025-03-10
tags:
  - Nuxt
  - 前端
  - Vue
excerpt: Nuxt 3 是基于 Vue 3 的全栈框架，内置了路由、SSR/SSG、文件系统路由等能力。本文带你快速了解核心概念。
cover: ''
---

# Nuxt 3 快速上手指南

Nuxt 3 是一个基于 **Vue 3** 的全栈框架，内置了自动路由、服务端渲染（SSR）、静态生成（SSG）以及强大的模块生态系统，让你可以专注于业务逻辑，而不是配置。

## 目录

## 为什么选择 Nuxt 3？

- **文件系统路由**：在 `pages/` 目录下建文件，路由自动生成
- **零配置 SSR/SSG**：开箱即用的服务端渲染和静态生成
- **自动导入**：组件和 Composables 无需手动 import
- **Nitro 引擎**：可部署到任何平台（Node.js、边缘函数、静态文件）
- **TypeScript 优先**：原生 TypeScript 支持，无需额外配置

## 项目结构

一个典型的 Nuxt 3 项目长这样：

```
my-nuxt-app/
├── assets/          # 静态资源（CSS、字体等，会被构建工具处理）
├── components/      # Vue 组件（自动导入）
├── content/         # @nuxt/content 的 Markdown 内容目录
├── layouts/         # 布局组件
├── pages/           # 页面组件（文件名 = 路由）
│   ├── index.vue    # 首页 /
│   └── about.vue   # 关于页 /about
├── public/          # 纯静态资源（不经过构建）
├── server/          # 服务端 API（可选）
├── app.vue          # 根组件
└── nuxt.config.ts   # 配置文件
```

## 页面路由

Nuxt 3 根据 `pages/` 目录自动生成路由：

| 文件路径 | 对应路由 |
|----------|----------|
| `pages/index.vue` | `/` |
| `pages/about.vue` | `/about` |
| `pages/blog/[slug].vue` | `/blog/:slug` |
| `pages/blog/[...slug].vue` | `/blog/*` (通配) |

动态路由参数通过 `useRoute()` 获取：

```vue
<script setup>
const route = useRoute()
console.log(route.params.slug) // 获取 URL 参数
</script>
```

## Composables — 逻辑复用

Nuxt 3 提供了大量内置 Composables，放在 `composables/` 目录下的文件也会被自动导入：

```typescript
// composables/useFormatDate.ts
export function useFormatDate() {
  function format(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }
  return { format }
}
```

```vue
<script setup>
// 无需 import，直接使用
const { format } = useFormatDate()
</script>
```

## 数据获取

Nuxt 3 推荐使用 `useAsyncData` 或 `useFetch` 进行数据获取，它们在 SSR/SSG 模式下会在服务端运行：

```vue
<script setup>
// 用 @nuxt/content 获取文章列表
const { data: posts } = await useAsyncData('posts', () =>
  queryContent('/posts')
    .sort({ date: -1 })
    .limit(10)
    .find()
)
</script>
```

## SEO 配置

用 `useSeoMeta` 为每个页面设置 SEO 信息：

```vue
<script setup>
useSeoMeta({
  title: '文章标题',
  description: '文章描述',
  ogTitle: '文章标题',
  ogDescription: '文章描述',
  ogImage: '/images/cover.jpg',
})
</script>
```

## 构建部署

```bash
# SSG 模式（推荐）：生成纯静态文件
npm run generate
# 输出到 .output/public/，直接用 nginx 托管

# SSR 模式：需要 Node.js 运行时
npm run build
node .output/server/index.mjs
```

SSG 模式对于博客类场景是最佳选择——构建一次，全球 CDN 分发，访问速度极快。

## 小结

Nuxt 3 的核心理念是"约定优于配置"——只要遵循目录约定，大部分功能都会自动工作。对于博客这类内容型网站，配合 `@nuxt/content` 模块，开发体验非常流畅。
