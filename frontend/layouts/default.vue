<script setup lang="ts">
const { public: site } = useRuntimeConfig()
const siteHeader = ref<HTMLElement | null>(null)
const showBackToTop = ref(false)

function updateBackToTop() {
  showBackToTop.value = window.scrollY >= 500
}

function backToTop() {
  siteHeader.value?.focus({ preventScroll: true })
  window.scrollTo({
    top: 0,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  })
}

onMounted(() => {
  updateBackToTop()
  window.addEventListener('scroll', updateBackToTop, { passive: true })
})

onUnmounted(() => window.removeEventListener('scroll', updateBackToTop))
</script>

<template>
  <div class="reader-site flex min-h-screen flex-col">
    <header ref="siteHeader" tabindex="-1" class="border-b border-[var(--reader-line)]">
      <div class="reader-shell flex min-h-16 items-center justify-between gap-4 py-3">
        <NuxtLink to="/" class="flex min-w-0 items-center gap-3 font-semibold leading-snug">
          <span class="reader-mark" aria-hidden="true" />
          <span class="[overflow-wrap:anywhere]">{{ site.siteName }}</span>
        </NuxtLink>
        <nav aria-label="站点导航" class="flex shrink-0 items-center gap-5 text-sm sm:gap-7">
          <NuxtLink to="/" class="reader-nav-link" exact-active-class="reader-nav-current">文章</NuxtLink>
          <NuxtLink to="/about" class="reader-nav-link" exact-active-class="reader-nav-current">关于</NuxtLink>
        </nav>
      </div>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="reader-shell">
      <div class="border-t border-[var(--reader-line)] py-6 text-sm text-[var(--reader-muted)]">
        {{ site.siteName }}
      </div>
    </footer>

    <button
      v-if="showBackToTop"
      type="button"
      aria-label="回到顶部"
      title="回到顶部"
      class="reader-back-to-top"
      @click="backToTop"
    >
      <svg aria-hidden="true" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 19V5m-6 6 6-6 6 6" />
      </svg>
    </button>
  </div>
</template>

<style>
.reader-site {
  --reader-paper: #fcfaf5;
  --reader-surface: #f4efe6;
  --reader-ink: #26241f;
  --reader-muted: #625c53;
  --reader-line: #e3dbcf;
  --reader-accent: #963f30;
  --reader-display: 'Songti SC', 'Noto Serif CJK SC', 'Noto Serif SC', SimSun, Georgia, serif;
  background: var(--reader-paper);
  color: var(--reader-ink);
}

.dark .reader-site {
  --reader-paper: #1d1c19;
  --reader-surface: #282621;
  --reader-ink: #ede8df;
  --reader-muted: #b6aea0;
  --reader-line: #403b32;
  --reader-accent: #e89984;
}

.reader-shell,
.reader-column {
  width: 100%;
  margin-inline: auto;
  padding-inline: clamp(1.25rem, 4vw, 2.5rem);
}

.reader-shell {
  max-width: 68rem;
}

.reader-column {
  max-width: 51rem;
}

.reader-display {
  font-family: var(--reader-display);
  overflow-wrap: anywhere;
}

.reader-mark {
  width: 12px;
  height: 15px;
  flex: none;
  border: 1.5px solid var(--reader-accent);
  border-radius: 2px 3px 3px 2px;
  box-shadow: inset 3px 0 var(--reader-accent);
}

.reader-nav-link {
  padding-block: 0.45rem;
  color: var(--reader-muted);
}

.reader-nav-link:hover,
.reader-nav-current {
  color: var(--reader-accent);
}

.reader-back-to-top {
  position: fixed;
  z-index: 20;
  right: max(1rem, env(safe-area-inset-right));
  bottom: max(1rem, env(safe-area-inset-bottom));
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  place-items: center;
  border: 1px solid var(--reader-line);
  border-radius: 50%;
  background: var(--reader-paper);
  color: var(--reader-accent);
}

.reader-back-to-top:hover {
  border-color: var(--reader-accent);
  background: var(--reader-surface);
}

.reader-site :focus-visible {
  outline: 2px solid var(--reader-accent);
  outline-offset: 3px;
}
</style>
