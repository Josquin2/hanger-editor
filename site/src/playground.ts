import {
  createMarkdownEditor,
  type ActiveStyles,
  type SubmitPayload,
} from 'hanger-editor/vanilla'
import { bindCopyButton } from './clipboard'

const MAX_LENGTH = 4096

const SAMPLE_MARKDOWN = `**hanger-editor** is live inside a plain textarea.

Try _italic_, __underline__, ~~strikethrough~~ and ||spoiler||.
Select something and press **Ctrl+B** or use the toolbar.

> A quote can span
> more than one line.

\`\`\`ts
const html = renderHtml(parseMessage('**hello**'))
\`\`\`

[Open the repository](https://github.com/Josquin2/hanger-editor)`


const ACTIVE_STYLE_BY_COMMAND: Record<string, keyof ActiveStyles> = {
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  strikethrough: 'strikethrough',
  spoiler: 'spoiler',
  code: 'code',
  pre: 'pre',
  quote: 'quote',
}

function required<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`Missing playground element: ${selector}`)
  return element
}

function setupPreviewTabs(): void {
  const tabs = Array.from(
    document.querySelectorAll<HTMLButtonElement>('[data-preview-tab]'),
  )
  const panels = Array.from(
    document.querySelectorAll<HTMLElement>('[data-preview-panel]'),
  )
  if (tabs.length === 0 || panels.length === 0) return

  const select = (id: string, focus = false): void => {
    for (const tab of tabs) {
      const selected = tab.dataset.previewTab === id
      tab.setAttribute('aria-selected', String(selected))
      tab.tabIndex = selected ? 0 : -1
      if (selected && focus) tab.focus()
    }
    for (const panel of panels) {
      panel.hidden = panel.dataset.previewPanel !== id
    }
  }

  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      const id = tab.dataset.previewTab
      if (id) select(id)
    })

    tab.addEventListener('keydown', (event) => {
      const current = tabs.indexOf(tab)
      let nextIndex: number | null = null
      if (event.key === 'ArrowRight') nextIndex = (current + 1) % tabs.length
      else if (event.key === 'ArrowLeft') nextIndex = (current - 1 + tabs.length) % tabs.length
      else if (event.key === 'Home') nextIndex = 0
      else if (event.key === 'End') nextIndex = tabs.length - 1

      if (nextIndex === null) return
      event.preventDefault()
      const next = tabs[nextIndex]
      const id = next?.dataset.previewTab
      if (next && id) select(id, true)
    })
  }

  select('rendered')
}

function revealSpoilers(container: HTMLElement): void {
  for (const spoiler of container.querySelectorAll<HTMLElement>('.tg-spoiler')) {
    spoiler.tabIndex = 0
    spoiler.setAttribute('role', 'button')
    spoiler.setAttribute('aria-label', 'Reveal spoiler')
    spoiler.setAttribute('aria-pressed', 'false')

    const toggle = (): void => {
      const revealed = spoiler.classList.toggle('is-revealed')
      spoiler.setAttribute('aria-pressed', String(revealed))
    }

    spoiler.addEventListener('click', toggle)
    spoiler.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      toggle()
    })
  }
}

