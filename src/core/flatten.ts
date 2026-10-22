import type {
  EntityType,
  InlineNode,
  MessageBlock,
  MessageEntity,
} from './types'

interface FlattenedMessage {
  readonly text: string
  readonly entities: readonly MessageEntity[]
}

const ENTITY_PRIORITY: Record<EntityType, number> = {
  blockquote: 60,
  pre: 60,
  text_link: 50,
  code: 45,
  bold: 40,
  italic: 30,
  underline: 20,
  strikethrough: 10,
  spoiler: 5,
}

export function flattenBlocks(
  blocks: readonly MessageBlock[],
  source: string,
  lineCount: number,
): FlattenedMessage {
  if (blocks.length === 0) {
    return { text: source, entities: [] }
  }

  const entities: MessageEntity[] = []
  let text = ''

  const pushEntity = (
    type: EntityType,
    offset: number,
    length: number,
    extra?: Pick<MessageEntity, 'url' | 'language'>,
  ): void => {
    if (length <= 0) return
    entities.push({
      type,
      offset,
      length,
      ...(extra?.url !== undefined ? { url: extra.url } : {}),
      ...(extra?.language !== undefined ? { language: extra.language } : {}),
    })
  }

  const flattenNodes = (nodes: readonly InlineNode[]): void => {
    for (const node of nodes) {
      if (node.type === 'text') {
        text += node.value
        continue
      }

      if (node.type === 'code') {
        const offset = text.length
        text += node.value
        pushEntity('code', offset, node.value.length)
        continue
      }

      if (node.type === 'link') {
        const offset = text.length
        flattenNodes(node.children)
        pushEntity('text_link', offset, text.length - offset, { url: node.url })
        continue
      }

      const offset = text.length
      flattenNodes(node.children)
      pushEntity(node.type, offset, text.length - offset)
    }
  }

  for (const block of blocks) {
    text += '\n'.repeat(block.newlinesBefore)

    const blockStart = text.length
    if (block.type === 'pre') {
      text += block.code
      pushEntity(
        'pre',
        blockStart,
        block.code.length,
        block.language !== null ? { language: block.language } : undefined,
      )
      continue
    }

    block.lines.forEach((line, index) => {
      if (index > 0) text += '\n'
      flattenNodes(line.nodes)
    })

    if (block.type === 'quote') {
      pushEntity('blockquote', blockStart, text.length - blockStart)
    }
  }

  const lastBlock = blocks[blocks.length - 1]!
  const trailingNewlines = Math.max(0, lineCount - 1 - lastBlock.endLine)
  text += '\n'.repeat(trailingNewlines)

  entities.sort((left, right) => {
    if (left.offset !== right.offset) return left.offset - right.offset
    if (left.length !== right.length) return right.length - left.length
    return ENTITY_PRIORITY[right.type] - ENTITY_PRIORITY[left.type]
  })

  return { text, entities }
}
