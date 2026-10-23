import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitepress'

const source = (path: string): string =>
  fileURLToPath(new URL(`../../src/${path}`, import.meta.url))

export default defineConfig({
  title: 'hanger-editor',
  description:
    'Telegram-style markdown editing, validation and safe HTML rendering for Hanger chat.',
  cleanUrls: true,
  lastUpdated: true,
  head: [['link', { rel: 'icon', href: '/logo.svg' }]],
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Reference', link: '/reference/syntax' },
      { text: 'Playground', link: '/playground' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting started', link: '/guide/getting-started' },
            { text: 'Editor', link: '/guide/editor' },
            { text: 'Rich textarea', link: '/guide/rich-textarea' },
            { text: 'Validation', link: '/guide/validation' },
            { text: 'Rendering', link: '/guide/rendering' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'Syntax', link: '/reference/syntax' },
            { text: 'API', link: '/reference/api' },
            { text: 'Security', link: '/reference/security' },
          ],
        },
      ],
    },
    search: {
      provider: 'local',
    },
    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/Josquin2/hanger-editor',
      },
    ],
    editLink: {
      pattern: 'https://github.com/Josquin2/hanger-editor/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
    outline: {
      level: [2, 3],
    },
    footer: {
      message: 'MIT licensed',
      copyright: 'Built for Hanger',
    },
  },
  vite: {
    resolve: {
      alias: [
        {
          find: /^hanger-editor\/rich-textarea\.css$/,
          replacement: source('rich/rich-textarea.css'),
        },
        {
          find: /^hanger-editor\/rich$/,
          replacement: source('rich/index.ts'),
        },
        {
          find: /^hanger-editor\/vanilla$/,
          replacement: source('vanilla/index.ts'),
        },
        {
          find: /^hanger-editor\/vue$/,
          replacement: source('vue/index.ts'),
        },
        {
          find: /^hanger-editor\/react$/,
          replacement: source('react/index.ts'),
        },
        {
          find: /^hanger-editor$/,
          replacement: source('index.ts'),
        },
      ],
    },
  },
})
