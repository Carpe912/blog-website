<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100">文章管理</h2>
      <NuxtLink to="/admin/posts/new" class="btn-primary text-sm">+ 新建文章</NuxtLink>
    </div>

    <!-- Filters -->
    <div class="flex gap-3 mb-5">
      <input
        v-model="search"
        @input="debouncedLoad"
        type="text"
        placeholder="搜索文章..."
        class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 w-56"
      />
      <select
        v-model="publishedFilter"
        @change="loadPosts"
        class="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100"
      >
        <option value="">全部状态</option>
        <option value="true">已发布</option>
        <option value="false">草稿</option>
      </select>
    </div>

    <!-- Table -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
          <tr>
            <th class="text-left px-5 py-3 text-gray-500 dark:text-gray-400 font-medium">标题</th>
            <th class="text-left px-5 py-3 text-gray-500 dark:text-gray-400 font-medium w-28">状态</th>
            <th class="text-left px-5 py-3 text-gray-500 dark:text-gray-400 font-medium w-36">创建时间</th>
            <th class="px-5 py-3 w-28"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-if="loading" class="text-center">
            <td colspan="4" class="py-10 text-gray-400">加载中...</td>
          </tr>
          <tr v-else-if="!posts.length" class="text-center">
            <td colspan="4" class="py-10 text-gray-400">暂无文章</td>
          </tr>
          <tr
            v-for="post in posts"
            :key="post.id"
            class="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
          >
            <td class="px-5 py-3">
              <div class="font-medium text-gray-800 dark:text-gray-100 truncate max-w-xs">{{ post.title }}</div>
              <div class="text-xs text-gray-400 mt-0.5">{{ post.slug }}</div>
            </td>
            <td class="px-5 py-3">
              <span
                :class="post.published
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'"
                class="text-xs px-2 py-0.5 rounded-full font-medium"
              >
                {{ post.published ? '已发布' : '草稿' }}
              </span>
            </td>
            <td class="px-5 py-3 text-gray-400 text-xs">{{ formatDate(post.createdAt) }}</td>
            <td class="px-5 py-3">
              <div class="flex gap-2 justify-end">
                <NuxtLink :to="`/admin/posts/${post.id}`" class="text-primary-600 hover:underline text-xs">编辑</NuxtLink>
                <button @click="deletePost(post)" class="text-red-500 hover:underline text-xs">删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="meta.totalPages > 1" class="flex justify-center gap-2 mt-5">
      <button
        v-for="p in meta.totalPages"
        :key="p"
        @click="page = p; loadPosts()"
        :class="p === page ? 'page-btn bg-primary-600 text-white' : 'page-btn'"
      >
        {{ p }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const postsApi = usePostsApi()
const posts = ref<any[]>([])
const meta = ref({ total: 0, page: 1, limit: 10, totalPages: 1 })
const loading = ref(false)
const search = ref('')
const publishedFilter = ref('')
const page = ref(1)

let debounceTimer: ReturnType<typeof setTimeout>

async function loadPosts() {
  loading.value = true
  try {
    const params: any = { page: page.value, limit: 10 }
    if (search.value) params.search = search.value
    if (publishedFilter.value !== '') params.published = publishedFilter.value
    const res = await postsApi.list(params)
    posts.value = res.data
    meta.value = res.meta
  } finally {
    loading.value = false
  }
}

function debouncedLoad() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { page.value = 1; loadPosts() }, 400)
}

async function deletePost(post: any) {
  if (!confirm(`确认删除文章「${post.title}」？`)) return
  await postsApi.remove(post.id)
  loadPosts()
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('zh-CN')
}

loadPosts()
</script>
