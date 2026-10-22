import type { InlineStyle } from './types'

/** Matches a block-quote line prefix, including up to three spaces of indent. */
export const QUOTE_PREFIX = /^ {0,3}> ?/

export const STYLE_MARKERS = {
  bold: '**',
  italic: '*',
  underline: '__',
  strikethrough: '~~',
  spoiler: '||',
} as const satisfies Record<InlineStyle, string>
