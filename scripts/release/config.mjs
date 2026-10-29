import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const RELEASE_DIR = resolve(ROOT, '.release')
export const ARTIFACTS_DIR = resolve(RELEASE_DIR, 'artifacts')

/** The package that carries the parser, renderer, vanilla editor and rich overlay. */
export const CORE = {
  id: 'core',
  title: 'Core',
}

/**
 * Small framework packages. Each one re-exports a public subpath of the core
 * package, so core code is not duplicated and every adapter declares exactly
 * one framework peer dependency.
 */
export const ADAPTERS = [
  {
    id: 'vue',
    name: 'hanger-editor-vue',
    title: 'Vue',
    entry: 'vue',
    readme: 'vue.md',
    description: 'Vue 3 and Nuxt bindings for the hanger-editor markdown composer',
    keywords: ['hanger-editor', 'vue', 'vue3', 'nuxt', 'markdown', 'editor', 'textarea'],
    peerDependencies: { vue: '>=3.3.0' },
    css: true,
  },
  {
    id: 'react',
    name: 'hanger-editor-react',
    title: 'React',
    entry: 'react',
    readme: 'react.md',
    description: 'React bindings for the hanger-editor markdown composer',
    keywords: ['hanger-editor', 'react', 'markdown', 'editor', 'textarea'],
    peerDependencies: { react: '>=18.0.0' },
    css: false,
  },
  {
    id: 'rich',
    name: 'hanger-editor-rich',
    title: 'Rich textarea',
    entry: 'rich',
    readme: 'rich.md',
    description: 'Formatted textarea overlay for the hanger-editor markdown composer',
    keywords: ['hanger-editor', 'rich-textarea', 'markdown', 'editor', 'textarea'],
    peerDependencies: undefined,
    css: true,
  },
]

export const ALL_PACKAGES = [CORE, ...ADAPTERS]

/**
 * Resolve a selector from the CLI. Accepts the short id (`vue`), the published
 * package name (`hanger-editor-vue`) or `all`.
 */
export function selectPackages(selection, coreName) {
  if (!selection) return null
  if (selection === 'all') return ALL_PACKAGES
  if (selection === 'adapters') return ADAPTERS
  if (selection === CORE.id || selection === coreName) return [CORE]
  const adapter = ADAPTERS.find((entry) => entry.id === selection || entry.name === selection)
  return adapter ? [adapter] : null
}

export function defaultDistTag(version) {
  return version.includes('-') ? 'next' : 'latest'
}
