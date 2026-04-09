<script setup lang="ts">
const error = useError()
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4">
    <div class="text-center">
      <p class="text-8xl font-black text-primary-200 dark:text-primary-900 select-none">{{ error?.statusCode }}</p>
      <h1 class="mt-2 text-2xl font-bold text-gray-800 dark:text-slate-100">
        {{ error?.statusCode === 404 ? '页面不存在' : '出错了' }}
      </h1>
      <p class="mt-2 text-gray-500 dark:text-slate-400 text-sm">
        {{ error?.statusMessage || '访问的页面不存在或已被删除' }}
      </p>
      <NuxtLink to="/" class="btn-primary mt-6 mx-auto">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        返回首页
      </NuxtLink>
    </div>
  </div>
</template>
