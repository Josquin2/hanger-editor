import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { StrictMode, useState } from 'react'
import {
  useMarkdownEditor,
  type ReactEditorOptions,
  type UseMarkdownEditorResult,
} from '../src/react'

let latest: UseMarkdownEditorResult | null = null

interface HarnessProps {
  readonly initial?: string
  readonly options?: ReactEditorOptions
  readonly onValue?: (value: string) => void
}

function Harness({ initial = '', options = {}, onValue }: HarnessProps) {
  const [value, setValue] = useState(initial)
  const [external, setExternal] = useState(initial)
  const editor = useMarkdownEditor(
    value,
    (next) => {
      setValue(next)
      onValue?.(next)
    },
    options,
  )
  latest = editor

  return (
    <div>
      <textarea ref={editor.textareaRef} data-testid="input" />
      <span data-testid="value">{value || external}</span>
      <span data-testid="can-submit">{String(editor.canSubmit)}</span>
      <span data-testid="html">{editor.getHtml()}</span>
      <button type="button" onClick={() => editor.toggleBold()}>bold</button>
      <button
        type="button"
        onClick={() => {
          setValue('from parent')
          setExternal('from parent')
        }}
      >
        parent
      </button>
    </div>
  )
}

beforeEach(() => {
  latest = null
})

afterEach(() => {
  cleanup()
})

describe('useMarkdownEditor (React)', () => {
  it('attaches to the textarea and exposes state', async () => {
    render(<Harness initial="**hello**" />)
    const textarea = screen.getByTestId('input') as HTMLTextAreaElement

    await waitFor(() => expect(textarea.value).toBe('**hello**'))
    expect(latest).not.toBeNull()
    expect(latest!.canSubmit).toBe(true)
    expect(latest!.document?.text).toBe('hello')
    expect(screen.getByTestId('can-submit').textContent).toBe('true')
  })

  it('syncs typing to the controlled value', async () => {
    const onValue = vi.fn()
    render(<Harness onValue={onValue} />)
    const textarea = screen.getByTestId('input') as HTMLTextAreaElement

    fireEvent.input(textarea, { target: { value: 'hello **world**' } })

    await waitFor(() => expect(latest!.canSubmit).toBe(true))
    expect(onValue).toHaveBeenLastCalledWith('hello **world**')
    expect(screen.getByTestId('value').textContent).toBe('hello **world**')
    expect(screen.getByTestId('html').textContent).toBe('hello <strong>world</strong>')

    fireEvent.input(textarea, { target: { value: '   ' } })
    await waitFor(() => expect(latest!.canSubmit).toBe(false))
  })

  it('applies formatting through the textarea', async () => {
    render(<Harness initial="hello" />)
    const textarea = screen.getByTestId('input') as HTMLTextAreaElement
    await waitFor(() => expect(textarea.value).toBe('hello'))

    textarea.focus()
    textarea.setSelectionRange(0, 5)
    fireEvent.click(screen.getByText('bold'))

    await waitFor(() => expect(textarea.value).toBe('**hello**'))
    expect(screen.getByTestId('value').textContent).toBe('**hello**')
    expect(latest!.canSubmit).toBe(true)
  })

  it('applies parent value changes silently', async () => {
    render(<Harness initial="initial" />)
    const textarea = screen.getByTestId('input') as HTMLTextAreaElement
    await waitFor(() => expect(textarea.value).toBe('initial'))

    fireEvent.click(screen.getByText('parent'))
    await waitFor(() => expect(textarea.value).toBe('from parent'))
    expect(screen.getByTestId('value').textContent).toBe('from parent')
  })

  it('submits on Enter when enabled', async () => {
    const onSubmit = vi.fn()
    render(<Harness initial="hi" options={{ submitOnEnter: true, onSubmit }} />)
    const textarea = screen.getByTestId('input') as HTMLTextAreaElement
    await waitFor(() => expect(textarea.value).toBe('hi'))

    fireEvent.keyDown(textarea, { key: 'Enter' })

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      raw: 'hi',
      text: 'hi',
      html: 'hi',
    })
  })

  it('works under StrictMode without duplicating the controller', async () => {
    const onValue = vi.fn()
    render(
      <StrictMode>
        <Harness initial="hi" onValue={onValue} />
      </StrictMode>,
    )
    const textarea = screen.getByTestId('input') as HTMLTextAreaElement
    await waitFor(() => expect(textarea.value).toBe('hi'))

    fireEvent.input(textarea, { target: { value: 'hi there' } })
    await waitFor(() => expect(screen.getByTestId('value').textContent).toBe('hi there'))
    expect(onValue).toHaveBeenCalledTimes(1)
    expect(latest!.canSubmit).toBe(true)
  })

  it('attaches when the textarea appears after the first render', async () => {
    function LateHarness() {
      const [show, setShow] = useState(false)
      const [value, setValue] = useState('**hi**')
      const editor = useMarkdownEditor(value, setValue)
      latest = editor

      return (
        <div>
          {show
            ? <textarea ref={editor.textareaRef} data-testid="late-input" />
            : <button type="button" onClick={() => setShow(true)}>show</button>}
          <span data-testid="late-html">{editor.getHtml()}</span>
        </div>
      )
    }

    render(<LateHarness />)
    fireEvent.click(screen.getByText('show'))

    const textarea = await screen.findByTestId('late-input') as HTMLTextAreaElement
    await waitFor(() => expect(textarea.value).toBe('**hi**'))
    expect(latest!.document.text).toBe('hi')
    expect(screen.getByTestId('late-html').textContent).toBe('<strong>hi</strong>')
  })

  it('renders validation state during SSR without touching the DOM', () => {
    const html = renderToString(<Harness initial="**hello**" />)
    expect(html).toContain('data-testid="can-submit">true<')
    expect(html).toContain('data-testid="html">&lt;strong&gt;hello&lt;/strong&gt;<')
  })

  it('cleans up on unmount', async () => {
    const onValue = vi.fn()
    const view = render(<Harness initial="hi" onValue={onValue} />)
    const textarea = screen.getByTestId('input') as HTMLTextAreaElement
    await waitFor(() => expect(textarea.value).toBe('hi'))

    view.unmount()
    expect(() => {
      textarea.value = 'after unmount'
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    }).not.toThrow()
    expect(onValue).not.toHaveBeenCalled()
  })
})
