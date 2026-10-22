import type { ParsedMessage } from './types'
import { normalizeNewlines } from './text'
import { parseBlocks } from './blocks'
import { flattenBlocks } from './flatten'

/**
 * Parses a chat message written in Hanger markdown.
 *
 * The parser is synchronous, dependency-free and safe to run on the server.
 * All offsets are UTF-16 code units.
 */
export function parseMessage(source: string): ParsedMessage {
  const normalizedSource = normalizeNewlines(source)
  const { blocks, warnings, lineCount } = parseBlocks(normalizedSource)
  const { text, entities } = flattenBlocks(blocks, normalizedSource, lineCount)

  return {
    source: normalizedSource,
    text,
    entities,
    blocks,
    warnings,
  }
}

/** Visible text with all markdown markers removed. */
export function toPlainText(source: string): string {
  return parseMessage(source).text
}
