import type {
  InlineLine,
  MessageBlock,
  ParagraphBlock,
  ParseWarning,
  PreBlock,
  QuoteBlock,
} from './types'
import { parseInlineLine } from './inline'
import { QUOTE_PREFIX } from './markers'

interface LineInfo {
  readonly start: number
  readonly end: number
  readonly text: string
}

interface ParseBlocksResult {
  readonly blocks: readonly MessageBlock[]
  readonly warnings: readonly ParseWarning[]
  readonly lineCount: number
}

const FENCE_OPEN = /^( {0,3})(`{3,})([^`]*)$/
const BLANK_LINE = /^\s*$/u

export function parseBlocks(source: string): ParseBlocksResult {
  const lines = splitLines(source)
  const blocks: MessageBlock[] = []
  const warnings: ParseWarning[] = []
  let previousEndLine = -1
  let index = 0

  const addBlock = (block: MessageBlock): void => {
    const newlinesBefore = previousEndLine === -1
      ? block.startLine
      : block.startLine - previousEndLine
    previousEndLine = block.endLine
    blocks.push({ ...block, newlinesBefore })
  }

  while (index < lines.length) {
    const line = lines[index]!
    if (BLANK_LINE.test(line.text)) {
      index += 1
      continue
    }

    const fence = FENCE_OPEN.exec(line.text)
    if (fence) {
      const result = parsePreBlock(lines, index, fence, source.length)
      addBlock(result.block)
      if (result.block.unclosed) {
        warnings.push({
          code: 'UNCLOSED_CODE_BLOCK',
          message: 'Code block has no closing fence.',
          line: index + 1,
        })
      }
      index = result.nextIndex
      continue
    }

    if (QUOTE_PREFIX.test(line.text)) {
      const startLine = index
      const quoteLines: InlineLine[] = []
      while (index < lines.length) {
        const current = lines[index]!
        const match = QUOTE_PREFIX.exec(current.text)
        if (!match) break
        const contentStart = current.start + match[0].length
        quoteLines.push({
          sourceStart: contentStart,
          sourceEnd: current.end,
          nodes: parseInlineLine(
            current.text.slice(match[0].length),
            contentStart,
          ),
        })
        index += 1
      }
      const endLine = index - 1
      const block: QuoteBlock = {
        type: 'quote',
        startLine,
        endLine,
        sourceStart: lines[startLine]!.start,
        sourceEnd: lines[endLine]!.end,
        newlinesBefore: 0,
        lines: quoteLines,
      }
      addBlock(block)
      continue
    }

    const startLine = index
    const paragraphLines: InlineLine[] = []
    while (index < lines.length) {
      const current = lines[index]!
      if (
        BLANK_LINE.test(current.text)
        || FENCE_OPEN.test(current.text)
        || QUOTE_PREFIX.test(current.text)
      ) {
        break
      }
      paragraphLines.push({
        sourceStart: current.start,
        sourceEnd: current.end,
        nodes: parseInlineLine(current.text, current.start),
      })
      index += 1
    }
    const endLine = index - 1
    const block: ParagraphBlock = {
      type: 'paragraph',
      startLine,
      endLine,
      sourceStart: lines[startLine]!.start,
      sourceEnd: lines[endLine]!.end,
      newlinesBefore: 0,
      lines: paragraphLines,
    }
    addBlock(block)
  }

  return { blocks, warnings, lineCount: lines.length }
}

function parsePreBlock(
  lines: readonly LineInfo[],
  openLine: number,
  fence: RegExpExecArray,
  sourceLength: number,
): { block: PreBlock; nextIndex: number } {
  const fenceLength = fence[2]!.length
  const closePattern = new RegExp(`^ {0,3}\`{${fenceLength},}\\s*$`, 'u')
  let closeLine = -1
  for (let index = openLine + 1; index < lines.length; index += 1) {
    if (closePattern.test(lines[index]!.text)) {
      closeLine = index
      break
    }
  }

  const endLine = closeLine === -1 ? lines.length - 1 : closeLine
  const codeLines = closeLine === -1
    ? lines.slice(openLine + 1)
    : lines.slice(openLine + 1, closeLine)
  const code = codeLines.map((line) => line.text).join('\n')
  const contentStart = codeLines.length > 0
    ? codeLines[0]!.start
    : lines[openLine]!.end
  const contentEnd = closeLine === -1 ? sourceLength : lines[closeLine]!.start

  const block: PreBlock = {
    type: 'pre',
    startLine: openLine,
    endLine,
    sourceStart: lines[openLine]!.start,
    sourceEnd: closeLine === -1 ? sourceLength : lines[closeLine]!.end,
    newlinesBefore: 0,
    code,
    language: parseLanguage(fence[3] ?? ''),
    contentStart,
    contentEnd,
    unclosed: closeLine === -1,
  }

  return { block, nextIndex: endLine + 1 }
}

function parseLanguage(info: string): string | null {
  const token = info.trim().split(/\s+/u)[0]
  if (!token) return null
  return /^[A-Za-z0-9_+#.-]+$/u.test(token) ? token : null
}

function splitLines(source: string): LineInfo[] {
  const lines: LineInfo[] = []
  let start = 0
  for (let index = 0; index <= source.length; index += 1) {
    if (index === source.length || source[index] === '\n') {
      lines.push({
        start,
        end: index,
        text: source.slice(start, index),
      })
      start = index + 1
    }
  }
  return lines
}
