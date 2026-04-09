<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
    <div class="w-full max-w-sm">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg px-8 py-10">
        <h1 class="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6 text-center">管理后台登录</h1>
        <form @submit.prevent="handleLogin" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">密码</label>
            <input
              v-model="password"
              type="password"
              placeholder="请输入管理密码"
              class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              required
            />
          </div>
          <div v-if="error" class="text-red-500 text-sm">{{ error }}</div>
          <button
            type="submit"
            :disabled="loading"
            class="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
          >
            {{ loading ? '登录中...' : '登录' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const password = ref('')
const loading = ref(false)
const error = ref('')
const router = useRouter()

async function handleLogin() {
  loading.value = true
  error.value = ''
  try {
    const config = useRuntimeConfig()
    const res = await $fetch<{ data: { token: string } }>(`${config.public.apiBase}/auth/login`, {
      method: 'POST',
      body: { password: password.value },
    })
    useCookie('admin_token', { maxAge: 60 * 60 * 24 }).value = res.data.token
    router.push('/admin')
  } catch {
    error.value = '密码错误，请重试'
  } finally {
    loading.value = false
  }
}
</script>
