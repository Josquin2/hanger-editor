import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mountCodeSnippets } from '../site/src/code-tabs'
import { mountPlayground } from '../site/src/playground'

const html = readFileSync(resolve(process.cwd(), 'site/index.html'), 'utf8')

function installPage(): void {
  const body = /<body[^>]*>([\s\S]*?)<\/body>/iu.exec(html)?.[1] ?? ''
  document.body.innerHTML = body
  mountPlayground()
  mountCodeSnippets()
}

function type(value: string): HTMLTextAreaElement {
  const textarea = document.querySelector<HTMLTextAreaElement>('#playground-input')!
  textarea.value = value
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
  return textarea
}

beforeEach(() => {
  document.body.innerHTML = ''
  document.head.innerHTML = ''
  installPage()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('preview site', () => {
  it('renders the sample and all preview formats', () => {
    const rendered = document.querySelector<HTMLElement>('#rendered-output')!
    expect(rendered.innerHTML).toContain('<strong>hanger-editor</strong>')
    expect(rendered.innerHTML).toContain('<blockquote>')
    expect(rendered.innerHTML).toContain('<pre><code class="language-ts">')
    expect(rendered.innerHTML).toContain('<a href="https://github.com/')

    const htmlOutput = document.querySelector<HTMLElement>('#html-output')!
    expect(htmlOutput.textContent).toContain('<strong>hanger-editor</strong>')

    const entities = JSON.parse(
      document.querySelector<HTMLElement>('#entities-output')!.textContent ?? '[]',
    ) as Array<{ type: string }>
    expect(entities.some((entity) => entity.type === 'bold')).toBe(true)
    expect(entities.some((entity) => entity.type === 'blockquote')).toBe(true)
    expect(entities.some((entity) => entity.type === 'pre')).toBe(true)

    const send = document.querySelector<HTMLButtonElement>('#send-button')!
    expect(send.disabled).toBe(false)
  })

  it('mounts every documentation snippet with three frameworks', () => {
    for (const key of ['quickstart', 'toolbar', 'validation', 'rendering']) {
      const host = document.querySelector<HTMLElement>(`[data-snippet="${key}"]`)
      expect(host, key).not.toBeNull()
      expect(host!.querySelectorAll('[role="tab"]'), key).toHaveLength(3)
      expect(host!.textContent, key).toContain('Vanilla')
      expect(host!.textContent, key).toContain('React')
    }
  })

  it('switches framework snippets', () => {
    const quickstart = document.querySelector<HTMLElement>('[data-snippet="quickstart"]')!
    const tabs = Array.from(quickstart.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
    expect(tabs).toHaveLength(3)

    const vue = tabs.find((tab) => tab.textContent === 'Vue / Nuxt')
    expect(vue).toBeDefined()
    vue!.click()

    expect(vue!.getAttribute('aria-selected')).toBe('true')
    const visible = Array.from(
      quickstart.querySelectorAll<HTMLElement>('[role="tabpanel"]'),
    ).find((panel) => !panel.hidden)
    expect(visible?.textContent).toContain('useMarkdownEditor')
  })

  it('formats text, validates empty messages and submits', () => {
    const textarea = type('hello')
    textarea.setSelectionRange(0, 5)

    const bold = document.querySelector<HTMLButtonElement>('[data-command="bold"]')!
    bold.click()

    expect(textarea.value).toBe('**hello**')
    expect(bold.getAttribute('aria-pressed')).toBe('true')
    expect(document.querySelector('#rendered-output')!.innerHTML)
      .toBe('<strong>hello</strong>')

    type('   ')
    const send = document.querySelector<HTMLButtonElement>('#send-button')!
    expect(send.disabled).toBe(true)
    expect(document.querySelector('#validation-status')!.textContent)
      .toContain('Add something visible')

    type('hello')
    send.click()
    const toast = document.querySelector<HTMLElement>('#toast')!
    expect(toast.hidden).toBe(false)
    expect(toast.textContent).toContain('Demo submit')
  })

  it('switches preview tabs and reveals spoilers', () => {
    const rendered = document.querySelector<HTMLElement>('#rendered-output')!
    type('||secret||')
    const spoiler = rendered.querySelector<HTMLElement>('.tg-spoiler')!
    expect(spoiler.getAttribute('role')).toBe('button')
    spoiler.click()
    expect(spoiler.classList.contains('is-revealed')).toBe(true)

    const htmlTab = document.querySelector<HTMLButtonElement>('[data-preview-tab="html"]')!
    htmlTab.click()
    expect(htmlTab.getAttribute('aria-selected')).toBe('true')
    expect(document.querySelector<HTMLElement>('#preview-panel-html')!.hidden)
      .toBe(false)
    expect(document.querySelector<HTMLElement>('#preview-panel-rendered')!.hidden)
      .toBe(true)
  })
})
