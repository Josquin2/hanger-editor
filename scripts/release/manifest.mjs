const CORE_FIELDS = [
  'name',
  'version',
  'description',
  'license',
  'author',
  'keywords',
  'repository',
  'homepage',
  'bugs',
  'type',
  'sideEffects',
  'files',
  'main',
  'module',
  'types',
  'exports',
  'peerDependencies',
  'peerDependenciesMeta',
  'engines',
]

/**
 * Build the manifest that npm receives for the core package. Scripts and dev
 * dependencies are useful in the repo, not in the registry, so they are not
 * copied into the staged package.
 */
export function createCoreManifest(rootManifest, version) {
  const manifest = {}

  for (const field of CORE_FIELDS) {
    if (rootManifest[field] !== undefined) manifest[field] = rootManifest[field]
  }

  manifest.version = version
  manifest.files = ['dist', 'README.md', 'LICENSE']
  manifest.publishConfig = { access: 'public' }
  return manifest
}

/**
 * Adapter manifests have exactly one framework peer. Their only runtime
 * dependency is the core package, which owns the actual implementation.
 */
export function createAdapterManifest(spec, { coreName, coreVersion, version, rootManifest }) {
  const files = [
    'index.js',
    'index.cjs',
    'index.d.ts',
    'index.d.cts',
    'README.md',
    'LICENSE',
  ]
  if (spec.css) files.push('rich-textarea.css')

  const manifest = {
    name: spec.name,
    version,
    description: spec.description,
    license: rootManifest.license ?? 'MIT',
    author: rootManifest.author,
    homepage: rootManifest.homepage,
    bugs: rootManifest.bugs,
    repository: rootManifest.repository,
    keywords: spec.keywords,
    type: 'module',
    sideEffects: spec.css ? ['**/*.css'] : false,
    files,
    main: './index.cjs',
    module: './index.js',
    types: './index.d.ts',
    exports: {
      '.': {
        import: {
          types: './index.d.ts',
          default: './index.js',
        },
        require: {
          types: './index.d.cts',
          default: './index.cjs',
        },
      },
      ...(spec.css ? { './rich-textarea.css': './rich-textarea.css' } : {}),
      './package.json': './package.json',
    },
    dependencies: {
      [coreName]: `^${coreVersion}`,
    },
    engines: rootManifest.engines,
    publishConfig: { access: 'public' },
  }

  if (spec.peerDependencies) manifest.peerDependencies = spec.peerDependencies
  return manifest
}

export function wrapperSource(reexport) {
  return {
    esm: `export * from '${reexport}'\n`,
    cjs: `module.exports = require('${reexport}')\n`,
    types: `export * from '${reexport}'\n`,
  }
}
