import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseMessage } from '../src/core/parse'
import { createRichTextarea, renderRichSource } from '../src/rich'
import type { RichTextareaController } from '../src/rich'

const controllers: RichTextareaController[] = []

afterEach(() => {
  for (const controller of controllers) controller.destroy()
  controllers.length = 0
  document.body.innerHTML = ''
})

function setup(value = '', options: Parameters<typeof createRichTextarea>[1] = {}) {
  const host = document.createElement('div')
  document.body.append(host)
  const rich = createRichTextarea(host, { value, ...options })
  controllers.push(rich)
  return { host, rich }
}

function renderOverlay(source: string): HTMLElement {
  const container = document.createElement('div')
  container.innerHTML = renderRichSource(parseMessage(source))
  return container
}

describe('renderRichSource', () => {
  it('preserves the complete source for caret alignment', () => {
    const source = '**bold** and _italic_ with `code`'
    const container = renderOverlay(source)
    expect(container.textContent).toBe(`${source}\u200B`)
    expect(container.querySelector('.hte-bold')?.textContent).toBe('bold')
    expect(container.querySelector('.hte-italic')?.textContent).toBe('italic')
    expect(container.querySelector('.hte-code')?.textContent).toBe('code')
    expect(container.querySelectorAll('.hte-marker')).toHaveLength(6)
  })

  it('merges overlapping inline styles per character', () => {
    const container = renderOverlay('***both***')
    const boldItalic = container.querySelector('.hte-bold.hte-italic')
    expect(boldItalic?.textContent).toBe('both')
  })

  it('marks quote prefixes and code fences outside the inline marker mode', () => {
    const quote = renderOverlay('> quoted')
    expect(quote.querySelector('.hte-marker--block')?.textContent).toBe('> ')
    expect(quote.querySelector('.hte-quote')?.textContent).toBe('quoted')

    const pre = renderOverlay('```ts\nconst a = 1\n```')
    expect(pre.textContent).toContain('```ts')
    expect(pre.querySelector('.hte-pre')?.textContent).toBe('const a = 1\n')
    expect(pre.querySelectorAll('.hte-marker--block').length).toBeGreaterThanOrEqual(2)
  })

  it('splits link labels and urls', () => {
    const container = renderOverlay('[docs](https://example.com)')
    expect(container.querySelector('.hte-link')?.textContent).toBe('docs')
    expect(container.querySelector('.hte-url')?.textContent).toBe('https://example.com')
    expect(container.textContent).toBe('[docs](https://example.com)\u200B')
  })

  it('escapes source HTML', () => {
    const container = renderOverlay('<img src=x onerror=alert(1)>')
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toBe('<img src=x onerror=alert(1)>\u200B')
  })
})

describe('RichTextareaController', () => {
  it('creates the overlay, textarea and placeholder', () => {
    const { host, rich } = setup('', { placeholder: 'Write a message…' })

    expect(host.querySelector('.hte')).toBe(rich.element)
    expect(rich.textarea.value).toBe('')
    expect(host.querySelector('.hte__placeholder')?.textContent)
      .toBe('Write a message…')
    expect(host.querySelector<HTMLElement>('.hte__placeholder')?.hidden).toBe(false)
    expect(rich.textarea.style.height).toBe('96px')
  })

  it('renders formatting on top while keeping the markdown value', () => {
    const { rich } = setup('Hello **world**')
    const highlight = rich.element.querySelector<HTMLElement>('.hte__highlight')!

    expect(rich.textarea.value).toBe('Hello **world**')
    expect(highlight.textContent).toBe('Hello **world**\u200B')
    expect(highlight.querySelector('.hte-bold')?.textContent).toBe('world')

    rich.textarea.value = 'Now *italic*'
    rich.textarea.dispatchEvent(new Event('input', { bubbles: true }))
    expect(highlight.querySelector('.hte-italic')?.textContent).toBe('italic')
    expect(highlight.textContent).toBe('Now *italic*\u200B')
  })

  it('updates the overlay through editor commands', () => {
    const { rich } = setup('hello')
    rich.textarea.focus()
    rich.textarea.setSelectionRange(0, 5)
    rich.editor.toggleBold()

    expect(rich.value).toBe('**hello**')
    expect(
      rich.element.querySelector<HTMLElement>('.hte__highlight .hte-bold')
        ?.textContent,
    ).toBe('hello')
  })

  it('switches marker visibility and accepts silent values', () => {
    const { rich } = setup('**bold**', { markers: 'dim' })
    expect(rich.element.dataset.markers).toBe('dim')

    rich.setMarkers('hidden')
    expect(rich.element.dataset.markers).toBe('hidden')

    rich.setValue('plain', { emit: false })
    expect(rich.value).toBe('plain')
    expect(rich.element.querySelector('.hte__highlight')?.textContent)
      .toBe('plain\u200B')
  })

  it('syncs textarea scrolling with the backdrop', () => {
    const { rich } = setup('line\n'.repeat(100))
    rich.textarea.scrollTop = 40
    rich.textarea.dispatchEvent(new Event('scroll'))

    expect(rich.backdrop.scrollTop).toBe(40)
  })

  it('destroys the DOM and stops reacting to input', () => {
    const onChange = vi.fn()
    const { host, rich } = setup('hello', { onChange })
    const textarea = rich.textarea

    rich.destroy()
    controllers.splice(controllers.indexOf(rich), 1)

    expect(host.children).toHaveLength(0)
    textarea.value = 'changed'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
