import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

const siteRoot = fileURLToPath(new URL('.', import.meta.url))
const srcRoot = fileURLToPath(new URL('../src/', import.meta.url))

export default defineConfig({
  root: siteRoot,
  base: './',
  resolve: {
    alias: [
      {
        find: /^hanger-editor\/vanilla$/,
        replacement: `${srcRoot}vanilla/index.ts`,
      },
      {
        find: /^hanger-editor\/vue$/,
        replacement: `${srcRoot}vue/index.ts`,
      },
      {
        find: /^hanger-editor\/react$/,
        replacement: `${srcRoot}react/index.ts`,
      },
      {
        find: /^hanger-editor$/,
        replacement: `${srcRoot}index.ts`,
      },
    ],
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
  },
})
