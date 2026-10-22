import type {
  CodeNode,
  InlineNode,
  InlineStyle,
  LinkNode,
} from './types'
import { isWhitespace, isWordCharacter } from './text'

interface TextToken {
  readonly kind: 'text'
  readonly value: string
  readonly sourceStart: number
  readonly sourceEnd: number
}

interface CodeToken {
  readonly kind: 'code'
  readonly node: CodeNode
}

interface LinkToken {
  readonly kind: 'link'
  readonly node: LinkNode
}

interface DelimiterToken {
  readonly kind: 'delimiter'
  readonly style: InlineStyle
  readonly markerChar: string
  readonly raw: string
  readonly sourceStart: number
  readonly sourceEnd: number
  readonly canOpen: boolean
  readonly canClose: boolean
  role: 'open' | 'close' | 'literal'
  pair: DelimiterToken | null
}

type InlineToken = TextToken | CodeToken | LinkToken | DelimiterToken

const ESCAPABLE = /^[!-/:-@[-`{-~]$/u
const MARKER_CHARACTERS = new Set(['*', '_', '~', '|'])

/**
 * Parses one line of visible text into an inline node tree. Offsets are
 * absolute offsets in the full message source.
 */
export function parseInlineLine(
  text: string,
  sourceStart: number,
): readonly InlineNode[] {
  return parseInlineNodesInternal(text, sourceStart, true)
}

function parseInlineNodesInternal(
  text: string,
  sourceStart: number,
  allowLinks: boolean,
): readonly InlineNode[] {
  const tokens = tokenize(text, sourceStart, allowLinks)
  return buildNodes(tokens)
}

function tokenize(
  text: string,
  sourceStart: number,
  allowLinks: boolean,
): InlineToken[] {
  const tokens: InlineToken[] = []
  const length = text.length
  const pairs = buildBracketPairs(text)
  let index = 0
  let plainStart = 0

  const flushPlainText = (end: number): void => {
    if (end <= plainStart) return
    tokens.push({
      kind: 'text',
      value: text.slice(plainStart, end),
      sourceStart: sourceStart + plainStart,
      sourceEnd: sourceStart + end,
    })
  }

  while (index < length) {
    const character = text[index]!

    if (character === '\\') {
      flushPlainText(index)
      const escaped = index + 1 < length ? text[index + 1]! : ''
      if (escaped !== '' && ESCAPABLE.test(escaped)) {
        tokens.push({
          kind: 'text',
          value: escaped,
          sourceStart: sourceStart + index,
          sourceEnd: sourceStart + index + 2,
        })
        index += 2
      }
      else {
        tokens.push({
          kind: 'text',
          value: '\\',
          sourceStart: sourceStart + index,
          sourceEnd: sourceStart + index + 1,
        })
        index += 1
      }
      plainStart = index
      continue
    }

    if (character === '`') {
      const runLength = countRun(text, index, '`')
      flushPlainText(index)
      const close = findBacktickRun(text, index + runLength, runLength)
      if (close === -1) {
        tokens.push(textToken(text, sourceStart, index, index + runLength))
      }
      else {
        tokens.push({
          kind: 'code',
          node: {
            type: 'code',
            value: text.slice(index + runLength, close),
            sourceStart: sourceStart + index,
            sourceEnd: sourceStart + close + runLength,
            contentStart: sourceStart + index + runLength,
            contentEnd: sourceStart + close,
          },
        })
        index = close + runLength
      }
      index = close === -1 ? index + runLength : index
      plainStart = index
      continue
    }

    if (character === '[' && allowLinks) {
      flushPlainText(index)
      const link = parseLink(text, index, sourceStart, pairs)
      if (link) {
        tokens.push({ kind: 'link', node: link.node })
        index = link.end
      }
      else {
        tokens.push(textToken(text, sourceStart, index, index + 1))
        index += 1
      }
      plainStart = index
      continue
    }

    if (MARKER_CHARACTERS.has(character)) {
      const runLength = countRun(text, index, character)
      flushPlainText(index)
      pushDelimiterTokens(tokens, text, sourceStart, index, runLength, character)
      index += runLength
      plainStart = index
      continue
    }

    index += 1
  }

  flushPlainText(length)
  pairDelimiters(tokens)
  return tokens
}

