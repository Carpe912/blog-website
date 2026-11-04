<template>
  <div class="min-h-screen">
    <!-- 主题切换：固定右上角，不占据布局空间 -->
    <div class="fixed right-4 top-4 z-50">
      <ThemeToggle />
    </div>

    <main>
      <slot />
    </main>
  </div>
</template>
