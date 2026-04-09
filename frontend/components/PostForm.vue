<template>
  <form @submit.prevent="handleSubmit" class="space-y-5">
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-5">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">标题 <span class="text-red-500">*</span></label>
        <input
          v-model="form.title"
          type="text"
          required
          placeholder="文章标题"
          class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug <span class="text-red-500">*</span></label>
        <input
          v-model="form.slug"
          type="text"
          required
          placeholder="url-friendly-slug"
          pattern="[a-z0-9-]+"
          class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">摘要</label>
        <textarea
          v-model="form.excerpt"
          rows="2"
          placeholder="文章摘要（可选）"
          class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">封面图片 URL</label>
        <input
          v-model="form.cover"
          type="url"
          placeholder="https://..."
          class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">标签</label>
        <div class="flex flex-wrap gap-2">
          <label
            v-for="tag in tags"
            :key="tag.id"
            class="flex items-center gap-1.5 cursor-pointer"
          >
            <input
              type="checkbox"
              :value="tag.id"
              v-model="form.tagIds"
              class="rounded text-primary-600"
            />
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ tag.name }}</span>
          </label>
        </div>
      </div>

      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" v-model="form.published" class="rounded text-primary-600" />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">立即发布</span>
        </label>
      </div>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">正文内容（Markdown）<span class="text-red-500">*</span></label>
      <textarea
        v-model="form.content"
        rows="20"
        required
        placeholder="在此输入 Markdown 内容..."
        class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y"
      />
    </div>

    <div class="flex gap-3">
      <button
        type="submit"
        :disabled="loading"
        class="btn-primary text-sm disabled:opacity-50"
      >
        {{ loading ? '保存中...' : (initial ? '保存修改' : '创建文章') }}
      </button>
      <NuxtLink to="/admin/posts" class="btn-secondary text-sm">取消</NuxtLink>
    </div>
  </form>
</template>

<script setup lang="ts">
const props = defineProps<{
  initial?: any
  tags: any[]
  loading?: boolean
}>()

const emit = defineEmits<{ submit: [data: any] }>()

const form = reactive({
  title: '',
  slug: '',
  excerpt: '',
  cover: '',
  content: '',
  published: false,
  tagIds: [] as number[],
})

if (props.initial) {
  form.title = props.initial.title ?? ''
  form.slug = props.initial.slug ?? ''
  form.excerpt = props.initial.excerpt ?? ''
  form.cover = props.initial.cover ?? ''
  form.content = props.initial.content ?? ''
  form.published = props.initial.published ?? false
  form.tagIds = (props.initial.tags ?? []).map((t: any) => t.id)
}

function handleSubmit() {
  const data: any = {
    title: form.title,
    slug: form.slug,
    content: form.content,
    published: form.published,
    tagIds: form.tagIds,
  }
  if (form.excerpt) data.excerpt = form.excerpt
  if (form.cover) data.cover = form.cover
  emit('submit', data)
}
</script>
