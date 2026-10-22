import type { HtmlRenderOptions } from '../core/render-html'
import type { InlineStyle, MessageEntity, ParsedMessage } from '../core/types'
import type { ValidationResult } from '../core/validate'

/** Commands that can be active at the caret. */
export type CommandStyle = InlineStyle | 'code' | 'pre' | 'quote'

export interface ActiveStyles {
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  spoiler: boolean
  code: boolean
  pre: boolean
  quote: boolean
}

export interface SelectionRange {
  readonly start: number
  readonly end: number
}

export interface ChangeEvent {
  readonly value: string
  readonly document: ParsedMessage
  readonly validation: ValidationResult
  readonly canSubmit: boolean
}

export interface SelectionEvent {
  readonly selection: SelectionRange
  readonly activeStyles: ActiveStyles
}

export interface SubmitPayload {
  /** The raw markdown from the textarea. Send this to the backend. */
  readonly raw: string
  /** Visible text with markers removed. */
  readonly text: string
  /** Sanitised HTML, ready for `v-html` or `dangerouslySetInnerHTML`. */
  readonly html: string
  readonly document: ParsedMessage
  readonly entities: readonly MessageEntity[]
}

export interface EditorEventMap {
  change: ChangeEvent
  selection: SelectionEvent
  submit: SubmitPayload
  destroy: undefined
}

export interface SubmitOptions {
  /**
   * Submit even when validation fails. Useful for attachment-only messages
   * where the textarea itself is empty.
   */
  readonly force?: boolean
}

export interface EditorOptions {
  /** Initial value. Defaults to the textarea's current value. */
  readonly value?: string
  /** Maximum visible length in UTF-16 units. `null` disables the limit. */
  readonly maxLength?: number | null
  /** Allow a message with no visible characters. Default: false. */
  readonly allowEmpty?: boolean
  /** Enter submits the message. Shift+Enter always inserts a newline. */
  readonly submitOnEnter?: boolean
  /** Continue `> ` quote lines when Enter creates a new line. Default: true. */
  readonly autoContinueQuote?: boolean
  /** Enable keyboard formatting shortcuts. Default: true. */
  readonly shortcuts?: boolean
  /** Options used to render the HTML included in submit payloads. */
  readonly html?: HtmlRenderOptions
  readonly onChange?: (event: ChangeEvent) => void
  readonly onSelectionChange?: (event: SelectionEvent) => void
  readonly onSubmit?: (payload: SubmitPayload) => void
}

export interface EditorSnapshot extends ChangeEvent {
  readonly selection: SelectionRange
  readonly activeStyles: ActiveStyles
}

export function createEmptyActiveStyles(): ActiveStyles {
  return {
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    spoiler: false,
    code: false,
    pre: false,
    quote: false,
  }
}
