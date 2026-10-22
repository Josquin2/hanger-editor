/**
 * Characters that never produce a visible glyph on their own. They are
 * stripped when deciding whether a message is empty, so a message made of
 * zero-width spaces or bidi controls cannot be sent.
 */
// These control and format characters are blank by design.
// eslint-disable-next-line no-control-regex, no-misleading-character-class
const INVISIBLE_CHARACTERS = /[\s\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFE00-\uFE0F\uFEFF]/gu

const WHITESPACE = /\s/u
const WORD_CHARACTER = /[\p{L}\p{N}\p{M}_]/u

/** True when a message has no visible characters at all. */
export function isBlank(value: string): boolean {
  return value.replace(INVISIBLE_CHARACTERS, '') === ''
}

export function isWhitespace(character: string): boolean {
  return character === '' || WHITESPACE.test(character)
}

export function isWordCharacter(character: string): boolean {
  return character !== '' && WORD_CHARACTER.test(character)
}

export function normalizeNewlines(value: string): string {
  return value.replace(/\r\n?/g, '\n')
}
