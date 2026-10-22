import { describe, expect, it } from 'vitest'
import { parseMessage } from '../src/core/parse'
import type { InlineNode, ParsedMessage } from '../src/core/types'

function entityTypes(document: ParsedMessage): string[] {
  return document.entities.map((entity) => entity.type)
}

function firstParagraphNodes(document: ParsedMessage): readonly InlineNode[] {
  const block = document.blocks[0]
  if (!block || block.type === 'pre') throw new Error('Expected a text block')
  return block.lines[0]?.nodes ?? []
}

describe('parseMessage', () => {
  it('parses plain text', () => {
    const document = parseMessage('hello world')
    expect(document.text).toBe('hello world')
    expect(document.entities).toEqual([])
    expect(document.blocks).toHaveLength(1)
    expect(document.blocks[0]?.type).toBe('paragraph')
  })

  it('keeps line structure and blank lines visible', () => {
    const document = parseMessage('first\nsecond\n\nthird')
    expect(document.text).toBe('first\nsecond\n\nthird')
    expect(document.blocks).toHaveLength(2)
  })

  it('preserves leading and trailing newlines in the visible text', () => {
    expect(parseMessage('\n\nhello\n\n').text).toBe('\n\nhello\n\n')
  })

  it('normalises CRLF and CR to LF', () => {
    const document = parseMessage('a\r\nb\rc')
    expect(document.source).toBe('a\nb\nc')
    expect(document.text).toBe('a\nb\nc')
  })

  describe('inline styles', () => {
    it('parses bold', () => {
      const document = parseMessage('Hello **world**!')
      expect(document.text).toBe('Hello world!')
      expect(document.entities).toEqual([
        { type: 'bold', offset: 6, length: 5 },
      ])
    })

    it('parses italic with asterisks and underscores', () => {
      const document = parseMessage('*one* __two__ _three_')
      expect(document.text).toBe('one two three')
      expect(document.entities).toEqual([
        { type: 'italic', offset: 0, length: 3 },
        { type: 'underline', offset: 4, length: 3 },
        { type: 'italic', offset: 8, length: 5 },
      ])
    })

    it('parses strikethrough and spoilers', () => {
      const document = parseMessage('~~gone~~ ||secret||')
      expect(document.text).toBe('gone secret')
      expect(document.entities).toEqual([
        { type: 'strikethrough', offset: 0, length: 4 },
        { type: 'spoiler', offset: 5, length: 6 },
      ])
    })

    it('nests different inline styles', () => {
      const document = parseMessage('**bold *and italic* end**')
      expect(document.text).toBe('bold and italic end')
      expect(document.entities).toEqual([
        { type: 'bold', offset: 0, length: 19 },
        { type: 'italic', offset: 5, length: 10 },
      ])
    })

    it('parses a tripled marker as bold plus italic', () => {
      const document = parseMessage('***both***')
      expect(document.text).toBe('both')
      expect(document.entities).toEqual([
        { type: 'bold', offset: 0, length: 4 },
        { type: 'italic', offset: 0, length: 4 },
      ])
    })

    it('nests styles that are opened back to back', () => {
      const document = parseMessage('**_both_**')
      expect(document.text).toBe('both')
      expect(document.entities).toEqual([
        { type: 'bold', offset: 0, length: 4 },
        { type: 'italic', offset: 0, length: 4 },
      ])
    })

    it('leaves unmatched markers literal', () => {
      const document = parseMessage('**not bold')
      expect(document.text).toBe('**not bold')
      expect(document.entities).toEqual([])
    })

    it('leaves lone marker characters literal', () => {
      expect(parseMessage('a * b _ c ~ d | e').text).toBe('a * b _ c ~ d | e')
      expect(parseMessage('a * b _ c ~ d | e').entities).toEqual([])
    })

    it('does not open markers inside snake_case words', () => {
      const document = parseMessage('snake_case_name and snake__case__name')
      expect(document.text).toBe('snake_case_name and snake__case__name')
      expect(document.entities).toEqual([])
    })

    it('formats underscore markers at word boundaries', () => {
      const document = parseMessage('_italic_ and __underline__')
      expect(document.text).toBe('italic and underline')
      expect(document.entities).toEqual([
        { type: 'italic', offset: 0, length: 6 },
        { type: 'underline', offset: 11, length: 9 },
      ])
    })

    it('supports escaped markers', () => {
      const document = parseMessage('\\*not italic\\* \\_\\_not underline\\_\\_')
      expect(document.text).toBe('*not italic* __not underline__')
      expect(document.entities).toEqual([])
    })

    it('keeps a backslash before non-punctuation literal', () => {
      expect(parseMessage('C:\\Users\\name').text).toBe('C:\\Users\\name')
    })

    it('does not format across lines', () => {
      const document = parseMessage('**first\nsecond**')
      expect(document.text).toBe('**first\nsecond**')
      expect(document.entities).toEqual([])
    })

    it('counts UTF-16 offsets for emoji', () => {
      const document = parseMessage('**😀**')
      expect(document.text).toBe('😀')
      expect(document.entities).toEqual([
        { type: 'bold', offset: 0, length: 2 },
      ])
    })

    it('records source ranges for editor commands', () => {
      const document = parseMessage('Hi **x**')
      const nodes = firstParagraphNodes(document)
      const bold = nodes[1]
      expect(bold).toMatchObject({
        type: 'bold',
        sourceStart: 3,
        sourceEnd: 8,
        contentStart: 5,
        contentEnd: 6,
      })
    })
  })

  describe('code', () => {
    it('parses inline code and ignores markers inside it', () => {
      const document = parseMessage('use `a * b` here')
      expect(document.text).toBe('use a * b here')
      expect(document.entities).toEqual([
        { type: 'code', offset: 4, length: 5 },
      ])
    })

    it('supports multi-backtick code spans', () => {
      const document = parseMessage('``a ` b``')
      expect(document.text).toBe('a ` b')
      expect(document.entities).toEqual([
        { type: 'code', offset: 0, length: 5 },
      ])
    })

    it('leaves an unclosed backtick literal', () => {
      expect(parseMessage('`oops').text).toBe('`oops')
    })

    it('parses fenced code blocks with a language', () => {
      const document = parseMessage('```ts\nconst a = 1\n```')
      expect(document.text).toBe('const a = 1')
      expect(document.entities).toEqual([
        { type: 'pre', offset: 0, length: 11, language: 'ts' },
      ])
      expect(document.blocks[0]?.type).toBe('pre')
      expect(document.warnings).toEqual([])
    })

    it('keeps marker characters literal inside a code block', () => {
      const document = parseMessage('```\n**not bold**\n```')
      expect(document.text).toBe('**not bold**')
      expect(document.entities).toEqual([
        { type: 'pre', offset: 0, length: 12 },
      ])
    })

    it('reports an unclosed code block', () => {
      const document = parseMessage('```\nconst a = 1')
      expect(document.blocks[0]?.type).toBe('pre')
      expect(document.text).toBe('const a = 1')
      expect(document.warnings).toEqual([
        {
          code: 'UNCLOSED_CODE_BLOCK',
          message: 'Code block has no closing fence.',
          line: 1,
        },
      ])
    })

    it('accepts a longer closing fence', () => {
      const document = parseMessage('```\ncode\n````')
      expect(document.text).toBe('code')
      expect(document.warnings).toEqual([])
    })
  })

  describe('links', () => {
    it('parses labelled links', () => {
      const document = parseMessage('see [Hanger](https://thehanger.ru) now')
      expect(document.text).toBe('see Hanger now')
      expect(document.entities).toEqual([
        {
          type: 'text_link',
          offset: 4,
          length: 6,
          url: 'https://thehanger.ru',
        },
      ])
    })

    it('allows formatting inside a link label', () => {
      const document = parseMessage('[**bold**](https://example.com)')
      expect(document.text).toBe('bold')
      expect(entityTypes(document)).toEqual(['text_link', 'bold'])
    })

    it('allows parentheses and escaped parentheses in URLs', () => {
      const document = parseMessage('[a](https://example.com/a_(b))')
      expect(document.entities[0]).toMatchObject({
        type: 'text_link',
        url: 'https://example.com/a_(b)',
      })
    })

    it('leaves malformed links literal', () => {
      const source = '[a](https://example.com'
      const document = parseMessage(source)
      expect(document.text).toBe(source)
      expect(document.entities).toEqual([])
    })

    it('does not parse a nested link inside a label', () => {
      const document = parseMessage('[outer [inner](https://a) text](https://b)')
      expect(document.text).toBe('outer [inner](https://a) text')
      expect(document.entities).toEqual([
        {
          type: 'text_link',
          offset: 0,
          length: 29,
          url: 'https://b',
        },
      ])
    })
  })

  describe('block quotes', () => {
    it('groups adjacent quoted lines', () => {
      const document = parseMessage('> one\n> two\nthree')
      expect(document.text).toBe('one\ntwo\nthree')
      expect(document.blocks.map((block) => block.type)).toEqual([
        'quote',
        'paragraph',
      ])
      expect(document.entities).toEqual([
        { type: 'blockquote', offset: 0, length: 7 },
      ])
    })

    it('formats inline markup inside quotes', () => {
      const document = parseMessage('> **bold** quote')
      expect(document.text).toBe('bold quote')
      expect(entityTypes(document)).toEqual(['blockquote', 'bold'])
      expect(document.entities[1]).toMatchObject({ offset: 0, length: 4 })
    })

    it('does not treat an escaped > as a quote', () => {
      const document = parseMessage('\\> not a quote')
      expect(document.blocks[0]?.type).toBe('paragraph')
      expect(document.text).toBe('> not a quote')
    })

    it('ends a quote at a blank line', () => {
      const document = parseMessage('> one\n\n> two')
      expect(document.blocks.map((block) => block.type)).toEqual([
        'quote',
        'quote',
      ])
      expect(document.text).toBe('one\n\ntwo')
    })
  })

  it('separates blocks with the number of source newlines', () => {
    const document = parseMessage('a\n\n\nb')
    expect(document.text).toBe('a\n\n\nb')
  })

  it('keeps empty quote lines', () => {
    const document = parseMessage('> a\n>\n> b')
    expect(document.text).toBe('a\n\nb')
    expect(document.entities).toEqual([
      { type: 'blockquote', offset: 0, length: 4 },
    ])
  })

  it('returns the source for whitespace-only input', () => {
    const document = parseMessage('   \n  ')
    expect(document.blocks).toHaveLength(0)
    expect(document.text).toBe('   \n  ')
  })
})
