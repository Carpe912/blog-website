<template>
  <div class="flex min-h-screen flex-col bg-white dark:bg-slate-950">
    <!-- 顶部品牌 -->
    <header class="flex h-16 items-center px-8">
      <NuxtLink to="/" class="flex items-center gap-2.5">
        <span class="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 dark:bg-white">
          <svg class="h-3 w-3 text-white dark:text-slate-900" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5V6a2 2 0 012-2h12a2 2 0 012 2v13.5M8 8h8M8 12h5" />
          </svg>
        </span>
        <span class="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
          管理后台
        </span>
      </NuxtLink>
    </header>

    <!-- 表单 -->
    <main class="flex flex-1 items-center justify-center px-6 pb-24">
      <div class="w-full max-w-[19rem]">
        <h1 class="text-[1.5rem] font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          登录
        </h1>
        <p class="mt-2 text-[13px] text-slate-400 dark:text-slate-500">
          输入管理密码以继续
        </p>

        <form class="mt-9 space-y-4" @submit.prevent="handleLogin">
          <div>
            <label for="password" class="sr-only">密码</label>
            <input
              id="password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              placeholder="管理密码"
              required
              class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-[14px]
                     text-slate-800 outline-none transition placeholder:text-slate-300
                     focus:border-slate-400 focus:ring-2 focus:ring-slate-100
                     dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100
                     dark:placeholder:text-slate-600 dark:focus:border-slate-500 dark:focus:ring-slate-800"
            />
          </div>

          <Transition
            enter-active-class="transition duration-150"
            enter-from-class="opacity-0"
            leave-active-class="transition duration-100"
            leave-to-class="opacity-0"
          >
            <p v-if="error" class="text-[12.5px] text-red-500">{{ error }}</p>
          </Transition>

          <button
            type="submit"
            :disabled="loading || !password"
            class="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-900
                   text-[13.5px] font-medium text-white transition-all hover:bg-slate-800
                   active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35
                   dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <svg v-if="loading" class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
              <path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
            </svg>
            {{ loading ? '登录中' : '登录' }}
          </button>
        </form>

        <NuxtLink
          to="/"
          class="mt-8 inline-flex items-center gap-1 text-[12.5px] text-slate-400 transition-colors
                 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
        >
          <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"><path d="M15 19l-7-7 7-7" /></svg>
          返回博客
        </NuxtLink>
      </div>
    </main>
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
