import { QUOTE_PREFIX, STYLE_MARKERS } from '../core/markers'
import { parseMessage } from '../core/parse'
import { renderHtml, type HtmlRenderOptions } from '../core/render-html'
import type {
  CodeNode,
  InlineNode,
  InlineStyle,
  ParsedMessage,
  PreBlock,
  QuoteBlock,
  StyleNode,
} from '../core/types'
import { normalizeNewlines } from '../core/text'
import { sanitizeUrl } from '../core/url'
import {
  DEFAULT_MAX_LENGTH,
  validateDocument,
  type ValidationResult,
} from '../core/validate'
import {
  applyEdits,
  clampRange,
  expandToLines,
  lineEndAt,
  lineStartAt,
  linesInRange,
  mapRange,
  trimRange,
  type Range,
  type TextEdit,
} from './edits'
import {
  createEmptyActiveStyles,
  type ActiveStyles,
  type ChangeEvent,
  type EditorEventMap,
  type EditorOptions,
  type EditorSnapshot,
  type SelectionEvent,
  type SelectionRange,
  type SubmitOptions,
  type SubmitPayload,
} from './types'

type Listener = (payload: unknown) => void
type InlineCommand = InlineStyle | 'code'
type UnwrappableNode = StyleNode | CodeNode

/** Invisible character that keeps an empty pair of markers parseable. */
const PLACEHOLDER = '\u200B'

/**
 * Framework-agnostic editor controller for a native `<textarea>`.
 *
 * It never renders UI: it owns the markdown value, formatting commands,
 * validation state and submit payloads, so the same logic is available to
 * vanilla JS, Vue and React consumers.
 */
export class MarkdownEditor {
  readonly textarea: HTMLTextAreaElement

  private readonly options: EditorOptions
  private readonly listeners = new Map<keyof EditorEventMap, Set<Listener>>()
  private documentCache: { value: string; document: ParsedMessage } | null = null
  private lastValue: string
  private lastSelectionKey = ''
  private applying = false
  private destroyed = false

  constructor(textarea: HTMLTextAreaElement, options: EditorOptions = {}) {
    this.textarea = textarea
    this.options = options

    const initialValue = normalizeNewlines(options.value ?? textarea.value)
    if (textarea.value !== initialValue) textarea.value = initialValue

    this.lastValue = textarea.value
    textarea.addEventListener('input', this.handleInput)
    textarea.addEventListener('keydown', this.handleKeyDown)
    textarea.addEventListener('select', this.handleSelection)
    textarea.addEventListener('keyup', this.handleSelection)
    textarea.addEventListener('mouseup', this.handleSelection)
    textarea.addEventListener('focus', this.handleSelection)
  }

  get value(): string {
    return this.textarea.value
  }

  get canSubmit(): boolean {
    return this.getValidation().valid
  }

  /** Parsed representation of the current value, cached per value. */
  getDocument(): ParsedMessage {
    const value = this.textarea.value
    if (!this.documentCache || this.documentCache.value !== value) {
      this.documentCache = { value, document: parseMessage(value) }
    }
    return this.documentCache.document
  }

  getValidation(): ValidationResult {
    return validateDocument(this.getDocument(), {
      maxLength: this.options.maxLength,
      allowEmpty: this.options.allowEmpty,
    })
  }

  getSelection(): SelectionRange {
    const start = this.textarea.selectionStart ?? 0
    const end = this.textarea.selectionEnd ?? start
    return { start, end }
  }

  setSelection(selection: SelectionRange): void {
    const range = clampRange(selection, this.textarea.value.length)
    this.textarea.setSelectionRange(range.start, range.end)
    this.emitSelection()
  }

  getActiveStyles(selection: SelectionRange = this.getSelection()): ActiveStyles {
    const active = createEmptyActiveStyles()
    const document = this.getDocument()

    for (const block of document.blocks) {
      if (!covers(selection, block.sourceStart, block.sourceEnd)) continue

      if (block.type === 'pre') {
        active.pre = true
        continue
      }

      if (block.type === 'quote') active.quote = true

      for (const line of block.lines) {
        visitActiveNodes(line.nodes, selection, active)
      }
    }

    return active
  }

