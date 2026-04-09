import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

export default {
  content: [
    './components/**/*.{js,vue,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './app.vue',
    './error.vue',
    './content/**/*.md',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Noto Sans SC"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      typography: ({ theme }: { theme: (path: string) => string }) => ({
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: theme('colors.gray.700'),
            a: {
              color: theme('colors.primary.600'),
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' },
            },
            'h1, h2, h3, h4': {
              color: theme('colors.gray.900'),
              fontWeight: '700',
              scrollMarginTop: '5rem',
            },
            code: {
              backgroundColor: theme('colors.gray.100'),
              color: theme('colors.primary.700'),
              padding: '0.2em 0.4em',
              borderRadius: '0.25rem',
              fontWeight: '400',
              fontSize: '0.875em',
            },
            'code::before': { content: '""' },
            'code::after': { content: '""' },
            pre: {
              borderRadius: '0.75rem',
              border: `1px solid ${theme('colors.gray.200')}`,
            },
            'pre code': {
              backgroundColor: 'transparent',
              padding: 0,
            },
            blockquote: {
              borderLeftColor: theme('colors.primary.400'),
              backgroundColor: theme('colors.primary.50'),
              borderRadius: '0 0.5rem 0.5rem 0',
              padding: '0.75rem 1.25rem',
              color: theme('colors.gray.700'),
              fontStyle: 'normal',
            },
            'blockquote p:first-of-type::before': { content: '""' },
            'blockquote p:last-of-type::after': { content: '""' },
            img: { borderRadius: '0.75rem' },
            hr: { borderColor: theme('colors.gray.200') },
            table: {
              fontSize: '0.875rem',
            },
            thead: {
              backgroundColor: theme('colors.gray.50'),
            },
            'thead th': {
              color: theme('colors.gray.700'),
              fontWeight: '600',
            },
          },
        },
        invert: {
          css: {
            color: theme('colors.slate.300'),
            'h1, h2, h3, h4': {
              color: theme('colors.slate.100'),
            },
            a: {
              color: theme('colors.primary.400'),
            },
            code: {
              backgroundColor: theme('colors.slate.800'),
              color: theme('colors.primary.300'),
            },
            pre: {
              border: `1px solid ${theme('colors.slate.700')}`,
            },
            blockquote: {
              borderLeftColor: theme('colors.primary.500'),
              backgroundColor: theme('colors.slate.800'),
              color: theme('colors.slate.300'),
            },
            hr: { borderColor: theme('colors.slate.700') },
            thead: {
              backgroundColor: theme('colors.slate.800'),
            },
            'thead th': {
              color: theme('colors.slate.200'),
            },
          },
        },
      }),
    },
  },
  plugins: [typography],
} satisfies Config
