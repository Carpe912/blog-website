<script setup lang="ts">
definePageMeta({ layout: 'default' })

const config = useRuntimeConfig()

useSeoMeta({
  title: `关于 · ${config.public.siteName}`,
  description: `关于 ${config.public.siteName}`,
})
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 sm:px-6 py-16">

    <!-- 头像 + 介绍 -->
    <div class="text-center mb-12">
      <div class="w-24 h-24 rounded-full bg-gradient-to-br from-primary-400 to-indigo-600 flex items-center justify-center mx-auto mb-5 shadow-lg dark:from-primary-600 dark:to-indigo-900">
        <svg class="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2">{{ config.public.author }}</h1>
      <p class="text-gray-500 dark:text-slate-400 text-lg">{{ config.public.siteDescription }}</p>
    </div>

    <!-- 卡片内容 -->
    <div class="space-y-6">
      <!-- 关于本站 -->
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 dark:bg-slate-900 dark:border-slate-800">
        <h2 class="text-lg font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <span class="w-7 h-7 bg-primary-100 dark:bg-primary-950 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
          关于本站
        </h2>
        <p class="text-gray-600 dark:text-slate-300 leading-relaxed">
          这是一个用 <strong>Nuxt 3</strong> + <strong>@nuxt/content</strong> 构建的静态博客。
          文章以 Markdown 文件的形式存储在 <code class="bg-gray-100 dark:bg-slate-800 text-primary-700 dark:text-primary-300 px-1.5 py-0.5 rounded text-sm">content/posts/</code> 目录下，
          通过 <code class="bg-gray-100 dark:bg-slate-800 text-primary-700 dark:text-primary-300 px-1.5 py-0.5 rounded text-sm">nuxt generate</code> 构建为静态页面，
          部署到云服务器上用 nginx 托管。
        </p>
      </div>

      <!-- 技术栈 -->
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 dark:bg-slate-900 dark:border-slate-800">
        <h2 class="text-lg font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <span class="w-7 h-7 bg-emerald-100 dark:bg-emerald-950 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </span>
          技术栈
        </h2>
        <div class="grid grid-cols-2 gap-3">
          <div
            v-for="item in [
              { name: 'Nuxt 3', desc: '全栈框架' },
              { name: '@nuxt/content', desc: 'Markdown 内容管理' },
              { name: 'Tailwind CSS', desc: '样式框架' },
              { name: 'Shiki', desc: '代码语法高亮' },
              { name: 'Nuxt Generate', desc: '静态站点生成' },
              { name: 'nginx', desc: '服务器托管' },
            ]"
            :key="item.name"
            class="flex items-center gap-2.5 p-3 bg-gray-50 dark:bg-slate-800/80 rounded-xl"
          >
            <div class="w-2 h-2 rounded-full bg-primary-400 shrink-0" />
            <div>
              <p class="text-sm font-medium text-gray-800 dark:text-slate-200">{{ item.name }}</p>
              <p class="text-xs text-gray-400 dark:text-slate-500">{{ item.desc }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 如何联系 -->
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 dark:bg-slate-900 dark:border-slate-800">
        <h2 class="text-lg font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <span class="w-7 h-7 bg-blue-100 dark:bg-blue-950 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </span>
          联系我
        </h2>
        <p class="text-gray-500 dark:text-slate-400 text-sm leading-relaxed">
          可以在这里填写你的联系方式、社交媒体链接等。
          例如：GitHub、Twitter/X、邮箱等。
        </p>
        <p class="text-xs text-gray-400 dark:text-slate-500 mt-3">
          👉 编辑 <code class="bg-gray-100 dark:bg-slate-800 px-1 rounded">pages/about.vue</code> 来自定义这个页面。
        </p>
      </div>
    </div>

    <!-- 返回 -->
    <div class="mt-10 text-center">
      <NuxtLink to="/" class="btn-secondary">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        返回首页
      </NuxtLink>
    </div>

  </div>
</template>