function pushDelimiterTokens(
  tokens: InlineToken[],
  text: string,
  sourceStart: number,
  runStart: number,
  runLength: number,
  character: string,
): void {
  const { canOpen, canClose } = delimiterFlanking(text, runStart, runLength, character)

  if (!canOpen && !canClose) {
    tokens.push(textToken(text, sourceStart, runStart, runStart + runLength))
    return
  }

  const preferOpen = canOpen && !canClose
  const singleStyle: InlineStyle = 'italic'
  const doubleStyle: InlineStyle | null
    = character === '*' ? 'bold' : character === '_' ? 'underline' : null

  if (character === '~' || character === '|') {
    // Strike and spoiler markers only exist in pairs.
    if (runLength < 2 || runLength % 2 !== 0) {
      tokens.push(textToken(text, sourceStart, runStart, runStart + runLength))
      return
    }
    const style: InlineStyle = character === '~' ? 'strikethrough' : 'spoiler'
    for (let offset = 0; offset < runLength; offset += 2) {
      tokens.push(delimiterToken(
        text,
        sourceStart,
        runStart + offset,
        2,
        style,
        character,
        canOpen,
        canClose,
      ))
    }
    return
  }

  const addDouble = (offset: number): void => {
    if (!doubleStyle) return
    tokens.push(delimiterToken(
      text,
      sourceStart,
      runStart + offset,
      2,
      doubleStyle,
      character,
      canOpen,
      canClose,
    ))
  }

  const addSingle = (offset: number): void => {
    tokens.push(delimiterToken(
      text,
      sourceStart,
      runStart + offset,
      1,
      singleStyle,
      character,
      canOpen,
      canClose,
    ))
  }

  let offset = 0
  let remaining = runLength

  if (preferOpen) {
    while (remaining >= 2) {
      addDouble(offset)
      offset += 2
      remaining -= 2
    }
    if (remaining === 1) addSingle(offset)
    return
  }

  // A closing run is consumed from the edge nearest the content inwards.
  while (remaining >= 2) {
    if (remaining % 2 === 1) {
      addSingle(offset)
      offset += 1
      remaining -= 1
    }
    addDouble(offset)
    offset += 2
    remaining -= 2
  }
  if (remaining === 1) addSingle(offset)
}

function delimiterFlanking(
  text: string,
  runStart: number,
  runLength: number,
  character: string,
): { canOpen: boolean; canClose: boolean } {
  const before = runStart > 0 ? text[runStart - 1]! : ''
  const afterIndex = runStart + runLength
  const after = afterIndex < text.length ? text[afterIndex]! : ''

  let canOpen = !isWhitespace(after)
  let canClose = !isWhitespace(before)

  // Underscores do not open or close inside words (snake_case stays literal).
  if (character === '_') {
    if (isWordCharacter(before)) canOpen = false
    if (isWordCharacter(after)) canClose = false
  }

  return { canOpen, canClose }
}

function delimiterToken(
  text: string,
  sourceStart: number,
  runStart: number,
  markerLength: number,
  style: InlineStyle,
  markerChar: string,
  canOpen: boolean,
  canClose: boolean,
): DelimiterToken {
  return {
    kind: 'delimiter',
    style,
    markerChar,
    raw: text.slice(runStart, runStart + markerLength),
    sourceStart: sourceStart + runStart,
    sourceEnd: sourceStart + runStart + markerLength,
    canOpen,
    canClose,
    role: 'literal',
    pair: null,
  }
}

function pairDelimiters(tokens: readonly InlineToken[]): void {
  const stack: DelimiterToken[] = []

  for (const token of tokens) {
    if (token.kind !== 'delimiter') continue

    if (token.canClose) {
      let match = -1
      for (let index = stack.length - 1; index >= 0; index -= 1) {
        const open = stack[index]!
        if (open.style === token.style && open.markerChar === token.markerChar) {
          match = index
          break
        }
      }

      if (match !== -1) {
        const open = stack[match]!
        // Anything opened inside the pair but not closed before this token
        // would produce crossing ranges. Leave those markers literal instead.
        for (let index = match + 1; index < stack.length; index += 1) {
          stack[index]!.role = 'literal'
        }
        stack.length = match
        open.role = 'open'
        open.pair = token
        token.role = 'close'
        token.pair = open
        continue
      }
    }

    if (token.canOpen) {
      token.role = 'open'
      stack.push(token)
      continue
    }

    token.role = 'literal'
  }

  for (const token of stack) token.role = 'literal'
}

