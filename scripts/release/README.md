# Release scripts

This repository publishes **four npm packages from one source tree**, without a
pnpm workspace or turbo:

| Id | npm package | Contents |
| --- | --- | --- |
| `core` | `hanger-editor` | Parser, renderer, validation, vanilla editor and rich overlay |
| `vue` | `hanger-editor-vue` | `useMarkdownEditor` + `RichTextarea` for Vue 3/Nuxt |
| `react` | `hanger-editor-react` | `useMarkdownEditor` for React |
| `rich` | `hanger-editor-rich` | Framework-agnostic rich textarea + CSS |

The adapters are deliberately thin: they depend on `hanger-editor` and re-export
the matching subpath. That keeps one implementation, gives each framework package
an honest single peer dependency, and avoids duplicating the editor in four
tarballs. If you want a scope (for example `@your-scope/hanger-editor-vue`),
change the `name` fields in `config.mjs` and update the matching README template.

## Commands

```sh
pnpm release:core          # publish hanger-editor
pnpm release:vue           # publish hanger-editor-vue
pnpm release:react         # publish hanger-editor-react
pnpm release:rich          # publish hanger-editor-rich
pnpm release:adapters      # Vue, React and rich (core must already be published)
pnpm release:all           # core first, then all adapters
```

Every command runs the full `pnpm check`, stages the package, inspects the
tarball with `npm pack --dry-run --json`, and then asks for confirmation before
publishing.

Inspect locally first:

```sh
pnpm release:core -- --pack-only
pnpm release:vue -- --dry-run
pnpm release:all -- --pack-only
```

Tarballs are written to `.release/artifacts/`; staged package folders stay in
`.release/<id>/` so you can inspect exactly what npm would receive.

## Options

| Flag | Effect |
| --- | --- |
| `--dry-run` | Build, stage and run `npm publish --dry-run`; no registry change |
| `--pack-only` | Build, stage and write `.tgz` files; no npm publish |
| `--skip-verify` | Skip `pnpm check` (still runs `pnpm build`) |
| `--allow-dirty` | Allow a dirty git tree |
| `--skip-registry` | Skip `npm view` version/core checks |
| `--tag <tag>` | npm dist-tag; default `latest`, or `next` for prereleases |
| `--package <id>` | Same as the positional package argument |
| `--access <access>` | `public` (default) or `restricted` |
| `--otp <code>` | npm one-time password |
| `--version <x.y.z>` | Adapter-only version override (see below) |
| `--yes` | Skip the publish confirmation (non-interactive) |

Examples:

```sh
pnpm release:core -- --dry-run
pnpm release:all -- --yes
pnpm release:vue -- --version 0.1.1 --yes
pnpm release:rich -- --pack-only --skip-verify
```

## Versioning and order

All packages default to the version in the root `package.json`. Bump it once,
commit, then release the packages:

```sh
pnpm version patch --no-git-tag-version
git add package.json && git commit -m "chore: release 0.1.1"
pnpm release:core -- --dry-run
```

Rules:

- **Core** must use the exact root `package.json` version.
- **Adapters** may use `--version` for an independent release, but their
  `hanger-editor` dependency remains `^<root version>`. Use this to ship a Vue
  patch without republishing core.
- When bumping the core, publish `hanger-editor` first. Adapter scripts check
  that the matching core version exists on npm and stop before building if it
  does not.
- `pnpm release:all` publishes core first, waits until the registry exposes the
  new version, then publishes the adapters.
- Version collisions are rejected before anything is published.
- The script does not commit, tag, push or write changelogs. It only builds,
  stages and publishes. Commit the version bump first.

The version is intentionally not written by the release script. A release must
be reproducible from a committed `package.json`; the script only stages the
packages from the current commit.

## What gets published

For the core package, `dist/`, `README.md` and `LICENSE` come from the repo. The
staged manifest drops dev dependencies and scripts.

For each adapter the script writes:

```text
index.js       export * from 'hanger-editor/<entry>'
index.cjs      module.exports = require('hanger-editor/<entry>')
index.d.ts     matching TypeScript re-export
index.d.cts    CJS type re-export
README.md
LICENSE
package.json   dependencies: { hanger-editor: '^<version>' }
               peerDependencies: one framework only
rich-textarea.css  (Vue and rich only)
```

No `workspace:*`, no private registry configuration, and no build step for the
adapters. `npm publish` is run against the staged folder, not against the root
package, so the core package is never accidentally republished with an adapter.

## Adding a package

1. Add an entry to `ADAPTERS` in `config.mjs` with a name, subpath entry,
   peer dependencies and README template.
2. Add `scripts/release/readme/<name>.md`.
3. Add a `release:<id>` script to the root `package.json`.

The staging and publish code is generic.

## First release

```sh
npm login
pnpm release:core -- --pack-only     # inspect .release/artifacts
pnpm release:core -- --dry-run       # npm publish --dry-run
pnpm release:core -- --yes           # publish core
pnpm release:adapters -- --yes       # publish the adapters
```

`pnpm release:all` is for a version whose core is not on npm yet. Once core is
published, use `pnpm release:adapters`; if a release is interrupted, publish the
remaining adapters individually. They will see the core version in the registry.

## Requirements

- Node 18+ (the script uses built-in `fetch`-free Node APIs only).
- `npm login` for real publishes; `--dry-run` and `--pack-only` do not need it.
- `npm` CLI 9+ (`npm pack --json`, `npm publish <folder>`).