  getSnapshot(): EditorSnapshot {
    const selection = this.getSelection()
    const document = this.getDocument()
    const validation = this.getValidation()

    return {
      value: this.textarea.value,
      document,
      validation,
      canSubmit: validation.valid,
      selection,
      activeStyles: this.getActiveStyles(selection),
    }
  }

  getHtml(options: HtmlRenderOptions = {}): string {
    return renderHtml(this.getDocument(), { ...this.options.html, ...options })
  }

  setValue(value: string, options: { emit?: boolean } = {}): void {
    const nextValue = normalizeNewlines(value)
    if (this.textarea.value === nextValue) return

    const previous = this.getSelection()
    const scrollTop = this.textarea.scrollTop
    this.textarea.value = nextValue
    const selection = clampRange(previous, nextValue.length)
    this.textarea.setSelectionRange(selection.start, selection.end)
    this.textarea.scrollTop = scrollTop
    this.lastValue = nextValue

    if (options.emit === false) {
      this.lastSelectionKey = ''
      return
    }

    this.dispatchInput()
  }

  clear(): void {
    this.setValue('')
    this.setSelection({ start: 0, end: 0 })
  }

  insertText(text: string): void {
    if (this.textarea.readOnly) return
    const selection = this.getSelection()
    const value = normalizeNewlines(text)
    this.commit(
      [{ start: selection.start, end: selection.end, replacement: value }],
      { start: selection.start + value.length, end: selection.start + value.length },
    )
  }

  insertLink(url: string, label?: string): boolean {
    if (this.textarea.readOnly) return false
    if (sanitizeUrl(url) === null) return false

    const selection = this.getSelection()
    if (this.findPreBlock(selection)) return false

    const value = this.textarea.value
    const existing = this.findLinkNode(selection)
    const linkUrl = escapeLinkUrl(url)

    if (existing) {
      const rawLabel = value.slice(existing.contentStart, existing.contentEnd)
      const labelSource = label === undefined
        ? rawLabel
        : escapeLinkLabel(normalizeLinkLabel(label))
      const finalLabel = labelSource || escapeLinkLabel(url)
      const markdown = `[${finalLabel}](${linkUrl})`
      const labelStart = existing.sourceStart + 1
      this.commit(
        [{ start: existing.sourceStart, end: existing.sourceEnd, replacement: markdown }],
        { start: labelStart, end: labelStart + finalLabel.length },
      )
      return true
    }

    if (selection.start !== selection.end) {
      const raw = value.slice(selection.start, selection.end)
      const nextLabel = normalizeLinkLabel(label ?? raw) || url
      const escapedLabel = escapeLinkLabel(nextLabel)
      const markdown = `[${escapedLabel}](${linkUrl})`
      this.commit(
        [{ start: selection.start, end: selection.end, replacement: markdown }],
        {
          start: selection.start + 1,
          end: selection.start + 1 + escapedLabel.length,
        },
      )
      return true
    }

    const nextLabel = normalizeLinkLabel(label ?? url) || url
    const escapedLabel = escapeLinkLabel(nextLabel)
    const markdown = `[${escapedLabel}](${linkUrl})`
    const position = selection.start + markdown.length
    this.commit(
      [{ start: selection.start, end: selection.start, replacement: markdown }],
      { start: position, end: position },
    )
    return true
  }

  removeLink(): boolean {
    if (this.textarea.readOnly) return false
    const selection = this.getSelection()
    const node = this.findLinkNode(selection)
    if (!node) return false

    const value = this.textarea.value
    const label = value.slice(node.contentStart, node.contentEnd)
    const edits: TextEdit[] = [
      { start: node.sourceStart, end: node.sourceEnd, replacement: label },
    ]
    this.commit(edits, mapRange(selection, edits))
    return true
  }

  toggleStyle(style: InlineStyle): void {
    if (this.textarea.readOnly) return

    const selection = this.getSelection()
    if (this.isInsidePre(selection) || this.isInsideLinkUrl(selection)) return

    if (this.findInlineNode('code', selection)) return

    this.runInlineCommand(STYLE_MARKERS[style], style, selection)
  }

