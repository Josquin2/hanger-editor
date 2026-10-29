#!/usr/bin/env node
/**
 * Publish hanger-editor packages separately without a workspace/monorepo.
 *
 * The source is one package. `scripts/release/stage.mjs` materialises the core
 * package and small framework adapters under `.release/<id>`, each with its own
 * manifest, README and entry files. This CLI verifies the repo, stages one or
 * more packages, and calls npm on the resulting folder.
 *
 * Usage:
 *   pnpm release:core
 *   pnpm release:vue -- --dry-run
 *   pnpm release:all -- --pack-only
 *
 * Run `pnpm release:help` for the full flag list and `scripts/release/README.md`
 * for the release order and version rules.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import {
  ALL_PACKAGES,
  ARTIFACTS_DIR,
  CORE,
  RELEASE_DIR,
  ROOT,
  defaultDistTag,
  selectPackages,
} from './release/config.mjs'
import { stagePackage } from './release/stage.mjs'
import {
  assertVersionAvailable,
  capture,
  inspectPackage,
  npmUser,
  packPackage,
  printTarball,
  publishPackage,
  run,
  versionExists,
  waitForVersion,
} from './release/registry.mjs'

const USAGE = `
Publish hanger-editor packages separately.

Usage:
  pnpm release:<package> [-- options]
  node scripts/release.mjs <package|adapters|all> [options]

Packages:
  core      ${'hanger-editor'} (name comes from package.json)
  vue       hanger-editor-vue
  react     hanger-editor-react
  rich      hanger-editor-rich
  adapters  vue, react and rich
  all       core first, then adapters

Options:
  --dry-run            Build, stage and run npm publish --dry-run
  --pack-only          Build, stage and write tarballs to .release/artifacts
  --skip-verify        Skip pnpm check (a production build still runs)
  --allow-dirty        Do not require a clean git tree
  --skip-registry      Do not query npm for version/core availability
  --tag <tag>          npm dist-tag (default: latest, or next for prereleases)
  --access <access>    public (default) or restricted
  --otp <code>         npm one-time password
  --package <id>       Same as the positional package argument
  --yes                Do not ask for confirmation before publishing
  --version <x.y.z>    Adapter-only override; core always uses package.json
  --help               Show this help

Examples:
  pnpm release:core -- --dry-run
  pnpm release:vue -- --version 0.1.1
  pnpm release:all -- --yes

Version rule:
  Every package defaults to the version in package.json. Core releases must use
  that exact version. Adapters may use --version for an independent patch, but
  their hanger-editor dependency stays on the current core version.
`

const parsed = parseArgs(process.argv.slice(2))

if (parsed.help) {
  console.log(USAGE)
  process.exit(0)
}

// Keep npm's cache inside the repo: release commands must also work in
// sandboxed environments where the user's ~/.npm is read-only.
process.env.npm_config_cache = resolve(RELEASE_DIR, 'npm-cache')

const rootManifest = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'))
const coreName = rootManifest.name
const coreVersion = rootManifest.version

if (parsed.selection && parsed.flags.package) {
  fail('Pass the package either as an argument or with --package, not both.')
}

const requested = parsed.selection ?? parsed.flags.package
if (!requested) {
  printPackages()
  console.log('Pick a package with one of the release:* scripts, or pass "adapters" / "all".')
  console.log('Run with --help for options.')
  process.exit(0)
}

const selected = selectPackages(requested, coreName)
if (!selected) {
  fail(
    `Unknown package "${requested}". Use: `
    + `${ALL_PACKAGES.map((entry) => entry.id).join(', ')}, adapters, all.`,
  )
}

const dryRun = parsed.flags.dryRun
const packOnly = parsed.flags.packOnly
if (dryRun && packOnly) fail('--dry-run and --pack-only cannot be combined.')

const version = parsed.flags.version ?? coreVersion
if (selected.some((entry) => entry.id === CORE.id) && version !== coreVersion) {
  fail(
    `Core releases must use the package.json version (${coreVersion}).\n`
    + 'Bump package.json and commit before publishing the core package.',
  )
}
if (!isSemver(version)) fail(`Invalid version: ${version}`)

const access = parsed.flags.access ?? 'public'
if (access !== 'public' && access !== 'restricted') {
  fail('--access must be "public" or "restricted".')
}
const tag = parsed.flags.tag ?? defaultDistTag(version)
if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(tag)) {
  fail(`Invalid npm dist-tag: ${tag}`)
}
const otp = parsed.flags.otp
const yes = parsed.flags.yes
const skipRegistry = parsed.flags.skipRegistry
const skipVerify = parsed.flags.skipVerify
const allowDirty = parsed.flags.allowDirty

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error))
})

async function main() {
  console.log(`\n${coreName} release\n`)
  console.log(`Version: ${version}${version !== coreVersion ? ` (core ${coreVersion})` : ''}`)
  console.log(`Targets: ${selected.map((entry) => entry.id).join(', ')}`)
  console.log(`Mode: ${packOnly ? 'pack only' : dryRun ? 'dry run' : 'publish'}`)

  if (!packOnly) {
    if (!dryRun) {
      await assertCleanTree()
      const user = await npmUser()
      console.log(`npm user: ${user}`)
    }

    if (!skipRegistry) {
      await assertRegistryState()
    }
  }

  await verify()

  const staged = []
  for (const spec of selected) {
    const stageDir = resolve(RELEASE_DIR, spec.id)
    stagePackage({
      spec,
      root: ROOT,
      rootManifest,
      version: spec.id === CORE.id ? coreVersion : version,
      coreVersion,
      outDir: stageDir,
      readmeDir: resolve(ROOT, 'scripts/release/readme'),
    })

    const inspected = await inspectPackage(stageDir)
    printTarball(inspected, spec.name ?? rootManifest.name)
    staged.push({ spec, stageDir, inspected })
  }

  if (packOnly) {
    console.log(`\nWriting tarballs to ${ARTIFACTS_DIR}`)
    for (const item of staged) {
      const tarball = await packPackage(item.stageDir, ARTIFACTS_DIR)
      console.log(`  ${tarball}`)
    }
    console.log('\nNothing was published.')
    return
  }

  if (dryRun) {
    console.log('\nDry run: running npm publish --dry-run.')
    for (const item of staged) {
      await publish(item, true)
    }
    console.log('\nDry run complete. The registry was not changed.')
    return
  }

  await confirmPublish(staged)
  for (const item of staged) {
    await publish(item, false)
  }
  console.log('\nRelease complete.')
}

async function verify() {
  if (skipVerify) {
    console.log('\nSkipping checks; running pnpm build only.')
    if (await run('pnpm', ['build'], { cwd: ROOT }) !== 0) fail('pnpm build failed.')
    return
  }

  console.log('\nRunning pnpm check...')
  if (await run('pnpm', ['check'], { cwd: ROOT }) !== 0) fail('pnpm check failed.')
}

async function assertCleanTree() {
  const status = await capture('git', ['status', '--porcelain'], { cwd: ROOT })
  if (status.code !== 0) fail(`Could not read git status:\n${status.stderr.trim()}`)
  if (status.stdout.trim() && !allowDirty) {
    fail('Working tree is dirty. Commit your changes or pass --allow-dirty.')
  }
  if (status.stdout.trim()) console.warn('Warning: publishing from a dirty tree (--allow-dirty).')

  const branch = await capture('git', ['branch', '--show-current'], { cwd: ROOT })
  const name = branch.stdout.trim()
  if (name && name !== 'main') {
    console.warn(`Warning: publishing from branch "${name}" (expected main).`)
  }
}

async function assertRegistryState() {
  const coreSelected = selected.some((entry) => entry.id === CORE.id)

  for (const spec of selected) {
    const name = spec.name ?? coreName
    await assertVersionAvailable(name, spec.id === CORE.id ? coreVersion : version)
  }

  if (!coreSelected) {
    const hasCore = await versionExists(coreName, coreVersion)
    if (!hasCore) {
      const message = `${coreName}@${coreVersion} is not on npm yet; publish the core package first.`
      if (dryRun) console.warn(`Warning: ${message}`)
      else fail(message)
    }
  }
}

async function confirmPublish(staged) {
  console.log('\nPublish plan:')
  for (const item of staged) {
    console.log(`  ${item.spec.name ?? coreName}@${version}  →  ${item.stageDir}`)
  }
  console.log(`  dist-tag: ${tag}`)
  console.log(`  access:  ${access}`)

  if (yes) return
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    fail('No interactive terminal. Re-run with --yes to confirm publishing.')
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await rl.question(`\nPublish ${staged.length} package(s)? [y/N] `)
    if (!/^y(es)?$/i.test(answer.trim())) {
      console.log('Aborted; nothing was published.')
      process.exit(0)
    }
  }
  finally {
    rl.close()
  }
}

async function publish(item, isDryRun) {
  const spec = item.spec
  const name = spec.name ?? coreName

  if (!isDryRun && spec.id !== CORE.id && !selected.some((entry) => entry.id === CORE.id)) {
    if (!(await versionExists(coreName, coreVersion))) {
      fail(`${coreName}@${coreVersion} disappeared from npm; cannot publish ${name}.`)
    }
  }

  console.log(`\n${isDryRun ? 'Dry-running' : 'Publishing'} ${name}@${spec.id === CORE.id ? coreVersion : version}`)
  await publishPackage(item.stageDir, {
    tag,
    access,
    otp,
    dryRun: isDryRun,
  })

  if (isDryRun) return

  if (!(await waitForVersion(name, spec.id === CORE.id ? coreVersion : version))) {
    fail(`${name}@${version} was accepted but is not visible on npm yet. Check the registry manually.`)
  }
  console.log(`  https://www.npmjs.com/package/${name}/v/${spec.id === CORE.id ? coreVersion : version}`)
}

function parseArgs(argv) {
  const flags = {}
  let selection = null
  let help = false

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (!arg || arg === '--') continue

    if (arg === '--help' || arg === '-h') {
      help = true
      continue
    }
    if (arg === '--dry-run') {
      flags.dryRun = true
      continue
    }
    if (arg === '--pack-only') {
      flags.packOnly = true
      continue
    }
    if (arg === '--skip-verify') {
      flags.skipVerify = true
      continue
    }
    if (arg === '--allow-dirty') {
      flags.allowDirty = true
      continue
    }
    if (arg === '--skip-registry') {
      flags.skipRegistry = true
      continue
    }
    if (arg === '--yes') {
      flags.yes = true
      continue
    }

    if (arg.startsWith('--')) {
      const [name, inline] = arg.split('=', 2)
      const value = inline ?? argv[index + 1]
      if (value === undefined || value.startsWith('--')) {
        fail(`Missing value for ${name}.`)
      }
      if (inline === undefined) index += 1

      const key = name.slice(2)
      if (!['package', 'tag', 'access', 'otp', 'version'].includes(key)) {
        fail(`Unknown option ${name}.`)
      }
      flags[key] = value
      continue
    }

    if (selection) fail(`Unexpected argument "${arg}".`)
    selection = arg
  }

  return { help, selection, flags }
}

function printPackages() {
  console.log(`\n${coreName} publish targets\n`)
  const rows = [
    [CORE.id, coreName, 'core, vanilla and rich entry points'],
    ...ALL_PACKAGES.filter((entry) => entry.id !== CORE.id).map((entry) => (
      [entry.id, entry.name, `${entry.title} adapter (depends on ${coreName})`]
    )),
  ]
  for (const [id, name, description] of rows) {
    console.log(`  ${id.padEnd(8)} ${name.padEnd(24)} ${description}`)
  }
  console.log('  adapters  (vue, react, rich)')
  console.log('  all       core + adapters')
  console.log('')
}

function isSemver(value) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(value)
}

function fail(message) {
  console.error(`\nError: ${message}`)
  process.exit(1)
}
