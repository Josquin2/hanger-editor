import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MAX_LENGTH,
  validateDocument,
  validateMessage,
} from '../src/core/validate'
import { isBlank } from '../src/core/text'
import { parseMessage } from '../src/core/parse'

describe('isBlank', () => {
  it.each([
    '',
    '   ',
    '\n\t\r',
    '\u200B',
    '\uFEFF',
    '\u00AD',
    '\u202E',
    '\u2060',
    '\uFE0F',
  ])('treats %j as blank', (value) => {
    expect(isBlank(value)).toBe(true)
  })

  it.each(['a', '😀', '  a  ', '**a**'])('treats %j as visible', (value) => {
    expect(isBlank(value)).toBe(false)
  })
})

describe('validateMessage', () => {
  it('rejects an empty message', () => {
    const result = validateMessage('')
    expect(result.valid).toBe(false)
    expect(result.isEmpty).toBe(true)
    expect(result.errors).toEqual([
      {
        code: 'EMPTY_MESSAGE',
        message: 'Message must contain at least one visible character.',
      },
    ])
  })

  it('rejects whitespace-only messages', () => {
    expect(validateMessage('   \n\t  ').errors[0]?.code).toBe('EMPTY_MESSAGE')
  })

  it('rejects invisible-only messages', () => {
    expect(validateMessage('\u200B\uFEFF\u2060').errors[0]?.code).toBe('EMPTY_MESSAGE')
  })

  it('accepts a message with markup around visible text', () => {
    const result = validateMessage('**hello**')
    expect(result.valid).toBe(true)
    expect(result.text).toBe('hello')
    expect(result.length).toBe(5)
  })

  it('rejects a link with an empty label', () => {
    const result = validateMessage('[](https://example.com)')
    expect(result.isEmpty).toBe(true)
    expect(result.valid).toBe(false)
  })

  it('allows empty messages when configured', () => {
    const result = validateMessage('   ', { allowEmpty: true })
    expect(result.valid).toBe(true)
    expect(result.isEmpty).toBe(true)
  })

  it('enforces the default maximum length on visible text', () => {
    const accepted = validateMessage('a'.repeat(DEFAULT_MAX_LENGTH))
    expect(accepted.valid).toBe(true)
    expect(accepted.length).toBe(DEFAULT_MAX_LENGTH)

    const rejected = validateMessage('a'.repeat(DEFAULT_MAX_LENGTH + 1))
    expect(rejected.valid).toBe(false)
    expect(rejected.errors[0]).toEqual({
      code: 'TOO_LONG',
      message: 'Message is too long.',
      limit: DEFAULT_MAX_LENGTH,
      actual: DEFAULT_MAX_LENGTH + 1,
    })
  })

  it('counts UTF-16 units, matching Telegram entities', () => {
    const result = validateMessage('😀', { maxLength: 1 })
    expect(result.length).toBe(2)
    expect(result.errors[0]).toMatchObject({ code: 'TOO_LONG', actual: 2 })
  })

  it('supports custom limits and disabling the limit', () => {
    expect(validateMessage('abcdef', { maxLength: 5 }).valid).toBe(false)
    expect(validateMessage('abcdef', { maxLength: null }).valid).toBe(true)
    expect(validateMessage('abcdef', { maxLength: 6 }).valid).toBe(true)
  })

  it('does not count formatting markers', () => {
    const source = `**${'a'.repeat(10)}**`
    const result = validateMessage(source, { maxLength: 10 })
    expect(result.valid).toBe(true)
    expect(result.length).toBe(10)
  })

  it('validates an already parsed document', () => {
    const document = parseMessage('**hello**')
    const result = validateDocument(document, { maxLength: 5 })
    expect(result.valid).toBe(true)
    expect(result.document).toBe(document)
  })
})
