// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: false },

  // 开发环境避免 EMFILE（系统可打开文件数不足时 FSEvents 监听失败），改用轮询
  watchers: {
    chokidar: {
      usePolling: true,
      interval: 1000,
    },
  },

  vite: {
    server: {
      watch: {
        usePolling: true,
        interval: 1000,
      },
    },
  },

  modules: ['@nuxtjs/tailwindcss'],

  tailwindcss: {
    cssPath: '~/assets/css/tailwind.css',
    configPath: 'tailwind.config',
  },

  // 站点基础配置（通过环境变量覆盖）
  runtimeConfig: {
    public: {
      siteName: process.env.SITE_NAME || '我的博客',
      siteDescription: process.env.SITE_DESCRIPTION || '记录思考，分享知识',
      siteUrl: process.env.SITE_URL || 'http://localhost:3000',
      author: process.env.AUTHOR || 'Blog Author',
      apiBase: process.env.API_BASE || 'https://sunlingyue.cn/api',
    },
  },

  // 开发服务器配置
  devServer: {
    port: 8080,
    host: '0.0.0.0'
  },

  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      htmlAttrs: { lang: 'zh-CN' },
      script: [{ src: '/theme-init.js', tagPosition: 'head' }],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        {
          rel: 'preconnect',
          href: 'https://fonts.googleapis.com',
        },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: '',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
        },
      ],
    },
    pageTransition: { name: 'page', mode: 'out-in' },
  },
})