export function mountPlayground(): void {
  const textarea = required<HTMLTextAreaElement>('#playground-input')
  const toolbar = required<HTMLElement>('#format-toolbar')
  const rendered = required<HTMLElement>('#rendered-output')
  const htmlOutput = required<HTMLElement>('#html-output')
  const textOutput = required<HTMLElement>('#text-output')
  const entitiesOutput = required<HTMLElement>('#entities-output')
  const validationStatus = required<HTMLElement>('#validation-status')
  const lengthCounter = required<HTMLElement>('#length-counter')
  const entityCount = required<HTMLElement>('#entity-count')
  const sendButton = required<HTMLButtonElement>('#send-button')
  const resetButton = required<HTMLButtonElement>('#reset-sample')
  const copyHtml = required<HTMLButtonElement>('#copy-html')
  const toast = required<HTMLElement>('#toast')

  let toastTimer: number | undefined

  const showToast = (message: string, error = false): void => {
    toast.textContent = message
    toast.classList.toggle('is-error', error)
    toast.hidden = false
    requestAnimationFrame(() => toast.classList.add('is-visible'))

    window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => {
      toast.classList.remove('is-visible')
      window.setTimeout(() => {
        toast.hidden = true
      }, 180)
    }, 3200)
  }

  const handleSubmit = (payload: SubmitPayload): void => {
    showToast(
      `Demo submit: ${payload.text.length} visible chars · `
      + `${payload.entities.length} entities. No backend was called.`,
    )
  }

  const editor = createMarkdownEditor(textarea, {
    value: SAMPLE_MARKDOWN,
    maxLength: MAX_LENGTH,
    submitOnEnter: true,
    onSubmit: handleSubmit,
  })

  setupPreviewTabs()
  bindCopyButton(copyHtml, () => editor.getHtml())

  const renderPreview = (): void => {
    const snapshot = editor.getSnapshot()
    const html = editor.getHtml()

    // The renderer escapes all text and only emits allow-listed URL schemes.
    rendered.innerHTML = html
    rendered.classList.toggle('is-empty', html === '')
    revealSpoilers(rendered)

    htmlOutput.textContent = html || '<!-- Rendered HTML will appear here -->'
    textOutput.textContent = snapshot.document.text || '(no visible text)'
    entitiesOutput.textContent = JSON.stringify(snapshot.document.entities, null, 2)

    const error = snapshot.validation.errors[0]
    if (snapshot.validation.valid) {
      validationStatus.textContent = 'Ready to send'
      validationStatus.dataset.tone = 'ok'
    }
    else if (error?.code === 'EMPTY_MESSAGE') {
      validationStatus.textContent = 'Add something visible to send'
      validationStatus.dataset.tone = 'error'
    }
    else if (error?.code === 'TOO_LONG') {
      const excess = (error.actual ?? 0) - (error.limit ?? 0)
      validationStatus.textContent = `Too long by ${excess} characters`
      validationStatus.dataset.tone = 'error'
    }
    else {
      validationStatus.textContent = 'Message is not ready'
      validationStatus.dataset.tone = 'error'
    }

    lengthCounter.textContent = `${snapshot.validation.length} / ${MAX_LENGTH}`
    lengthCounter.classList.toggle(
      'is-over-limit',
      snapshot.validation.length > MAX_LENGTH,
    )
    entityCount.textContent = `${snapshot.document.entities.length} entities`
    sendButton.disabled = !snapshot.validation.valid
  }

  const updateToolbar = (styles: ActiveStyles): void => {
    for (const button of toolbar.querySelectorAll<HTMLButtonElement>('[data-command]')) {
      const command = button.dataset.command
      const key = command ? ACTIVE_STYLE_BY_COMMAND[command] : undefined
      if (!key) continue
      const active = styles[key]
      button.classList.toggle('is-active', active)
      button.setAttribute('aria-pressed', String(active))
    }
  }

  const runCommand = (command: string): void => {
    switch (command) {
      case 'bold':
        editor.toggleBold()
        break
      case 'italic':
        editor.toggleItalic()
        break
      case 'underline':
        editor.toggleUnderline()
        break
      case 'strikethrough':
        editor.toggleStrikethrough()
        break
      case 'spoiler':
        editor.toggleSpoiler()
        break
      case 'code':
        editor.toggleCode()
        break
      case 'pre':
        editor.toggleCodeBlock()
        break
      case 'quote':
        editor.toggleQuote()
        break
      case 'link': {
        const url = window.prompt('Link URL', 'https://')
        if (!url) return
        if (!editor.insertLink(url.trim())) {
          showToast('Use an http, https, mailto or tg link.', true)
        }
        break
      }
    }
  }

  // Keep the caret in the textarea when a toolbar button is pressed.
  toolbar.addEventListener('mousedown', (event) => event.preventDefault())
  toolbar.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    const action = target.closest<HTMLButtonElement>('[data-action]')?.dataset.action
    if (action === 'clear') {
      editor.clear()
      editor.focus()
      return
    }

    const command = target.closest<HTMLButtonElement>('[data-command]')?.dataset.command
    if (command) runCommand(command)
  })

  sendButton.addEventListener('click', () => {
    if (editor.submit()) editor.focus()
  })

  resetButton.addEventListener('click', () => {
    editor.setValue(SAMPLE_MARKDOWN)
    editor.focus()
  })

  editor.on('change', renderPreview)
  editor.on('selection', ({ activeStyles }) => updateToolbar(activeStyles))

  renderPreview()
  updateToolbar(editor.getActiveStyles())
}
