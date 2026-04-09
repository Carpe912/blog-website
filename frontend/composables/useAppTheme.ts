export const THEME_STORAGE_KEY = 'nuxt-blog-theme'

export type ThemePreference = 'light' | 'dark' | 'system'

export function useAppTheme() {
  const preference = useState<ThemePreference>('theme-preference', () => 'system')

  function effectiveDark(): boolean {
    if (!import.meta.client) return false
    if (preference.value === 'dark') return true
    if (preference.value === 'light') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  function applyDom() {
    if (!import.meta.client) return
    document.documentElement.classList.toggle('dark', effectiveDark())
  }

  function setPreference(p: ThemePreference) {
    preference.value = p
    if (import.meta.client) {
      localStorage.setItem(THEME_STORAGE_KEY, p)
      applyDom()
    }
  }

  function hydrate() {
    if (!import.meta.client) return
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'system') preference.value = raw
    applyDom()
  }

  onMounted(() => {
    hydrate()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (preference.value === 'system') applyDom()
    }
    mq.addEventListener('change', onChange)
    onUnmounted(() => mq.removeEventListener('change', onChange))
  })

  watch(preference, () => {
    if (import.meta.client) applyDom()
  })

  return { preference, setPreference, effectiveDark }
}
