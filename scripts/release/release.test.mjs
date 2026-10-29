import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { ADAPTERS, CORE, defaultDistTag, selectPackages } from './config.mjs'
import { createAdapterManifest, createCoreManifest, wrapperSource } from './manifest.mjs'
import { stagePackage } from './stage.mjs'

const rootManifest = {
  name: 'hanger-editor',
  version: '0.1.0',
  description: 'Core',
  license: 'MIT',
  author: 'Josquin <Josquinwork@mail.ru>',
  repository: { type: 'git', url: 'git+https://example.com/repo.git' },
  homepage: 'https://example.com',
  bugs: { url: 'https://example.com/issues' },
  type: 'module',
  sideEffects: ['**/*.css'],
  files: ['dist'],
  main: './dist/index.cjs',
  module: './dist/index.js',
  types: './dist/index.d.ts',
  exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' } },
  peerDependencies: { vue: '>=3.3.0', react: '>=18.0.0' },
  devDependencies: { tsup: '1.0.0' },
  scripts: { release: 'rm -rf /' },
}

test('selects named packages and keeps core first', () => {
  assert.deepEqual(selectPackages('core', 'hanger-editor'), [CORE])
  assert.deepEqual(selectPackages('hanger-editor', 'hanger-editor'), [CORE])
  assert.deepEqual(selectPackages('vue', 'hanger-editor'), [ADAPTERS[0]])
  assert.equal(selectPackages('all', 'hanger-editor')?.[0], CORE)
  assert.deepEqual(selectPackages('adapters', 'hanger-editor'), ADAPTERS)
  assert.equal(selectPackages('missing', 'hanger-editor'), null)
})

test('uses next for prerelease versions', () => {
  assert.equal(defaultDistTag('0.1.0'), 'latest')
  assert.equal(defaultDistTag('0.2.0-beta.1'), 'next')
})

test('core manifest has publish fields but no dev scripts', () => {
  const manifest = createCoreManifest(rootManifest, '0.1.0')
  assert.equal(manifest.name, 'hanger-editor')
  assert.equal(manifest.version, '0.1.0')
  assert.deepEqual(manifest.files, ['dist', 'README.md', 'LICENSE'])
  assert.equal(manifest.publishConfig.access, 'public')
  assert.equal(manifest.devDependencies, undefined)
  assert.equal(manifest.scripts, undefined)
  assert.deepEqual(manifest.sideEffects, ['**/*.css'])
  assert.equal(manifest.exports['.'].import, './dist/index.js')
})

test('Vue adapter declares one honest peer and depends on core', () => {
  const vue = ADAPTERS.find((entry) => entry.id === 'vue')
  const manifest = createAdapterManifest(vue, {
    coreName: 'hanger-editor',
    coreVersion: '0.1.0',
    version: '0.1.1',
    rootManifest,
  })

  assert.equal(manifest.name, 'hanger-editor-vue')
  assert.equal(manifest.version, '0.1.1')
  assert.deepEqual(manifest.dependencies, { 'hanger-editor': '^0.1.0' })
  assert.deepEqual(manifest.peerDependencies, { vue: '>=3.3.0' })
  assert.equal(manifest.exports['.'].require.types, './index.d.cts')
  assert.equal(manifest.exports['./rich-textarea.css'], './rich-textarea.css')
  assert.deepEqual(manifest.sideEffects, ['**/*.css'])
  assert.equal(manifest.devDependencies, undefined)
})

test('React adapter has no CSS or Vue peer', () => {
  const react = ADAPTERS.find((entry) => entry.id === 'react')
  const manifest = createAdapterManifest(react, {
    coreName: 'hanger-editor',
    coreVersion: '0.1.0',
    version: '0.1.0',
    rootManifest,
  })

  assert.deepEqual(manifest.peerDependencies, { react: '>=18.0.0' })
  assert.equal(manifest.exports['./rich-textarea.css'], undefined)
  assert.equal(manifest.files.includes('rich-textarea.css'), false)
  assert.equal(manifest.sideEffects, false)
})

test('wrapper entry points re-export the core subpath', () => {
  const source = wrapperSource('hanger-editor/vue')
  assert.equal(source.esm, "export * from 'hanger-editor/vue'\n")
  assert.equal(source.cjs, "module.exports = require('hanger-editor/vue')\n")
  assert.equal(source.types, source.esm)
})

test('staging writes a complete adapter package', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'hanger-release-'))
  const out = resolve(root, '.release/vue')

  try {
    mkdirSync(resolve(root, 'dist'), { recursive: true })
    writeFileSync(resolve(root, 'dist/rich-textarea.css'), '.hte { color: red }\n')
    writeFileSync(resolve(root, 'README.md'), '# hanger-editor\n')
    writeFileSync(resolve(root, 'LICENSE'), 'MIT\n')

    stagePackage({
      spec: ADAPTERS[0],
      root,
      rootManifest,
      version: '0.1.1',
      coreVersion: '0.1.0',
      outDir: out,
      readmeDir: resolve(dirname(fileURLToPath(import.meta.url)), 'readme'),
    })

    const pkg = JSON.parse(readFileSync(resolve(out, 'package.json'), 'utf8'))
    assert.equal(pkg.name, 'hanger-editor-vue')
    assert.equal(pkg.version, '0.1.1')
    assert.equal(
      readFileSync(resolve(out, 'index.js'), 'utf8'),
      "export * from 'hanger-editor/vue'\n",
    )
    assert.equal(readFileSync(resolve(out, 'rich-textarea.css'), 'utf8'), '.hte { color: red }\n')
    assert.match(readFileSync(resolve(out, 'README.md'), 'utf8'), /Vue 3 and Nuxt/)
  }
  finally {
    rmSync(root, { recursive: true, force: true })
  }
})
