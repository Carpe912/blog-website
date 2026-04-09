<template>
  <div class="max-w-2xl">
    <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">标签管理</h2>

    <!-- Create form -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-6">
      <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{{ editing ? '编辑标签' : '新建标签' }}</h3>
      <form @submit.prevent="handleSave" class="flex gap-3">
        <input
          v-model="form.name"
          type="text"
          required
          placeholder="标签名称"
          class="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <input
          v-model="form.slug"
          type="text"
          required
          pattern="[a-z0-9-]+"
          placeholder="slug（小写+连字符）"
          class="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button type="submit" :disabled="saving" class="btn-primary text-sm px-5 disabled:opacity-50">
          {{ saving ? '...' : (editing ? '保存' : '添加') }}
        </button>
        <button v-if="editing" type="button" @click="cancelEdit" class="btn-secondary text-sm px-4">取消</button>
      </form>
      <div v-if="formError" class="text-red-500 text-xs mt-2">{{ formError }}</div>
    </div>

    <!-- Tags list -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div v-if="loading" class="py-10 text-center text-gray-400 text-sm">加载中...</div>
      <div v-else-if="!tags.length" class="py-10 text-center text-gray-400 text-sm">暂无标签</div>
      <ul v-else class="divide-y divide-gray-100 dark:divide-gray-700">
        <li
          v-for="tag in tags"
          :key="tag.id"
          class="flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
        >
          <div>
            <span class="font-medium text-gray-800 dark:text-gray-100 text-sm">{{ tag.name }}</span>
            <span class="text-gray-400 text-xs ml-2">/{{ tag.slug }}</span>
            <span class="ml-2 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">
              {{ tag._count?.posts ?? 0 }} 篇
            </span>
          </div>
          <div class="flex gap-3">
            <button @click="startEdit(tag)" class="text-primary-600 hover:underline text-xs">编辑</button>
            <button @click="deleteTag(tag)" class="text-red-500 hover:underline text-xs">删除</button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const tagsApi = useTagsApi()
const tags = ref<any[]>([])
const loading = ref(false)
const saving = ref(false)
const formError = ref('')
const editing = ref<any>(null)

const form = reactive({ name: '', slug: '' })

async function loadTags() {
  loading.value = true
  try {
    tags.value = await tagsApi.list()
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  saving.value = true
  formError.value = ''
  try {
    if (editing.value) {
      await tagsApi.update(editing.value.id, form)
    } else {
      await tagsApi.create(form)
    }
    form.name = ''
    form.slug = ''
    editing.value = null
    loadTags()
  } catch (e: any) {
    formError.value = e?.data?.message || '操作失败'
  } finally {
    saving.value = false
  }
}

function startEdit(tag: any) {
  editing.value = tag
  form.name = tag.name
  form.slug = tag.slug
}

function cancelEdit() {
  editing.value = null
  form.name = ''
  form.slug = ''
}

async function deleteTag(tag: any) {
  if (!confirm(`确认删除标签「${tag.name}」？`)) return
  await tagsApi.remove(tag.id)
  loadTags()
}

// Auto-generate slug from name
watch(() => form.name, (val) => {
  if (!editing.value) {
    form.slug = val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  }
})

loadTags()
</script>
