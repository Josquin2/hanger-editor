import { MarkdownEditor } from '../editor/editor'
import type {
  EditorOptions,
  SubmitOptions,
  SubmitPayload,
} from '../editor/types'
import { renderRichSource } from './source-html'

export type MarkerVisibility = 'visible' | 'dim' | 'hidden'

export interface RichTextareaOptions extends EditorOptions {
  /** Placeholder text shown when the value is empty. */
  readonly placeholder?: string
  /** Accessible label for the underlying textarea. */
  readonly ariaLabel?: string
  /**
   * How markdown delimiters are drawn. `hidden` removes the delimiter glyphs
   * but keeps their advance width, so the native caret stays aligned.
   */
  readonly markers?: MarkerVisibility
  readonly minHeight?: number
  readonly maxHeight?: number
  readonly spellcheck?: boolean
  readonly name?: string
  readonly id?: string
}

const DEFAULT_MIN_HEIGHT = 96
const DEFAULT_MAX_HEIGHT = 320

/**
 * A native textarea with a formatted mirror underneath it.
 *
 * The textarea keeps the plain markdown value, selection, IME and undo stack.
 * The mirror is an `aria-hidden` layer that renders the same source with
 * typographic classes. Both layers use identical box metrics, and their scroll
 * positions stay in sync. The textarea text is transparent; only its caret and
 * selection are drawn, over the formatted foreground.
 */
export class RichTextareaController {
  readonly host: HTMLElement
  readonly element: HTMLDivElement
  readonly backdrop: HTMLDivElement
  readonly textarea: HTMLTextAreaElement
  readonly editor: MarkdownEditor

  private readonly highlight: HTMLDivElement
  private readonly placeholder: HTMLDivElement
  private readonly view: Window
  private readonly minHeight: number
  private readonly maxHeight: number
  private frame: number | null = null
  private resizeObserver: ResizeObserver | null = null
  private lastWidth = 0
  private destroyed = false

  constructor(host: HTMLElement, options: RichTextareaOptions = {}) {
    if (typeof host.ownerDocument === 'undefined') {
      throw new Error('hanger-editor: RichTextareaController requires a document')
    }

    this.host = host
    this.minHeight = options.minHeight ?? DEFAULT_MIN_HEIGHT
    this.maxHeight = Math.max(this.minHeight, options.maxHeight ?? DEFAULT_MAX_HEIGHT)

    const document = host.ownerDocument
    this.view = document.defaultView ?? window
    this.element = document.createElement('div')
    this.element.className = 'hte'
    this.element.dataset.markers = options.markers ?? 'dim'

    this.backdrop = document.createElement('div')
    this.backdrop.className = 'hte__backdrop'
    this.backdrop.setAttribute('aria-hidden', 'true')

    this.highlight = document.createElement('div')
    this.highlight.className = 'hte__highlight'
    this.backdrop.append(this.highlight)

    this.placeholder = document.createElement('div')
    this.placeholder.className = 'hte__placeholder'
    this.placeholder.hidden = true

    this.textarea = document.createElement('textarea')
    this.textarea.className = 'hte__input'
    this.textarea.wrap = 'soft'
    this.textarea.rows = 1
    this.textarea.spellcheck = options.spellcheck ?? true
    this.textarea.style.minHeight = `${this.minHeight}px`
    if (options.ariaLabel) this.textarea.setAttribute('aria-label', options.ariaLabel)
    if (options.id) this.textarea.id = options.id
    if (options.name) this.textarea.name = options.name

    this.element.append(this.backdrop, this.placeholder, this.textarea)
    host.append(this.element)

    const {
      placeholder,
      ariaLabel: _ariaLabel,
      markers: _markers,
      minHeight: _minHeight,
      maxHeight: _maxHeight,
      spellcheck: _spellcheck,
      name: _name,
      id: _id,
      onChange,
      onSelectionChange,
      ...editorOptions
    } = options

    if (placeholder) this.setPlaceholder(placeholder)

    this.editor = new MarkdownEditor(this.textarea, {
      ...editorOptions,
      onChange: (event) => {
        this.render(event.document)
        this.resize()
        onChange?.(event)
      },
      onSelectionChange,
    })

    this.textarea.addEventListener('scroll', this.handleScroll, { passive: true })
    this.view.addEventListener('resize', this.handleWindowResize)

    if (typeof ResizeObserver === 'function') {
      this.lastWidth = this.element.clientWidth
      this.resizeObserver = new ResizeObserver(() => {
        const width = this.element.clientWidth
        if (width === this.lastWidth) return
        this.lastWidth = width
        this.resize()
      })
      this.resizeObserver.observe(this.element)
    }

    this.render()
    this.resize()

    const fonts = document.fonts
    if (fonts) {
      void fonts.ready.then(() => {
        if (!this.destroyed) this.resize()
      })
    }
  }

  get value(): string {
    return this.editor.value
  }

  get canSubmit(): boolean {
    return this.editor.canSubmit
  }

  setValue(value: string, options: { emit?: boolean } = {}): void {
    this.editor.setValue(value, options)
    if (options.emit === false) {
      this.render()
      this.resize()
    }
  }

  setPlaceholder(value: string): void {
    this.placeholder.textContent = value
    this.placeholder.hidden = value === '' || this.textarea.value.length !== 0
  }

  setMarkers(markers: MarkerVisibility): void {
    this.element.dataset.markers = markers
  }

  focus(): void {
    this.textarea.focus({ preventScroll: true })
  }

  clear(): void {
    this.editor.clear()
  }

  submit(options?: SubmitOptions): SubmitPayload | null {
    return this.editor.submit(options)
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true

    this.textarea.removeEventListener('scroll', this.handleScroll)
    this.view.removeEventListener('resize', this.handleWindowResize)
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    if (this.frame !== null) this.view.cancelAnimationFrame(this.frame)
    this.editor.destroy()
    this.element.remove()
  }

  private readonly handleScroll = (): void => {
    this.syncScroll()
  }

  private readonly handleWindowResize = (): void => {
    this.resize()
  }

  private render(document = this.editor.getDocument()): void {
    this.highlight.innerHTML = renderRichSource(document)
    this.placeholder.hidden = this.editor.value.length > 0
      || this.placeholder.textContent === ''
    this.syncScroll()
  }

  private resize(): void {
    if (this.destroyed) return

    const textarea = this.textarea
    textarea.style.height = 'auto'
    const naturalHeight = textarea.scrollHeight
    const height = Math.min(Math.max(naturalHeight, this.minHeight), this.maxHeight)
    textarea.style.height = `${height}px`
    textarea.style.overflowY = naturalHeight > this.maxHeight ? 'auto' : 'hidden'

    this.syncScroll()
    if (this.frame !== null) this.view.cancelAnimationFrame(this.frame)
    this.frame = this.view.requestAnimationFrame(() => {
      this.frame = null
      this.syncScroll()
    })
  }

  private syncScroll(): void {
    this.backdrop.scrollTop = this.textarea.scrollTop
  }
}

export function createRichTextarea(
  host: HTMLElement,
  options?: RichTextareaOptions,
): RichTextareaController {
  return new RichTextareaController(host, options)
}
