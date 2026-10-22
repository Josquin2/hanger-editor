import { describe, expect, it } from 'vitest'
import { parseMessage } from '../src/core/parse'
import { renderHtml } from '../src/core/render-html'
import type { InlineNode, MessageBlock, ParsedMessage } from '../src/core/types'

const FRAGMENTS = [
  'hello',
  ' ',
  '\n',
  '\n\n',
  '**',
  '*',
  '_',
  '__',
  '~~',
  '||',
  '`',
  '```',
  '> ',
  '[a](https://example.com)',
  '[**b**](tg://user?id=1)',
  '😀',
  '\\*',
  '\\[',
  'snake_case',
  '```ts\ncode\n```',
]

const SOURCES = [
  '',
  '   ',
  '**bold**',
  '*italic*',
  '~~strike~~',
  '||spoiler||',
  '`code`',
  '> quote\n> next',
  '```\ncode\n```',
  '[label](https://example.com)',
  '**a *b* c**',
  '*a **b** c*',
  '***both***',
  '**_both_**',
  '\\**escaped\\**',
  'hello\n\nworld',
  '> one\n\n> two',
  '```js\nconst a = 1\n```\nafter',
  'before\n```js\nconst a = 1\n```',
  '\n\nhello\n\n',
  'snake__case__name',
  '**😀** [x](https://example.com/a_(b))',
  '[](https://example.com)',
  '****',
  '**\u200B**',
]

// Deterministic pseudo-random corpus using an LCG, so failures are repeatable.
function buildCorpus(): string[] {
  let seed = 123456789
  const next = (): number => {
    seed = (1103515245 * seed + 12345) % 2147483648
    return seed
  }
  for (let index = 0; index < 200; index += 1) {
    let source = ''
    const parts = 1 + (next() % 12)
    for (let part = 0; part < parts; part += 1) {
      source += FRAGMENTS[next() % FRAGMENTS.length]
    }
    SOURCES.push(source)
  }
  return SOURCES
}

function assertInlineNodes(
  nodes: readonly InlineNode[],
  sourceLength: number,
  context: string,
): void {
  for (const node of nodes) {
    expect(node.sourceStart, context).toBeGreaterThanOrEqual(0)
    expect(node.sourceEnd, context).toBeLessThanOrEqual(sourceLength)
    expect(node.sourceStart, context).toBeLessThanOrEqual(node.sourceEnd)

    if (node.type === 'text') {
      expect(node.value.length, context).toBeGreaterThan(0)
    }
    else if (node.type === 'code') {
      expect(node.contentStart, context).toBeLessThanOrEqual(node.contentEnd)
      expect(node.contentStart, context).toBeGreaterThanOrEqual(node.sourceStart)
      expect(node.contentEnd, context).toBeLessThanOrEqual(node.sourceEnd)
    }
    else if (node.type === 'link') {
      expect(node.contentStart, context).toBeLessThanOrEqual(node.contentEnd)
      assertInlineNodes(node.children, sourceLength, context)
    }
    else {
      expect(node.contentStart, context).toBeLessThanOrEqual(node.contentEnd)
      expect(node.contentStart, context).toBeGreaterThanOrEqual(node.sourceStart)
      expect(node.contentEnd, context).toBeLessThanOrEqual(node.sourceEnd)
      assertInlineNodes(node.children, sourceLength, context)
    }
  }
}

function assertBlock(block: MessageBlock, document: ParsedMessage): void {
  const context = `block ${block.type} in ${JSON.stringify(document.source)}`
  expect(block.startLine, context).toBeLessThanOrEqual(block.endLine)
  expect(block.sourceStart, context).toBeGreaterThanOrEqual(0)
  expect(block.sourceEnd, context).toBeLessThanOrEqual(document.source.length)
  expect(block.sourceStart, context).toBeLessThanOrEqual(block.sourceEnd)
  expect(block.newlinesBefore, context).toBeGreaterThanOrEqual(0)

  if (block.type === 'pre') {
    expect(block.contentStart, context).toBeLessThanOrEqual(block.contentEnd)
    expect(block.contentEnd, context).toBeLessThanOrEqual(block.sourceEnd)
    return
  }

  for (const line of block.lines) {
    assertInlineNodes(line.nodes, document.source.length, context)
  }
}

describe('parser invariants', () => {
  it('keeps all offsets and entities inside the message', () => {
    for (const source of buildCorpus()) {
      const document = parseMessage(source)
      const context = JSON.stringify(source)

      expect(document.source, context).toBe(source.replace(/\r\n?/g, '\n'))

      let previousOffset = -1
      for (const entity of document.entities) {
        expect(entity.offset, context).toBeGreaterThanOrEqual(0)
        expect(entity.length, context).toBeGreaterThan(0)
        expect(entity.offset + entity.length, context).toBeLessThanOrEqual(
          document.text.length,
        )
        expect(entity.offset, context).toBeGreaterThanOrEqual(previousOffset)
        previousOffset = entity.offset
      }

      for (const block of document.blocks) assertBlock(block, document)

      expect(() => renderHtml(document)).not.toThrow()
    }
  })

  it('survives pathological marker runs', () => {
    const sources = [
      '*'.repeat(500),
      '_'.repeat(500),
      '~'.repeat(500),
      '|'.repeat(500),
      '**a'.repeat(500),
      '```\n'.repeat(100),
      '['.repeat(5000),
      '[a'.repeat(5000),
      '('.repeat(5000),
      '`'.repeat(5000),
      '> '.repeat(500),
    ]

    for (const source of sources) {
      const startedAt = performance.now()
      const document = parseMessage(source)
      renderHtml(document)
      expect(performance.now() - startedAt).toBeLessThan(2000)
    }
  })
})
