export interface TextEdit {
  readonly start: number
  readonly end: number
  readonly replacement: string
}

export interface Range {
  readonly start: number
  readonly end: number
}

export function clampRange(range: Range, length: number): Range {
  const start = Math.max(0, Math.min(range.start, length))
  const end = Math.max(start, Math.min(range.end, length))
  return { start, end }
}

/** Applies non-overlapping edits to a string. */
export function applyEdits(value: string, edits: readonly TextEdit[]): string {
  if (edits.length === 0) return value
  const sorted = [...edits].sort((left, right) => {
    return left.start - right.start || left.end - right.end
  })

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]!
    const current = sorted[index]!
    if (current.start < previous.end) {
      throw new Error('hanger-editor: overlapping edits')
    }
  }

  let result = value
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const edit = sorted[index]!
    result = result.slice(0, edit.start) + edit.replacement + result.slice(edit.end)
  }
  return result
}

/**
 * Maps a selection through edits made to an older copy of the value.
 *
 * Start positions move after an insertion at the same offset so a caret does
 * not get stuck before an inserted quote prefix. End positions stay put when
 * an insertion happens exactly at the end, so the selection does not grow to
 * include text inserted after it.
 */
export function mapRange(range: Range, edits: readonly TextEdit[]): Range {
  const collapsed = range.start === range.end
  const sorted = [...edits].sort((left, right) => {
    return left.start - right.start || left.end - right.end
  })

  const mapPosition = (position: number, isStart: boolean): number => {
    let delta = 0
    for (const edit of sorted) {
      if (edit.start === edit.end) {
        if (position < edit.start) break
        if (position > edit.start || (position === edit.start && isStart)) {
          delta += edit.replacement.length
        }
        continue
      }

      if (position < edit.start) break
      if (position >= edit.end) {
        delta += edit.replacement.length - (edit.end - edit.start)
        continue
      }
      return edit.start + delta
    }
    return position + delta
  }

  const start = mapPosition(range.start, true)
  const end = collapsed ? start : mapPosition(range.end, false)
  return { start, end: Math.max(start, end) }
}

export function lineStartAt(value: string, position: number): number {
  if (position <= 0) return 0
  return value.lastIndexOf('\n', position - 1) + 1
}

export function lineEndAt(value: string, position: number): number {
  const newline = value.indexOf('\n', Math.max(0, position))
  return newline === -1 ? value.length : newline
}

/** Expands a selection so it covers whole lines. */
export function expandToLines(value: string, range: Range): Range {
  const start = lineStartAt(value, range.start)
  const probe = range.end > range.start ? range.end - 1 : range.end
  const lastLineStart = lineStartAt(value, probe)
  return { start, end: lineEndAt(value, lastLineStart) }
}

export interface LineSlice {
  readonly start: number
  readonly end: number
  readonly text: string
}

/** Splits a line-aligned range into individual lines. */
export function linesInRange(value: string, range: Range): LineSlice[] {
  const lines: LineSlice[] = []
  let start = range.start

  while (start <= range.end) {
    const newline = value.indexOf('\n', start)
    const lineEnd = newline === -1 ? value.length : Math.min(newline, range.end)
    lines.push({ start, end: lineEnd, text: value.slice(start, lineEnd) })
    if (newline === -1 || newline >= range.end) break
    start = newline + 1
  }

  return lines
}

const WHITESPACE = /\s/u

/** Trims whitespace from a selection without touching the value. */
export function trimRange(value: string, range: Range): Range {
  let start = range.start
  let end = range.end
  while (start < end && WHITESPACE.test(value[start]!)) start += 1
  while (end > start && WHITESPACE.test(value[end - 1]!)) end -= 1
  return { start, end }
}
