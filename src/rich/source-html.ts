import { escapeHtml } from '../core/render-html'
import type {
  InlineNode,
  ParsedMessage,
  PreBlock,
  QuoteBlock,
} from '../core/types'

/**
 * Renders the original markdown source with markdown ranges wrapped in
 * classes. Unlike `renderHtml`, every source character is preserved: the
 * textarea and this layer must occupy exactly the same boxes for the caret
 * and selection to line up.
 */
export function renderRichSource(document: ParsedMessage): string {
  const { source } = document
  const ranges: Range[] = []
  const lineStarts = getLineStarts(source)

  const add = (start: number, end: number, classes: readonly string[]): void => {
    if (end <= start) return
    ranges.push({
      start: Math.max(0, Math.min(start, source.length)),
      end: Math.max(0, Math.min(end, source.length)),
      classes,
    })
  }

  const visitInline = (nodes: readonly InlineNode[]): void => {
    for (const node of nodes) {
      if (node.type === 'text') continue

      if (node.type === 'code') {
        add(node.sourceStart, node.contentStart, MARKER_INLINE)
        add(node.contentStart, node.contentEnd, ['hte-code'])
        add(node.contentEnd, node.sourceEnd, MARKER_INLINE)
        continue
      }

      if (node.type === 'link') {
        add(node.sourceStart, node.sourceStart + 1, MARKER_INLINE)
        add(node.contentStart, node.contentEnd, ['hte-link'])
        add(node.contentEnd, node.contentEnd + 2, MARKER_INLINE)
        add(node.contentEnd + 2, node.sourceEnd - 1, ['hte-url'])
        add(node.sourceEnd - 1, node.sourceEnd, MARKER_INLINE)
        visitInline(node.children)
        continue
      }

      add(node.sourceStart, node.contentStart, MARKER_INLINE)
      add(node.contentStart, node.contentEnd, [`hte-${node.type}`])
      add(node.contentEnd, node.sourceEnd, MARKER_INLINE)
      visitInline(node.children)
    }
  }

  const visitQuote = (block: QuoteBlock): void => {
    block.lines.forEach((line, index) => {
      const lineStart = lineStarts[block.startLine + index] ?? line.sourceStart
      add(lineStart, line.sourceStart, MARKER_BLOCK)
      add(line.sourceStart, line.sourceEnd, ['hte-quote'])
      visitInline(line.nodes)
    })
  }

  const visitPre = (block: PreBlock): void => {
    add(block.sourceStart, block.contentStart, MARKER_BLOCK)
    add(block.contentStart, block.contentEnd, ['hte-pre'])
    add(block.contentEnd, block.sourceEnd, MARKER_BLOCK)
  }

  for (const block of document.blocks) {
    if (block.type === 'pre') visitPre(block)
    else if (block.type === 'quote') visitQuote(block)
    else {
      for (const line of block.lines) visitInline(line.nodes)
    }
  }

  return renderRanges(source, ranges)
}

interface Range {
  readonly start: number
  readonly end: number
  readonly classes: readonly string[]
}

const MARKER_INLINE = ['hte-marker', 'hte-marker--inline']
const MARKER_BLOCK = ['hte-marker', 'hte-marker--block']

function renderRanges(source: string, ranges: readonly Range[]): string {
  const events = new Map<number, { add: string[]; remove: string[] }>()
  const eventAt = (position: number): { add: string[]; remove: string[] } => {
    let event = events.get(position)
    if (!event) {
      event = { add: [], remove: [] }
      events.set(position, event)
    }
    return event
  }

  for (const range of ranges) {
    eventAt(range.start).add.push(...range.classes)
    eventAt(range.end).remove.push(...range.classes)
  }

  const positions = [...events.keys()].sort((left, right) => left - right)
  const active = new Map<string, number>()
  let cursor = 0
  let html = ''

  for (const position of positions) {
    if (position > cursor) {
      html += wrapText(source.slice(cursor, position), active)
      cursor = position
    }

    const event = events.get(position)!
    for (const className of event.remove) {
      const count = (active.get(className) ?? 0) - 1
      if (count > 0) active.set(className, count)
      else active.delete(className)
    }
    for (const className of event.add) {
      active.set(className, (active.get(className) ?? 0) + 1)
    }
  }

  html += wrapText(source.slice(cursor), active)
  return `${html}\u200B`
}

function wrapText(text: string, active: ReadonlyMap<string, number>): string {
  if (text === '') return ''
  const escaped = escapeHtml(text)
  if (active.size === 0) return escaped
  const classNames = [...active.keys()].sort().join(' ')
  return `<span class="${classNames}">${escaped}</span>`
}

function getLineStarts(source: string): number[] {
  const starts = [0]
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '\n') starts.push(index + 1)
  }
  return starts
}
