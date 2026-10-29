import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const execFileAsync = promisify(execFile)

export async function run(command, args, { cwd, stdio = 'inherit' } = {}) {
  return await new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio,
      shell: false,
      env: process.env,
    })

    child.on('error', reject)
    child.on('close', (code, signal) => {
      if (signal) {
        reject(new Error(`${command} was stopped by ${signal}`))
        return
      }
      resolvePromise(code ?? 1)
    })
  })
}

export async function capture(command, args, { cwd } = {}) {
  try {
    const result = await execFileAsync(command, args, {
      cwd,
      env: process.env,
      maxBuffer: 8 * 1024 * 1024,
    })
    return { code: 0, stdout: result.stdout, stderr: result.stderr }
  }
  catch (error) {
    return {
      code: typeof error.code === 'number' ? error.code : 1,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? error.message ?? '',
    }
  }
}

export async function npmUser() {
  const result = await capture('npm', ['whoami'])
  if (result.code !== 0) {
    throw new Error(
      `npm is not authenticated.\nRun "npm login" first.\n${result.stderr.trim()}`,
    )
  }
  return result.stdout.trim()
}

/**
 * `npm view pkg@version version` exits 1 with E404 when the package (or that
 * version) does not exist. Anything else is a real registry failure.
 */
export async function versionExists(name, version) {
  const result = await capture('npm', ['view', `${name}@${version}`, 'version', '--json'])
  if (result.code === 0) return true

  const output = `${result.stderr}\n${result.stdout}`
  if (/E404|404 Not Found|is not in this registry/i.test(output)) return false
  throw new Error(`Could not query ${name}@${version} on npm:\n${result.stderr.trim()}`)
}

export async function assertVersionAvailable(name, version) {
  if (await versionExists(name, version)) {
    throw new Error(
      `${name}@${version} is already published. Bump the version before releasing.`,
    )
  }
}

export async function waitForVersion(name, version, { attempts = 12, delay = 2000 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await versionExists(name, version)) return true
    if (attempt < attempts - 1) await sleep(delay)
  }
  return false
}

export async function publishPackage(stageDir, { tag, access, otp, dryRun = false }) {
  const args = [
    'publish',
    stageDir,
    '--access',
    access,
    '--tag',
    tag,
    '--ignore-scripts',
  ]
  if (otp) args.push('--otp', otp)
  if (dryRun) args.push('--dry-run')

  const code = await run('npm', args)
  if (code !== 0) throw new Error(`npm publish failed with code ${code}`)
}

export async function inspectPackage(stageDir) {
  const result = await capture('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: stageDir,
  })
  if (result.code !== 0) {
    throw new Error(`npm pack --dry-run failed:\n${result.stderr.trim()}`)
  }

  const parsed = JSON.parse(result.stdout)
  const entry = Array.isArray(parsed) ? parsed[0] : parsed
  if (!entry?.files?.length) {
    throw new Error(`npm pack returned no files for ${stageDir}`)
  }
  return entry
}

export async function packPackage(stageDir, destination) {
  mkdirSync(destination, { recursive: true })
  const result = await capture(
    'npm',
    ['pack', '--json', '--ignore-scripts', '--pack-destination', destination],
    { cwd: stageDir },
  )
  if (result.code !== 0) {
    throw new Error(`npm pack failed:\n${result.stderr.trim()}`)
  }

  const parsed = JSON.parse(result.stdout)
  const entry = Array.isArray(parsed) ? parsed[0] : parsed
  if (!entry?.filename) throw new Error(`npm pack returned no filename for ${stageDir}`)
  return resolve(destination, entry.filename)
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'unknown'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}

export function printTarball(entry, name) {
  const files = entry.files?.length ?? 0
  console.log(
    `  ${name}: ${files} files, ${formatBytes(entry.size)} packed, `
    + `${formatBytes(entry.unpackedSize)} unpacked`,
  )
}

function sleep(ms) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms)
  })
}
