<script setup lang="ts">
interface Post {
  _path: string
  title: string
  date: string
  tags?: string[]
  excerpt?: string
  cover?: string
  readingTime?: number
}

const props = defineProps<{
  post: Post
  index?: number
}>()

// 根据文章路径生成博客 URL：/posts/my-post → /blog/my-post
const blogUrl = computed(() => {
  const slug = props.post._path.replace(/^\/posts\//, '')
  return `/blog/${slug}`
})

// 格式化日期
const formattedDate = computed(() => {
  if (!props.post.date) return ''
  return new Date(props.post.date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})

// 预估阅读时间（中文约 400 字/分钟），使用后端已计算好的值
const readingTime = computed(() => props.post.readingTime ?? 1)

// 封面渐变色（根据 index 循环）
const gradients = [
  'from-blue-400 via-primary-500 to-indigo-600',
  'from-violet-400 via-purple-500 to-pink-500',
  'from-emerald-400 via-teal-500 to-cyan-600',
  'from-orange-400 via-rose-400 to-pink-600',
  'from-cyan-400 via-sky-500 to-blue-600',
  'from-amber-400 via-orange-500 to-red-500',
]
const gradient = computed(() => gradients[(props.index ?? 0) % gradients.length])
</script>

<template>
  <NuxtLink :to="blogUrl" class="blog-card group block">
    <!-- 封面区域 -->
    <div class="h-44 overflow-hidden">
      <img
        v-if="post.cover"
        :src="post.cover"
        :alt="post.title"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      />
      <div
        v-else
        class="w-full h-full bg-gradient-to-br flex items-end p-5"
        :class="gradient"
      >
        <p class="text-white/90 text-xs font-medium tracking-wide uppercase">
          {{ post.tags?.[0] ?? 'Blog' }}
        </p>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="p-5 flex flex-col gap-3">
      <!-- 标签 -->
      <div v-if="post.tags?.length" class="flex flex-wrap gap-1.5">
        <span
          v-for="tag in post.tags.slice(0, 3)"
          :key="tag"
          class="tag-pill"
        >
          {{ tag }}
        </span>
      </div>

      <!-- 标题 -->
      <h2 class="text-lg font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-primary-600 transition-colors">
        {{ post.title }}
      </h2>

      <!-- 摘要 -->
      <p v-if="post.excerpt" class="text-sm text-gray-500 line-clamp-2 leading-relaxed">
        {{ post.excerpt }}
      </p>

      <!-- 底部元信息 -->
      <div class="flex items-center justify-between text-xs text-gray-400 pt-1 border-t border-gray-50">
        <time :datetime="post.date">{{ formattedDate }}</time>
        <span class="flex items-center gap-1">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          约 {{ readingTime }} 分钟
        </span>
      </div>
    </div>
  </NuxtLink>
</template>
