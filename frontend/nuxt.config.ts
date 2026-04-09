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

  modules: ['@nuxt/content', '@nuxtjs/tailwindcss'],

  // @nuxt/content 配置
  content: {
    // 代码块语法高亮（shiki）
    highlight: {
      theme: {
        default: 'github-light',
        dark: 'github-dark',
      },
      preload: ['js', 'ts', 'vue', 'json', 'bash', 'sh', 'python', 'css', 'html', 'yaml', 'markdown', 'sql', 'go', 'rust'],
    },
    // 开启目录提取（Table of Contents）
    markdown: {
      toc: {
        depth: 3,
        searchDepth: 3,
      },
    },
    // 配置开发服务器端口
    studio: {
      enabled: false
    },
    api: {
      baseURL: '/api/_content'
    },
    watch: {
      ws: {
        hostname: '127.0.0.1',
        port: {
          port: 4100,
          portRange: [4100, 4140],
        },
        showURL: false,
      },
    }
  },

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
      apiBase: process.env.API_BASE || 'http://localhost:3001/api',
    },
  },

  // 开发服务器配置
  devServer: {
    port: 8080,
    host: '0.0.0.0'
  },

  // SSG：nuxt generate 时预渲染所有路由
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/', '/about'],
      // 跳过中文标签路由的预渲染，避免编码问题
      ignore: ['/tags/写作', '/tags/效率', '/tags/前端', '/tags/运维', '/tags/部署', '/tags/教程', '/tags/技术']
    },
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
