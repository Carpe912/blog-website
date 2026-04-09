<script setup lang="ts">
const { preference, setPreference } = useAppTheme()
const open = ref(false)
const root = ref<HTMLElement | null>(null)

const options = [
  { value: 'light' as const, label: '浅色' },
  { value: 'dark' as const, label: '深色' },
  { value: 'system' as const, label: '跟随系统' },
]

function select(v: (typeof options)[number]['value']) {
  setPreference(v)
  open.value = false
}

function onDocClick(e: MouseEvent) {
  if (!open.value || !root.value) return
  if (!root.value.contains(e.target as Node)) open.value = false
}

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div ref="root" class="relative shrink-0">
    <button
      type="button"
      class="flex items-center justify-center w-8 h-8 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      aria-haspopup="listbox"
      :aria-expanded="open"
      aria-label="切换主题"
      @click.stop="open = !open"
    >
      <!-- 浅色 -->
      <svg v-if="preference === 'light'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
      <!-- 深色 -->
      <svg v-else-if="preference === 'dark'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
      <!-- 系统 -->
      <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    </button>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <ul
        v-if="open"
        class="absolute right-0 mt-2 w-36 py-1 rounded-lg border border-slate-200 bg-white shadow-sm z-50 dark:border-slate-700 dark:bg-slate-900"
        role="listbox"
      >
        <li v-for="opt in options" :key="opt.value">
          <button
            type="button"
            role="option"
            class="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 flex items-center justify-between gap-2"
            :aria-selected="preference === opt.value"
            @click="select(opt.value)"
          >
            {{ opt.label }}
            <span v-if="preference === opt.value" class="text-slate-500 dark:text-slate-400 text-xs">✓</span>
          </button>
        </li>
      </ul>
    </Transition>
  </div>
</template>