  toggleCode(): void {
    if (this.textarea.readOnly) return
    const selection = this.getSelection()
    if (this.isInsidePre(selection) || this.isInsideLinkUrl(selection)) return

    this.runInlineCommand('`', 'code', selection)
  }

  toggleBold(): void {
    this.toggleStyle('bold')
  }

  toggleItalic(): void {
    this.toggleStyle('italic')
  }

  toggleUnderline(): void {
    this.toggleStyle('underline')
  }

  toggleStrikethrough(): void {
    this.toggleStyle('strikethrough')
  }

  toggleSpoiler(): void {
    this.toggleStyle('spoiler')
  }

  toggleQuote(): void {
    if (this.textarea.readOnly) return

    const selection = this.getSelection()
    if (this.isInsidePre(selection)) return

    const value = this.textarea.value
    const quoteBlock = this.findQuoteBlock(selection)
    const range = quoteBlock
      ? { start: quoteBlock.sourceStart, end: quoteBlock.sourceEnd }
      : expandToLines(value, selection)
    const lines = linesInRange(value, range)
    if (lines.length === 0) return

    const allQuoted = lines.every((line) => QUOTE_PREFIX.test(line.text))
    const edits: TextEdit[] = []

    for (const line of lines) {
      const match = QUOTE_PREFIX.exec(line.text)
      if (allQuoted) {
        if (match) {
          edits.push({
            start: line.start,
            end: line.start + match[0].length,
            replacement: '',
          })
        }
      }
      else if (!match) {
        edits.push({
          start: line.start,
          end: line.start,
          replacement: '> ',
        })
      }
    }

    if (edits.length === 0) return
    this.commit(edits, mapRange(selection, edits))
  }

