import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const src = (path: string): string => {
  return fileURLToPath(new URL(`./src/${path}`, import.meta.url))
}

export default defineConfig({
  resolve: {
    alias: [
      { find: /^hanger-editor\/vanilla$/, replacement: src('vanilla/index.ts') },
      { find: /^hanger-editor\/vue$/, replacement: src('vue/index.ts') },
      { find: /^hanger-editor\/react$/, replacement: src('react/index.ts') },
      { find: /^hanger-editor\/rich$/, replacement: src('rich/index.ts') },
      { find: /^hanger-editor$/, replacement: src('index.ts') },
    ],
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    restoreMocks: true,
  },
})