function buildNodes(tokens: readonly InlineToken[]): readonly InlineNode[] {
  const root: InlineNode[] = []
  const frames: Array<{ open: DelimiterToken; children: InlineNode[] }> = []

  const current = (): InlineNode[] => {
    return frames.length > 0 ? frames[frames.length - 1]!.children : root
  }

  for (const token of tokens) {
    if (token.kind === 'text') {
      appendText(current(), token.value, token.sourceStart, token.sourceEnd)
      continue
    }

    if (token.kind === 'code' || token.kind === 'link') {
      current().push(token.node)
      continue
    }

    if (token.role === 'open') {
      frames.push({ open: token, children: [] })
      continue
    }

    if (token.role === 'close') {
      const frame = frames[frames.length - 1]
      if (frame && frame.open.pair === token) {
        frames.pop()
        const open = frame.open
        current().push({
          type: open.style,
          children: frame.children,
          sourceStart: open.sourceStart,
          sourceEnd: token.sourceEnd,
          contentStart: open.sourceEnd,
          contentEnd: token.sourceStart,
        })
      }
      else {
        appendText(current(), token.raw, token.sourceStart, token.sourceEnd)
      }
      continue
    }

    appendText(current(), token.raw, token.sourceStart, token.sourceEnd)
  }

  // Pairing guarantees this never runs, but keep the parser total.
  while (frames.length > 0) {
    const frame = frames.pop()!
    const parent = current()
    appendText(parent, frame.open.raw, frame.open.sourceStart, frame.open.sourceEnd)
    parent.push(...frame.children)
  }

  return root
}

function appendText(
  children: InlineNode[],
  value: string,
  sourceStart: number,
  sourceEnd: number,
): void {
  if (value === '') return
  const last = children[children.length - 1]
  if (last && last.type === 'text' && last.sourceEnd === sourceStart) {
    children[children.length - 1] = {
      type: 'text',
      value: last.value + value,
      sourceStart: last.sourceStart,
      sourceEnd,
    }
    return
  }
  children.push({ type: 'text', value, sourceStart, sourceEnd })
}

function textToken(
  text: string,
  sourceStart: number,
  start: number,
  end: number,
): TextToken {
  return {
    kind: 'text',
    value: text.slice(start, end),
    sourceStart: sourceStart + start,
    sourceEnd: sourceStart + end,
  }
}

function countRun(text: string, start: number, character: string): number {
  let index = start
  while (index < text.length && text[index] === character) index += 1
  return index - start
}

function findBacktickRun(text: string, start: number, runLength: number): number {
  let index = start
  while (index < text.length) {
    if (text[index] !== '`') {
      index += 1
      continue
    }
    const candidate = countRun(text, index, '`')
    if (candidate === runLength) return index
    index += candidate
  }
  return -1
}

interface ParsedLink {
  readonly node: LinkNode
  /** Index in the line just after the closing parenthesis. */
  readonly end: number
}

function parseLink(
  text: string,
  start: number,
  sourceStart: number,
  pairs: BracketPairs,
): ParsedLink | null {
  const closeBracket = pairs.brackets.get(start)
  if (closeBracket === undefined || text[closeBracket + 1] !== '(') return null

  const closeParen = pairs.parens.get(closeBracket + 1)
  if (closeParen === undefined) return null

  const labelSourceStart = sourceStart + start + 1
  const label = text.slice(start + 1, closeBracket)
  const children = parseInlineNodesInternal(label, labelSourceStart, false)

  return {
    node: {
      type: 'link',
      url: unescapePunctuation(text.slice(closeBracket + 2, closeParen).trim()),
      children,
      sourceStart: sourceStart + start,
      sourceEnd: sourceStart + closeParen + 1,
      contentStart: labelSourceStart,
      contentEnd: sourceStart + closeBracket,
    },
    end: closeParen + 1,
  }
}

interface BracketPairs {
  readonly brackets: ReadonlyMap<number, number>
  readonly parens: ReadonlyMap<number, number>
}

/**
 * Precomputes bracket and parenthesis pairs for a line. Finding them by
 * scanning forward from every `[` would be quadratic on malformed input such
 * as thousands of unmatched brackets.
 */
function buildBracketPairs(text: string): BracketPairs {
  const bracketStack: number[] = []
  const parenStack: number[] = []
  const brackets = new Map<number, number>()
  const parens = new Map<number, number>()

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!
    if (character === '\\') {
      index += 1
      continue
    }

    if (character === '[') {
      bracketStack.push(index)
    }
    else if (character === ']') {
      const open = bracketStack.pop()
      if (open !== undefined) brackets.set(open, index)
    }
    else if (character === '(') {
      parenStack.push(index)
    }
    else if (character === ')') {
      const open = parenStack.pop()
      if (open !== undefined) parens.set(open, index)
    }
  }

  return { brackets, parens }
}

function unescapePunctuation(value: string): string {
  let result = ''
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!
    const next = value[index + 1]
    if (character === '\\' && next !== undefined && ESCAPABLE.test(next)) {
      result += next
      index += 1
    }
    else {
      result += character
    }
  }
  return result
}
