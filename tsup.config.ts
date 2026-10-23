import { copyFile } from 'node:fs/promises'
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    vanilla: 'src/vanilla/index.ts',
    vue: 'src/vue/index.ts',
    react: 'src/react/index.ts',
    rich: 'src/rich/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: true,
  treeshake: true,
  external: ['react', 'vue'],
  outExtension: ({ format }) => ({ js: format === 'cjs' ? '.cjs' : '.js' }),
  onSuccess: async () => {
    await copyFile('src/rich/rich-textarea.css', 'dist/rich-textarea.css')
  },
})
