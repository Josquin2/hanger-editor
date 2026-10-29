import {
  copyFileSync,
  cpSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { resolve } from 'node:path'
import { createAdapterManifest, createCoreManifest, wrapperSource } from './manifest.mjs'

/**
 * Materialise one publishable package under `.release/<id>`. The folder is a
 * complete package: a manifest, README, LICENSE and entry files, so `npm pack`
 * and `npm publish` can be run against it directly.
 */
export function stagePackage({
  spec,
  root,
  rootManifest,
  version,
  coreVersion,
  outDir,
  readmeDir,
}) {
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })

  const readme = spec.id === 'core'
    ? resolve(root, 'README.md')
    : resolve(readmeDir, spec.readme)

  copyFileSync(readme, resolve(outDir, 'README.md'))
  copyFileSync(resolve(root, 'LICENSE'), resolve(outDir, 'LICENSE'))

  if (spec.id === 'core') {
    cpSync(resolve(root, 'dist'), resolve(outDir, 'dist'), { recursive: true })
    writeManifest(outDir, createCoreManifest(rootManifest, version))
    return outDir
  }

  const coreName = rootManifest.name
  const reexport = `${coreName}/${spec.entry}`
  const source = wrapperSource(reexport)

  writeFileSync(resolve(outDir, 'index.js'), source.esm)
  writeFileSync(resolve(outDir, 'index.cjs'), source.cjs)
  writeFileSync(resolve(outDir, 'index.d.ts'), source.types)
  writeFileSync(resolve(outDir, 'index.d.cts'), source.types)
  if (spec.css) {
    copyFileSync(resolve(root, 'dist/rich-textarea.css'), resolve(outDir, 'rich-textarea.css'))
  }

  writeManifest(outDir, createAdapterManifest(spec, {
    coreName,
    coreVersion,
    version,
    rootManifest,
  }))
  return outDir
}

function writeManifest(outDir, manifest) {
  writeFileSync(resolve(outDir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}