  /**
   * Toggles a fenced code block. When the caret is inside a code block the
   * fences are removed. Otherwise the current lines are wrapped in a fence,
   * using a longer fence when the content already contains backticks.
   */
  toggleCodeBlock(language = ''): void {
    if (this.textarea.readOnly) return

    const selection = this.getSelection()
    const existing = this.findPreBlock(selection)
    if (existing) {
      this.removePreBlock(existing)
      return
    }

    const value = this.textarea.value
    let target: Range

    if (selection.start !== selection.end) {
      target = expandToLines(value, selection)
    }
    else {
      const start = lineStartAt(value, selection.start)
      const end = lineEndAt(value, selection.start)
      target = value.slice(start, end).trim() === ''
        ? { start, end: start }
        : { start, end }
    }

    const content = value.slice(target.start, target.end)
    const fence = '`'.repeat(Math.max(3, longestBacktickRun(content) + 1))
    const safeLanguage = language.replace(/[^A-Za-z0-9_+#.-]/gu, '')
    const opening = `${fence}${safeLanguage}\n`
    const replacement = `${opening}${content}${content.endsWith('\n') ? '' : '\n'}${fence}`
    const contentStart = target.start + opening.length
    const nextSelection = content === ''
      ? { start: contentStart, end: contentStart }
      : { start: contentStart, end: contentStart + content.length }

    this.commit(
      [{ start: target.start, end: target.end, replacement }],
      nextSelection,
    )
  }

  submit(options: SubmitOptions = {}): SubmitPayload | null {
    const validation = this.getValidation()
    if (!options.force && !validation.valid) return null

    const document = this.getDocument()
    const payload: SubmitPayload = {
      raw: this.textarea.value,
      text: document.text,
      html: this.getHtml(),
      document,
      entities: document.entities,
    }

    this.options.onSubmit?.(payload)
    this.emit('submit', payload)
    return payload
  }

  focus(): void {
    this.textarea.focus({ preventScroll: true })
  }

  on<K extends keyof EditorEventMap>(
    event: K,
    listener: (payload: EditorEventMap[K]) => void,
  ): () => void {
    let listeners = this.listeners.get(event)
    if (!listeners) {
      listeners = new Set<Listener>()
      this.listeners.set(event, listeners)
    }
    const entry = listener as Listener
    listeners.add(entry)
    return () => {
      listeners?.delete(entry)
    }
  }

  off<K extends keyof EditorEventMap>(
    event: K,
    listener: (payload: EditorEventMap[K]) => void,
  ): void {
    this.listeners.get(event)?.delete(listener as Listener)
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true

    const textarea = this.textarea
    textarea.removeEventListener('input', this.handleInput)
    textarea.removeEventListener('keydown', this.handleKeyDown)
    textarea.removeEventListener('select', this.handleSelection)
    textarea.removeEventListener('keyup', this.handleSelection)
    textarea.removeEventListener('mouseup', this.handleSelection)
    textarea.removeEventListener('focus', this.handleSelection)

    this.emit('destroy', undefined)
    this.listeners.clear()
  }

  private readonly handleInput = (): void => {
    const value = this.textarea.value
    const changed = value !== this.lastValue
    this.lastValue = value
    this.emitChange()
    if (changed) this.lastSelectionKey = ''
    this.emitSelection()
  }

  private readonly handleSelection = (): void => {
    if (this.applying) return
    this.emitSelection()
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229) {
      return
    }

    const modifier = event.metaKey || event.ctrlKey

    if (modifier && !event.altKey && this.options.shortcuts !== false) {
      const command = this.shortcutFor(
        event.key.toLowerCase(),
        event.code,
        event.shiftKey,
      )
      if (command) {
        event.preventDefault()
        command()
        return
      }
    }

    if (event.key !== 'Enter' || event.altKey) return

    const selection = this.getSelection()
    const wantsSubmit = !event.shiftKey
      && (modifier || this.options.submitOnEnter === true)

    if (wantsSubmit) {
      event.preventDefault()
      this.submit()
      return
    }

    if (
      this.options.autoContinueQuote !== false
      && selection.start === selection.end
      && this.continueQuote(selection.start)
    ) {
      event.preventDefault()
    }
  }

  private shortcutFor(key: string, code: string, shift: boolean): (() => void) | null {
    // Prefer the physical key so Ctrl+B works on non-Latin layouts too.
    const normalized = code.startsWith('Key') ? code.slice(3).toLowerCase() : key
    switch (normalized) {
      case 'b':
        return () => this.toggleBold()
      case 'i':
        return () => this.toggleItalic()
      case 'u':
        return () => this.toggleUnderline()
      case 'x':
        return shift ? () => this.toggleStrikethrough() : null
      case 'p':
        return shift ? () => this.toggleSpoiler() : null
      case 'e':
        return shift ? () => this.toggleCodeBlock() : () => this.toggleCode()
      case 'q':
        return shift ? () => this.toggleQuote() : null
      case 'm':
        return shift ? () => this.toggleCode() : null
      default:
        return null
    }
  }

  private continueQuote(position: number): boolean {
    if (this.textarea.readOnly) return false
    const value = this.textarea.value
    const lineStart = lineStartAt(value, position)
    const lineEnd = lineEndAt(value, position)
    const line = value.slice(lineStart, lineEnd)
    const match = QUOTE_PREFIX.exec(line)
    if (!match) return false
    if (position < lineStart + match[0].length) return false

    if (line.slice(match[0].length).trim() === '') {
      const edits: TextEdit[] = [
        { start: lineStart, end: lineStart + match[0].length, replacement: '' },
      ]
      this.commit(edits, { start: lineStart, end: lineStart })
      return true
    }

    const insertion = '\n> '
    const caret = position + insertion.length
    this.commit(
      [{ start: position, end: position, replacement: insertion }],
      { start: caret, end: caret },
    )
    return true
  }

  private emitChange(): void {
    const document = this.getDocument()
    const validation = this.getValidation()
    const event: ChangeEvent = {
      value: this.textarea.value,
      document,
      validation,
      canSubmit: validation.valid,
    }

    this.options.onChange?.(event)
    this.emit('change', event)
  }

  private emitSelection(force = false): void {
    const selection = this.getSelection()
    const key = `${selection.start}:${selection.end}`
    if (!force && key === this.lastSelectionKey) return
    this.lastSelectionKey = key

    const event: SelectionEvent = {
      selection,
      activeStyles: this.getActiveStyles(selection),
    }

    this.options.onSelectionChange?.(event)
    this.emit('selection', event)
  }

  private emit<K extends keyof EditorEventMap>(
    event: K,
    payload: EditorEventMap[K],
  ): void {
    const listeners = this.listeners.get(event)
    if (!listeners) return
    for (const listener of [...listeners]) listener(payload)
  }

  private commit(edits: readonly TextEdit[], selection: SelectionRange): void {
    if (edits.length === 0) return

    const value = this.textarea.value
    const next = applyEdits(value, edits)
    const clamped = clampRange(selection, next.length)

    if (next === value) {
      this.setSelection(clamped)
      return
    }

    const textarea = this.textarea
    const scrollTop = textarea.scrollTop
    this.applying = true

    if (textarea.ownerDocument.activeElement !== textarea) {
      textarea.focus({ preventScroll: true })
    }
    textarea.value = next
    textarea.setSelectionRange(clamped.start, clamped.end)
    textarea.scrollTop = scrollTop

    this.applying = false
    this.dispatchInput()
  }

  private dispatchInput(): void {
    const textarea = this.textarea
    const event = typeof InputEvent === 'function'
      ? new InputEvent('input', { bubbles: true, inputType: 'insertText' })
      : new Event('input', { bubbles: true })
    textarea.dispatchEvent(event)
  }

  private runInlineCommand(
    marker: string,
    style: InlineCommand,
    selection: SelectionRange,
  ): void {
    const nodes = this.collectInlineNodes(style)
    const covering = nodes.find((node) => {
      return covers(selection, node.contentStart, node.contentEnd)
        || (selection.start === node.sourceStart && selection.end === node.sourceEnd)
    })

    if (covering) {
      this.unwrapInlineNode(covering)
      return
    }

    const overlapping = nodes.filter((node) => {
      return overlaps(selection, node.sourceStart, node.sourceEnd)
    })
    if (overlapping.some((node) => !contains(selection, node.sourceStart, node.sourceEnd))) {
      return
    }

    if (overlapping.length > 0) {
      this.wrapInlineRemoving(marker, selection, overlapping)
      return
    }

    this.wrapInline(marker, selection)
  }

  private wrapInlineRemoving(
    marker: string,
    selection: SelectionRange,
    nodes: readonly UnwrappableNode[],
  ): void {
    const ranges = this.inlineRanges(selection)
    if (ranges.length === 0) return

    const edits: TextEdit[] = []
    for (const node of nodes) {
      const content = this.textarea.value.slice(node.contentStart, node.contentEnd)
      if (content === PLACEHOLDER) {
        edits.push({ start: node.sourceStart, end: node.sourceEnd, replacement: '' })
        continue
      }
      edits.push(
        { start: node.sourceStart, end: node.contentStart, replacement: '' },
        { start: node.contentEnd, end: node.sourceEnd, replacement: '' },
      )
    }

    for (const range of ranges) {
      edits.push(
        { start: range.start, end: range.start, replacement: marker },
        { start: range.end, end: range.end, replacement: marker },
      )
    }

    this.commit(edits, mapRange(selection, edits))
  }

  private inlineRanges(selection: SelectionRange): Range[] {
    const value = this.textarea.value

    if (!value.slice(selection.start, selection.end).includes('\n')) {
      const content = trimRange(value, selection)
      return content.start === content.end ? [] : [content]
    }

    return linesInRange(value, expandToLines(value, selection))
      .map((line) => trimRange(value, {
        start: Math.max(line.start, selection.start),
        end: Math.min(line.end, selection.end),
      }))
      .filter((range) => range.start !== range.end)
  }

  private wrapInline(marker: string, selection: SelectionRange): void {
    const value = this.textarea.value

    if (
      selection.start !== selection.end
      && value.slice(selection.start, selection.end).includes('\n')
    ) {
      this.wrapInlinePerLine(marker, selection)
      return
    }

    if (selection.start !== selection.end) {
      const content = trimRange(value, selection)
      if (content.start === content.end) return

      const edits: TextEdit[] = [
        { start: content.start, end: content.start, replacement: marker },
        { start: content.end, end: content.end, replacement: marker },
      ]
      this.commit(edits, {
        start: content.start + marker.length,
        end: content.end + marker.length,
      })
      return
    }

    const position = selection.start
    const before = value.slice(position - marker.length, position)
    const after = value.slice(position, position + marker.length)

    if (before === marker && after === marker) {
      const edits: TextEdit[] = [
        { start: position - marker.length, end: position, replacement: '' },
        { start: position, end: position + marker.length, replacement: '' },
      ]
      this.commit(edits, {
        start: position - marker.length,
        end: position - marker.length,
      })
      return
    }

    // The placeholder keeps the empty marker pair parseable while the caret
    // sits between the markers. It is invisible and `isBlank()` ignores it.
    const insert = marker + PLACEHOLDER + marker
    const placeholderStart = position + marker.length
    this.commit(
      [{ start: position, end: position, replacement: insert }],
      { start: placeholderStart, end: placeholderStart + PLACEHOLDER.length },
    )
  }

  private wrapInlinePerLine(marker: string, selection: SelectionRange): void {
    const value = this.textarea.value
    const range = expandToLines(value, selection)
    const edits: TextEdit[] = []

    for (const line of linesInRange(value, range)) {
      // Do not trim the selected part away at the edges of a multi-line
      // selection: each line is wrapped independently.
      const content = trimRange(value, {
        start: Math.max(line.start, selection.start),
        end: Math.min(line.end, selection.end),
      })
      if (content.start === content.end) continue
      edits.push(
        { start: content.start, end: content.start, replacement: marker },
        { start: content.end, end: content.end, replacement: marker },
      )
    }

    if (edits.length === 0) return
    this.commit(edits, mapRange(selection, edits))
  }

  private unwrapInlineNode(node: UnwrappableNode): void {
    const selection = this.getSelection()
    const content = this.textarea.value.slice(node.contentStart, node.contentEnd)

    // Removing an empty pair inserted by the editor should not leave its
    // invisible placeholder behind.
    const edits: TextEdit[] = content === PLACEHOLDER
      ? [{ start: node.sourceStart, end: node.sourceEnd, replacement: '' }]
      : [
        { start: node.sourceStart, end: node.contentStart, replacement: '' },
        { start: node.contentEnd, end: node.sourceEnd, replacement: '' },
      ]

    this.commit(edits, mapRange(selection, edits))
  }

  private findInlineNode(
    style: InlineCommand,
    selection: SelectionRange,
  ): UnwrappableNode | null {
    return this.collectInlineNodes(style).find((node) => {
      return covers(selection, node.contentStart, node.contentEnd)
        || (selection.start === node.sourceStart && selection.end === node.sourceEnd)
    }) ?? null
  }

  private collectInlineNodes(style: InlineCommand): UnwrappableNode[] {
    const found: UnwrappableNode[] = []

    const visit = (nodes: readonly InlineNode[]): void => {
      for (const node of nodes) {
        if (node.type === 'text') continue

        if (node.type === 'link') {
          visit(node.children)
          continue
        }

        if (style === 'code' ? node.type === 'code' : node.type === style) {
          found.push(node)
        }

        if (node.type !== 'code') visit(node.children)
      }
    }

    for (const block of this.getDocument().blocks) {
      if (block.type === 'pre') continue
      for (const line of block.lines) visit(line.nodes)
    }

    return found
  }

  private findLinkNode(
    selection: SelectionRange,
  ): Extract<InlineNode, { type: 'link' }> | null {
    let found: Extract<InlineNode, { type: 'link' }> | null = null

    const visit = (nodes: readonly InlineNode[]): void => {
      for (const node of nodes) {
        if (node.type === 'text' || node.type === 'code') continue
        if (node.type === 'link') {
          // A caret directly after the closing parenthesis is outside the
          // link, otherwise formatting the next word would silently no-op.
          const inside = selection.start === selection.end
            ? selection.start > node.sourceStart && selection.start < node.sourceEnd
            : selection.start >= node.sourceStart && selection.end <= node.sourceEnd
          if (inside) found = node
          visit(node.children)
          continue
        }
        visit(node.children)
      }
    }

    for (const block of this.getDocument().blocks) {
      if (block.type === 'pre') continue
      for (const line of block.lines) visit(line.nodes)
    }

    return found
  }

  private isInsideLinkUrl(selection: SelectionRange): boolean {
    const link = this.findLinkNode(selection)
    if (!link) return false
    return !covers(selection, link.contentStart, link.contentEnd)
  }

  private findPreBlock(selection: SelectionRange): PreBlock | null {
    for (const block of this.getDocument().blocks) {
      if (block.type !== 'pre') continue
      if (covers(selection, block.sourceStart, block.sourceEnd)) return block
    }
    return null
  }

  private findQuoteBlock(selection: SelectionRange): QuoteBlock | null {
    for (const block of this.getDocument().blocks) {
      if (block.type !== 'quote') continue
      if (covers(selection, block.sourceStart, block.sourceEnd)) return block
    }
    return null
  }

  private isInsidePre(selection: SelectionRange): boolean {
    return this.findPreBlock(selection) !== null
  }

  private removePreBlock(block: PreBlock): void {
    const value = this.textarea.value
    const edits: TextEdit[] = []
    const openingLineEnd = value.indexOf('\n', block.sourceStart)
    const openingEnd = openingLineEnd === -1 ? value.length : openingLineEnd + 1

    edits.push({
      start: block.sourceStart,
      end: openingEnd,
      replacement: '',
    })

    if (!block.unclosed) {
      // The newline immediately before the closing fence belongs to the
      // fence. The newline after the fence belongs to the next block and must
      // stay, otherwise two blocks would be glued together.
      const closingStart = block.contentEnd > openingEnd
        && value[block.contentEnd - 1] === '\n'
        ? block.contentEnd - 1
        : block.contentEnd
      edits.push({
        start: closingStart,
        end: block.sourceEnd,
        replacement: '',
      })
    }

    this.commit(edits, mapRange(this.getSelection(), edits))
  }
}

function contains(selection: SelectionRange, start: number, end: number): boolean {
  return selection.start <= start && selection.end >= end
}

function overlaps(selection: SelectionRange, start: number, end: number): boolean {
  if (selection.start === selection.end) {
    return selection.start >= start && selection.start <= end
  }
  return selection.start < end && selection.end > start
}

function covers(selection: SelectionRange, start: number, end: number): boolean {
  if (selection.start === selection.end) {
    return selection.start >= start && selection.start <= end
  }
  return selection.start >= start && selection.end <= end
}

function visitActiveNodes(
  nodes: readonly InlineNode[],
  selection: SelectionRange,
  active: ActiveStyles,
): void {
  for (const node of nodes) {
    if (node.type === 'text') continue

    if (node.type === 'link') {
      visitActiveNodes(node.children, selection, active)
      continue
    }

    if (node.type === 'code') {
      if (covers(selection, node.contentStart, node.contentEnd)) {
        active.code = true
      }
      continue
    }

    if (covers(selection, node.contentStart, node.contentEnd)) {
      active[node.type] = true
    }
    visitActiveNodes(node.children, selection, active)
  }
}

function normalizeLinkLabel(value: string): string {
  return value.replace(/\s*\n\s*/gu, ' ').trim()
}

function escapeLinkLabel(value: string): string {
  return value.replace(/([\\[\]])/gu, '\\$1')
}

function escapeLinkUrl(value: string): string {
  return value.replace(/([\\()])/gu, '\\$1')
}

function longestBacktickRun(value: string): number {
  let longest = 0
  let current = 0
  for (const character of value) {
    if (character === '`') {
      current += 1
      longest = Math.max(longest, current)
    }
    else {
      current = 0
    }
  }
  return longest
}

export { DEFAULT_MAX_LENGTH }
