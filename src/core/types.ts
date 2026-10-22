/**
 * Markdown markers supported by the parser and the editor.
 *
 * The dialect is intentionally close to both Telegram Desktop and Discord:
 * `**bold**`, `*italic*`, `__underline__`, `~~strike~~`, `||spoiler||`,
 * `` `code` ``, fenced code blocks, `[label](url)` and `> quotes`.
 */
export type InlineStyle =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'spoiler'

export type EntityType = InlineStyle | 'code' | 'pre' | 'blockquote' | 'text_link'

export type BlockType = 'paragraph' | 'quote' | 'pre'

export interface TextNode {
  readonly type: 'text'
  readonly value: string
  readonly sourceStart: number
  readonly sourceEnd: number
}

export interface StyleNode {
  readonly type: InlineStyle
  readonly children: readonly InlineNode[]
  /** Start of the opening marker in the source. */
  readonly sourceStart: number
  /** End of the closing marker in the source. */
  readonly sourceEnd: number
  /** First character between the markers. */
  readonly contentStart: number
  /** Position of the closing marker. */
  readonly contentEnd: number
}

export interface CodeNode {
  readonly type: 'code'
  readonly value: string
  readonly sourceStart: number
  readonly sourceEnd: number
  readonly contentStart: number
  readonly contentEnd: number
}

export interface LinkNode {
  readonly type: 'link'
  readonly url: string
  readonly children: readonly InlineNode[]
  readonly sourceStart: number
  readonly sourceEnd: number
  /** First character of the link label. */
  readonly contentStart: number
  /** Position of the closing bracket. */
  readonly contentEnd: number
}

export type InlineNode = TextNode | StyleNode | CodeNode | LinkNode

export interface InlineLine {
  readonly sourceStart: number
  readonly sourceEnd: number
  readonly nodes: readonly InlineNode[]
}

interface BaseBlock {
  readonly type: BlockType
  /** Zero-based index of the first source line occupied by the block. */
  readonly startLine: number
  /** Zero-based index of the last source line occupied by the block. */
  readonly endLine: number
  readonly sourceStart: number
  readonly sourceEnd: number
  /** Newlines that separate this block from the previous visible content. */
  readonly newlinesBefore: number
}

export interface ParagraphBlock extends BaseBlock {
  readonly type: 'paragraph'
  readonly lines: readonly InlineLine[]
}

export interface QuoteBlock extends BaseBlock {
  readonly type: 'quote'
  readonly lines: readonly InlineLine[]
}

export interface PreBlock extends BaseBlock {
  readonly type: 'pre'
  readonly code: string
  readonly language: string | null
  readonly contentStart: number
  readonly contentEnd: number
  /** True when the closing fence was missing and the block runs to EOF. */
  readonly unclosed: boolean
}

export type MessageBlock = ParagraphBlock | QuoteBlock | PreBlock

export type ParseWarningCode = 'UNCLOSED_CODE_BLOCK'

export interface ParseWarning {
  readonly code: ParseWarningCode
  readonly message: string
  /** One-based source line number. */
  readonly line: number
}

/**
 * Telegram-compatible entity. Offsets and lengths are UTF-16 code units, the
 * same unit JavaScript strings, textareas and the Telegram Bot API use.
 */
export interface MessageEntity {
  readonly type: EntityType
  readonly offset: number
  readonly length: number
  readonly url?: string
  readonly language?: string
}

export interface ParsedMessage {
  /** Source with CRLF normalised to LF. */
  readonly source: string
  /** Visible text with markdown markers removed. */
  readonly text: string
  readonly entities: readonly MessageEntity[]
  readonly blocks: readonly MessageBlock[]
  readonly warnings: readonly ParseWarning[]
}
