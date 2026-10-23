# API

## Entry points

| Import | Exports |
| --- | --- |
| `hanger-editor` | Parser, validator, renderer, URL policy, core types |
| `hanger-editor/vanilla` | `MarkdownEditor`, `createMarkdownEditor` |
| `hanger-editor/rich` | `RichTextareaController`, `createRichTextarea`, `renderRichSource` |
| `hanger-editor/vue` | `useMarkdownEditor`, `RichTextarea` |
| `hanger-editor/react` | `useMarkdownEditor` |
| `hanger-editor/rich-textarea.css` | Styles for the rich textarea |

## Parsing

```ts
function parseMessage(source: string): ParsedMessage
function toPlainText(source: string): string
```

```ts
interface ParsedMessage {
  source: string
  text: string
  entities: MessageEntity[]
  blocks: MessageBlock[]
  warnings: ParseWarning[]
}

type EntityType =
  | 'bold' | 'italic' | 'underline' | 'strikethrough' | 'spoiler'
  | 'code' | 'pre' | 'blockquote' | 'text_link'
```

`parseMessage` preserves source offsets on every block and inline node:

```ts
interface StyleNode {
  type: InlineStyle
  children: InlineNode[]
  sourceStart: number  // opening marker
  sourceEnd: number    // after the closing marker
  contentStart: number
  contentEnd: number
}
```

`warnings` currently reports `UNCLOSED_CODE_BLOCK`.

## Validation

```ts
function validateMessage(source: string, options?: ValidationOptions): ValidationResult
function validateDocument(document: ParsedMessage, options?: ValidationOptions): ValidationResult
function isBlank(value: string): boolean
```

```ts
interface ValidationOptions {
  maxLength?: number | null // default 4096, null disables
  allowEmpty?: boolean      // default false
}

interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  text: string
  length: number
  isEmpty: boolean
  document: ParsedMessage
}

type ValidationErrorCode = 'EMPTY_MESSAGE' | 'TOO_LONG'
```

## HTML

```ts
function renderHtml(document: ParsedMessage, options?: HtmlRenderOptions): string
function escapeHtml(value: string): string
function sanitizeUrl(value: string, policy?: UrlPolicy): string | null
```

```ts
interface HtmlRenderOptions extends UrlPolicy {
  wrapParagraphs?: boolean
  spoilerClass?: string | null
  linkTarget?: string | null
  linkRel?: string | null
  languageClassPrefix?: string | null
}

interface UrlPolicy {
  allowedSchemes?: readonly string[] // default: http, https, mailto, tg
  allowRelativeLinks?: boolean       // default false
}
```

## Editor

```ts
class MarkdownEditor {
  constructor(textarea: HTMLTextAreaElement, options?: EditorOptions)
  readonly textarea: HTMLTextAreaElement
  readonly value: string
  readonly canSubmit: boolean
}
```

Useful members:

| Member | Kind |
| --- | --- |
| `value` | getter |
| `canSubmit` | getter |
| `getDocument()` | method |
| `getValidation()` | method |
| `getSnapshot()` | method |
| `getHtml(options?)` | method |
| `getSelection()` / `setSelection(range)` | methods |
| `getActiveStyles()` | method |
| `setValue(value, { emit? })` | method |
| `clear()` / `focus()` | methods |
| `insertText(text)` | method |
| `insertLink(url, label?)` / `removeLink()` | methods |
| `toggleStyle(style)` | method |
| `toggleBold()` / `toggleItalic()` / `toggleUnderline()` | methods |
| `toggleStrikethrough()` / `toggleSpoiler()` | methods |
| `toggleCode()` / `toggleCodeBlock(language?)` / `toggleQuote()` | methods |
| `submit(options?)` | method |
| `on(event, listener)` / `off(event, listener)` | methods |
| `destroy()` | method |

```ts
interface EditorOptions {
  value?: string
  maxLength?: number | null
  allowEmpty?: boolean
  submitOnEnter?: boolean
  autoContinueQuote?: boolean
  shortcuts?: boolean
  html?: HtmlRenderOptions
  onChange?: (event: ChangeEvent) => void
  onSelectionChange?: (event: SelectionEvent) => void
  onSubmit?: (payload: SubmitPayload) => void
}

interface SubmitPayload {
  raw: string
  text: string
  html: string
  document: ParsedMessage
  entities: MessageEntity[]
}
```

Events: `change`, `selection`, `submit`, `destroy`.

## Rich textarea

```ts
function createRichTextarea(
  host: HTMLElement,
  options?: RichTextareaOptions,
): RichTextareaController

class RichTextareaController {
  readonly element: HTMLDivElement
  readonly backdrop: HTMLDivElement
  readonly textarea: HTMLTextAreaElement
  readonly editor: MarkdownEditor
  readonly value: string
  readonly canSubmit: boolean
  setValue(value: string, options?: { emit?: boolean }): void
  setPlaceholder(value: string): void
  setMarkers(markers: MarkerVisibility): void
  focus(): void
  clear(): void
  submit(options?: SubmitOptions): SubmitPayload | null
  destroy(): void
}
```

```ts
type MarkerVisibility = 'visible' | 'dim' | 'hidden'

interface RichTextareaOptions extends EditorOptions {
  placeholder?: string
  ariaLabel?: string
  markers?: MarkerVisibility
  minHeight?: number
  maxHeight?: number
  spellcheck?: boolean
  name?: string
  id?: string
}
```

### renderRichSource

```ts
function renderRichSource(document: ParsedMessage): string
```

Returns the escaped source with `hte-*` classes and a trailing zero-width
sentinel. Every source character is preserved so the formatted layer can be
aligned with the textarea. It is exported for advanced consumers; the
controller uses it internally.

### Vue component

```ts
import { RichTextarea } from 'hanger-editor/vue'

interface RichTextareaExpose {
  controller: RichTextareaController | null
  editor: MarkdownEditor | null
  focus(): void
  clear(): void
  submit(): SubmitPayload | null
  setMarkers(markers: MarkerVisibility): void
}
```

Props: `modelValue`, `placeholder`, `markers`, `maxLength`, `allowEmpty`,
`submitOnEnter`, `autoContinueQuote`, `shortcuts`, `minHeight`, `maxHeight`,
`ariaLabel`, `spellcheck`, `html`. Emits: `update:modelValue`, `change`,
`selection`, `submit`.

## Style markers

```ts
const STYLE_MARKERS = {
  bold: '**',
  italic: '*',
  underline: '__',
  strikethrough: '~~',
  spoiler: '||',
} as const
```
