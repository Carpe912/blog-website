<script setup lang="ts">
definePageMeta({ layout: 'default' })

const config = useRuntimeConfig()

useSeoMeta({
  title: `关于 · ${config.public.siteName}`,
  description: `关于 ${config.public.siteName}`,
})
</script>

<template>
  <div class="reader-column pb-20 pt-10 sm:pt-14">
    <header class="border-b border-[var(--reader-line)] pb-7 sm:pb-9">
      <h1 class="reader-display text-4xl font-bold sm:text-5xl">关于</h1>
      <p class="mt-4 text-lg font-medium">{{ config.public.author }}</p>
      <p class="mt-2 leading-relaxed text-[var(--reader-muted)]">{{ config.public.siteDescription }}</p>
    </header>

    <div class="doc-body mt-8">
      <h2>关于本站</h2>
      <p>
        这是一个用 <strong>Nuxt 3</strong> + <strong>@nuxt/content</strong> 构建的静态博客。
        文章以 Markdown 文件的形式存储在 <code>content/posts/</code> 目录下，
        通过 <code>nuxt generate</code> 构建为静态页面，部署到云服务器上用 nginx 托管。
      </p>

      <h2>技术栈</h2>
      <ul>
        <li>Nuxt 3 · 全栈框架</li>
        <li>@nuxt/content · Markdown 内容管理</li>
        <li>Tailwind CSS · 样式框架</li>
        <li>Shiki · 代码语法高亮</li>
        <li>Nuxt Generate · 静态站点生成</li>
        <li>nginx · 服务器托管</li>
      </ul>
    </div>
  </div>
</template>
