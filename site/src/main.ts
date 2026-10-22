import './style.css'
import { bindCopyButton } from './clipboard'
import { mountCodeSnippets } from './code-tabs'
import { mountPlayground } from './playground'

function boot(): void {
  mountPlayground()
  mountCodeSnippets()

  const installCopy = document.querySelector<HTMLButtonElement>('[data-copy-install]')
  if (installCopy) {
    bindCopyButton(installCopy, () => 'pnpm add hanger-editor')
  }

  const year = document.querySelector<HTMLElement>('[data-year]')
  if (year) year.textContent = String(new Date().getFullYear())
}

boot()
