import { afterEach, describe, expect, it, vi } from 'vitest'
import { MarkdownEditor } from '../src/editor/editor'
import type { EditorOptions } from '../src/editor/types'
import { parseMessage } from '../src/core/parse'

const activeEditors: MarkdownEditor[] = []

afterEach(() => {
  for (const editor of activeEditors) editor.destroy()
  activeEditors.length = 0
  document.body.innerHTML = ''
})

function setup(value = '', options: EditorOptions = {}) {
  const textarea = document.createElement('textarea')
  textarea.value = value
  document.body.append(textarea)
  const editor = new MarkdownEditor(textarea, options)
  activeEditors.push(editor)
  return { textarea, editor }
}

function select(textarea: HTMLTextAreaElement, start: number, end = start): void {
  textarea.setSelectionRange(start, end)
}

function typeInto(
  textarea: HTMLTextAreaElement,
  value: string,
  start = value.length,
  end = start,
): void {
  textarea.value = value
  textarea.setSelectionRange(start, end)
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
}

function press(
  textarea: HTMLTextAreaElement,
  key: string,
  init: KeyboardEventInit = {},
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  textarea.dispatchEvent(event)
  return event
}

describe('MarkdownEditor', () => {
  it('reads and sets the textarea value', () => {
    const { editor } = setup('hello')
    expect(editor.value).toBe('hello')
    expect(editor.canSubmit).toBe(true)

    const withInitial = setup('old', { value: 'new' })
    expect(withInitial.textarea.value).toBe('new')
    expect(withInitial.editor.value).toBe('new')
  })

  it('emits change events with parsed and validation state', () => {
    const onChange = vi.fn()
    const { textarea } = setup('', { onChange })

    typeInto(textarea, 'hello **world**')
    expect(onChange).toHaveBeenCalledTimes(1)
    const event = onChange.mock.calls[0]![0]
    expect(event.value).toBe('hello **world**')
    expect(event.document.text).toBe('hello world')
    expect(event.validation.valid).toBe(true)
    expect(event.canSubmit).toBe(true)

    typeInto(textarea, '   ')
    const blank = onChange.mock.calls.at(-1)![0]
    expect(blank.canSubmit).toBe(false)
    expect(blank.validation.errors[0]?.code).toBe('EMPTY_MESSAGE')
  })

  it('emits selection events with active styles', () => {
    const onSelectionChange = vi.fn()
    const { textarea, editor } = setup('**bold**', { onSelectionChange })
    select(textarea, 3)
    textarea.dispatchEvent(new Event('select', { bubbles: true }))

    expect(onSelectionChange).toHaveBeenCalled()
    expect(editor.getActiveStyles().bold).toBe(true)

    select(textarea, 1)
    editor.setSelection({ start: 1, end: 1 })
    expect(editor.getActiveStyles().bold).toBe(false)
  })

  it('toggles bold around a selection', () => {
    const { textarea, editor } = setup('hello world')
    select(textarea, 6, 11)

    editor.toggleBold()
    expect(textarea.value).toBe('hello **world**')
    expect(editor.getSelection()).toEqual({ start: 8, end: 13 })
    expect(editor.getActiveStyles().bold).toBe(true)

    editor.toggleBold()
    expect(textarea.value).toBe('hello world')
    expect(editor.getSelection()).toEqual({ start: 6, end: 11 })
    expect(editor.getActiveStyles().bold).toBe(false)
  })

  it('unwraps a style when the caret is inside it', () => {
    const { textarea, editor } = setup('**bold**')
    select(textarea, 3)
    editor.toggleBold()
    expect(textarea.value).toBe('bold')
    expect(editor.getSelection()).toEqual({ start: 1, end: 1 })
  })

  it('inserts an empty bold pair with an invisible placeholder', () => {
    const { textarea, editor } = setup('')
    select(textarea, 0)
    editor.toggleBold()

    expect(textarea.value).toBe('**\u200B**')
    expect(editor.getSelection()).toEqual({ start: 2, end: 3 })
    expect(editor.getActiveStyles().bold).toBe(true)
    expect(editor.canSubmit).toBe(false)

    typeInto(textarea, '**x**', 3)
    expect(editor.canSubmit).toBe(true)
    expect(editor.getActiveStyles().bold).toBe(true)
  })

  it('removes an empty formatting pair again', () => {
    const { textarea, editor } = setup('')
    select(textarea, 0)
    editor.toggleBold()
    expect(textarea.value).toBe('**\u200B**')

    select(textarea, 2, 3)
    editor.toggleBold()
    expect(textarea.value).toBe('')
    expect(editor.canSubmit).toBe(false)
  })

  it('uses the correct marker for empty italic pairs', () => {
    const { textarea, editor } = setup('')
    select(textarea, 0)
    editor.toggleItalic()
    expect(textarea.value).toBe('*\u200B*')
    expect(editor.getActiveStyles().italic).toBe(true)
  })

  it('wraps and unwraps inline code', () => {
    const { textarea, editor } = setup('code')
    select(textarea, 0, 4)
    editor.toggleCode()
    expect(textarea.value).toBe('`code`')
    expect(editor.getActiveStyles().code).toBe(true)

    editor.toggleCode()
    expect(textarea.value).toBe('code')
  })

  it('wraps and unwraps fenced code blocks', () => {
    const { textarea, editor } = setup('line 1\nline 2')
    select(textarea, 0, 13)

    editor.toggleCodeBlock('ts')
    expect(textarea.value).toBe('```ts\nline 1\nline 2\n```')
    expect(editor.getDocument().blocks[0]?.type).toBe('pre')
    expect(editor.getActiveStyles().pre).toBe(true)

    editor.toggleCodeBlock()
    expect(textarea.value).toBe('line 1\nline 2')
  })

  it('does not glue the next block to unwrapped code', () => {
    const { textarea, editor } = setup('```\ncode\n```\nnext')
    select(textarea, 6)
    editor.toggleCodeBlock()
    expect(textarea.value).toBe('code\nnext')
  })

  it('wraps the current line when the caret is on text', () => {
    const { textarea, editor } = setup('one\ntwo')
    select(textarea, 5)
    editor.toggleCodeBlock()
    expect(textarea.value).toBe('one\n```\ntwo\n```')
    expect(editor.getDocument().blocks[1]?.type).toBe('pre')
  })

  it('unwraps a minimal empty code block', () => {
    const { textarea, editor } = setup('```\n```')
    select(textarea, 4)
    editor.toggleCodeBlock()
    expect(textarea.value).toBe('')
  })

  it('creates an empty fenced block on an empty line', () => {
    const { textarea, editor } = setup('abc\n')
    select(textarea, 4)
    editor.toggleCodeBlock()
    expect(textarea.value).toBe('abc\n```\n\n```')
    expect(editor.getActiveStyles().pre).toBe(true)

    editor.toggleCodeBlock()
    expect(textarea.value).toBe('abc\n')
  })

  it('uses a longer fence when the content contains backticks', () => {
    const { textarea, editor } = setup('before ``` after')
    select(textarea, 0, 17)
    editor.toggleCodeBlock()
    expect(textarea.value.startsWith('````\n')).toBe(true)
    expect(editor.getDocument().blocks[0]?.type).toBe('pre')
  })

  it('toggles quotes for one or more lines', () => {
    const { textarea, editor } = setup('one\ntwo')
    select(textarea, 0, 7)

    editor.toggleQuote()
    expect(textarea.value).toBe('> one\n> two')
    expect(editor.getDocument().blocks[0]?.type).toBe('quote')
    expect(editor.getActiveStyles().quote).toBe(true)

    editor.toggleQuote()
    expect(textarea.value).toBe('one\ntwo')
  })

  it('removes the whole quote block when toggling from inside it', () => {
    const { textarea, editor } = setup('> one\n> two')
    select(textarea, 4)
    editor.toggleQuote()
    expect(textarea.value).toBe('one\ntwo')
  })

  it('does not format inside a fenced code block', () => {
    const { textarea, editor } = setup('```\ncode\n```')
    select(textarea, 4, 8)
    editor.toggleBold()
    expect(textarea.value).toBe('```\ncode\n```')
  })

  it('applies inline styles line by line when the selection spans lines', () => {
    const { textarea, editor } = setup('one\ntwo')
    select(textarea, 0, 7)
    editor.toggleBold()

    expect(textarea.value).toBe('**one**\n**two**')
    const document = editor.getDocument()
    expect(document.entities.map((entity) => entity.type)).toEqual([
      'bold',
      'bold',
    ])
  })

  it('handles formatting shortcuts', () => {
    const { textarea } = setup('bold')
    select(textarea, 0, 4)

    expect(press(textarea, 'b', { ctrlKey: true }).defaultPrevented).toBe(true)
    expect(textarea.value).toBe('**bold**')

    select(textarea, 2, 6)
    press(textarea, 'i', { metaKey: true })
    expect(textarea.value).toBe('***bold***')
  })

  it('uses the physical key for shortcuts on non-Latin layouts', () => {
    const { textarea } = setup('bold')
    select(textarea, 0, 4)
    press(textarea, 'и', { ctrlKey: true, code: 'KeyB' })
    expect(textarea.value).toBe('**bold**')
  })

  it('supports all documented shortcuts', () => {
    const cases: Array<[string, KeyboardEventInit, string]> = [
      ['x', { ctrlKey: true, shiftKey: true }, '~~text~~'],
      ['p', { ctrlKey: true, shiftKey: true }, '||text||'],
      ['e', { ctrlKey: true }, '`text`'],
      ['e', { ctrlKey: true, shiftKey: true }, '```\ntext\n```'],
      ['q', { ctrlKey: true, shiftKey: true }, '> text'],
      ['m', { ctrlKey: true, shiftKey: true }, '`text`'],
    ]

    for (const [key, init, expected] of cases) {
      const { textarea, editor } = setup('text')
      select(textarea, 0, 4)
      press(textarea, key, init)
      if (key === 'q') {
        expect(textarea.value).toContain('> text')
      }
      else {
        expect(textarea.value).toBe(expected)
      }
      editor.destroy()
      activeEditors.splice(activeEditors.indexOf(editor), 1)
    }
  })

  it('can disable shortcuts', () => {
    const { textarea } = setup('bold', { shortcuts: false })
    select(textarea, 0, 4)
    press(textarea, 'b', { ctrlKey: true })
    expect(textarea.value).toBe('bold')
  })

  it('ignores shortcuts during IME composition', () => {
    const { textarea } = setup('bold')
    select(textarea, 0, 4)
    const event = new KeyboardEvent('keydown', {
      key: 'b',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperty(event, 'isComposing', { value: true })
    textarea.dispatchEvent(event)
    expect(textarea.value).toBe('bold')
  })

  it('submits on Enter when enabled', () => {
    const onSubmit = vi.fn()
    const { textarea } = setup('hi', { submitOnEnter: true, onSubmit })

    const event = press(textarea, 'Enter')
    expect(event.defaultPrevented).toBe(true)
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      raw: 'hi',
      text: 'hi',
      html: 'hi',
    })
  })

  it('does not submit a blank message', () => {
    const onSubmit = vi.fn()
    const { textarea } = setup('   ', { submitOnEnter: true, onSubmit })
    const event = press(textarea, 'Enter')
    expect(event.defaultPrevented).toBe(true)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits blank messages when forced', () => {
    const onSubmit = vi.fn()
    const { editor } = setup('', { onSubmit })
    expect(editor.submit()).toBeNull()
    const payload = editor.submit({ force: true })
    expect(payload).not.toBeNull()
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('submits with Ctrl+Enter when Enter-to-send is disabled', () => {
    const onSubmit = vi.fn()
    const { textarea } = setup('hi', { onSubmit })
    press(textarea, 'Enter', { ctrlKey: true })
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('does not submit on Shift+Enter', () => {
    const onSubmit = vi.fn()
    const { textarea } = setup('hi', { submitOnEnter: true, onSubmit })
    press(textarea, 'Enter', { shiftKey: true })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('continues quote lines on Enter', () => {
    const { textarea } = setup('> one')
    select(textarea, 5)

    const first = press(textarea, 'Enter')
    expect(first.defaultPrevented).toBe(true)
    expect(textarea.value).toBe('> one\n> ')
    expect(textarea.selectionStart).toBe(8)

    press(textarea, 'Enter')
    expect(textarea.value).toBe('> one\n')
  })

  it('does not continue quotes when disabled', () => {
    const { textarea } = setup('> one', { autoContinueQuote: false })
    select(textarea, 5)
    const event = press(textarea, 'Enter')
    expect(event.defaultPrevented).toBe(false)
    expect(textarea.value).toBe('> one')
  })

  it('inserts text at the caret', () => {
    const { textarea, editor } = setup('hello world')
    select(textarea, 5)
    editor.insertText(',')
    expect(textarea.value).toBe('hello, world')
    expect(editor.getSelection()).toEqual({ start: 6, end: 6 })
  })

  it('inserts and updates links', () => {
    const { textarea, editor } = setup('Hanger')
    select(textarea, 0, 6)
    expect(editor.insertLink('https://thehanger.ru')).toBe(true)
    expect(textarea.value).toBe('[Hanger](https://thehanger.ru)')
    expect(editor.getHtml())
      .toContain('<a href="https://thehanger.ru" target="_blank" rel="noopener noreferrer nofollow">Hanger</a>')

    select(textarea, 3)
    editor.insertLink('https://example.com')
    expect(textarea.value).toBe('[Hanger](https://example.com)')

    expect(editor.removeLink()).toBe(true)
    expect(textarea.value).toBe('Hanger')
  })

  it('formats text directly after a link', () => {
    const source = '[x](https://a.example)word'
    const { textarea, editor } = setup(source)
    const caret = source.indexOf(')') + 1
    select(textarea, caret)
    editor.toggleBold()
    expect(textarea.value).toBe('[x](https://a.example)**\u200B**word')
  })

  it('does not format inside a link URL', () => {
    const source = '[link](https://example.com)'
    const { textarea, editor } = setup(source)
    const start = source.indexOf('example')
    select(textarea, start, start + 'example'.length)
    editor.toggleBold()
    editor.toggleCode()
    expect(textarea.value).toBe(source)
  })

  it('updates a link when the caret is in its URL', () => {
    const source = '[a](https://old.example)'
    const { textarea, editor } = setup(source)
    select(textarea, source.indexOf('old'))
    editor.insertLink('https://new.example')
    expect(textarea.value).toBe('[a](https://new.example)')
  })

  it('escapes brackets in a new link label', () => {
    const { textarea, editor } = setup('a]b')
    select(textarea, 0, 3)
    editor.insertLink('https://example.com')
    expect(textarea.value).toBe('[a\\]b](https://example.com)')
    expect(editor.getDocument().text).toBe('a]b')
  })

  it('preserves an existing escaped link label when changing the URL', () => {
    const source = '[a\\]b](https://old.example)'
    const { textarea, editor } = setup(source)
    select(textarea, 2)
    editor.insertLink('https://new.example')
    expect(textarea.value).toBe('[a\\]b](https://new.example)')
  })

  it('rejects unsafe link protocols', () => {
    const { textarea, editor } = setup('click')
    select(textarea, 0, 5)
    expect(editor.insertLink('javascript:alert(1)')).toBe(false)
    expect(textarea.value).toBe('click')
  })

  it('escapes parentheses in inserted link URLs', () => {
    const { textarea, editor } = setup('link')
    select(textarea, 0, 4)
    editor.insertLink('https://example.com/a_(b)')
    expect(textarea.value).toBe('[link](https://example.com/a_\\(b\\))')
    const document = parseMessage(textarea.value)
    expect(document.entities[0]).toMatchObject({
      type: 'text_link',
      url: 'https://example.com/a_(b)',
    })
  })

  it('normalises CRLF input and keeps offsets aligned', () => {
    const { textarea, editor } = setup('', { value: 'a\r\nb' })
    expect(textarea.value).toBe('a\nb')

    select(textarea, 2, 3)
    editor.toggleBold()
    expect(textarea.value).toBe('a\n**b**')

    editor.setValue('one\r\ntwo')
    expect(textarea.value).toBe('one\ntwo')
  })

  it('does not continue quotes in a read-only textarea', () => {
    const { textarea } = setup('> one')
    textarea.readOnly = true
    select(textarea, 5)
    const event = press(textarea, 'Enter')
    expect(event.defaultPrevented).toBe(false)
    expect(textarea.value).toBe('> one')
  })

  it('sets values without emitting or with emitting', () => {
    const onChange = vi.fn()
    const { editor } = setup('', { onChange })

    editor.setValue('silent', { emit: false })
    expect(editor.value).toBe('silent')
    expect(editor.canSubmit).toBe(true)
    expect(onChange).not.toHaveBeenCalled()

    editor.setValue('', { emit: true })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(editor.canSubmit).toBe(false)
  })

  it('exposes a snapshot and html', () => {
    const { editor } = setup('**hello**')
    const snapshot = editor.getSnapshot()
    expect(snapshot.value).toBe('**hello**')
    expect(snapshot.document.text).toBe('hello')
    expect(snapshot.canSubmit).toBe(true)
    expect(snapshot.activeStyles.bold).toBe(false)
    expect(editor.getHtml()).toBe('<strong>hello</strong>')
  })

  it('applies the maxLength option to canSubmit', () => {
    const { textarea, editor } = setup('', { maxLength: 3 })
    typeInto(textarea, 'abcd')
    expect(editor.canSubmit).toBe(false)
    expect(editor.submit()).toBeNull()
  })

  it('clears the value', () => {
    const { textarea, editor } = setup('hello')
    editor.clear()
    expect(textarea.value).toBe('')
    expect(editor.getSelection()).toEqual({ start: 0, end: 0 })
  })

  it('exposes unsubscribe, off and destroy', () => {
    const onChange = vi.fn()
    const { textarea, editor } = setup('', {})
    const unsubscribe = editor.on('change', onChange)
    typeInto(textarea, 'a')
    expect(onChange).toHaveBeenCalledTimes(1)

    unsubscribe()
    typeInto(textarea, 'ab')
    expect(onChange).toHaveBeenCalledTimes(1)

    editor.on('change', onChange)
    editor.off('change', onChange)
    typeInto(textarea, 'abc')
    expect(onChange).toHaveBeenCalledTimes(1)

    const onDestroy = vi.fn()
    editor.on('destroy', onDestroy)
    editor.destroy()
    expect(onDestroy).toHaveBeenCalledTimes(1)
    typeInto(textarea, 'abcd')
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
