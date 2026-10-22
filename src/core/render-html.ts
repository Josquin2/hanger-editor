import type { InlineNode, MessageBlock, ParsedMessage } from './types'
import { sanitizeUrl, type UrlPolicy } from './url'

export interface HtmlRenderOptions extends UrlPolicy {
  /**
   * Wrap paragraphs in `<p>`. When false (the default), the output is a
   * chat-friendly fragment where line breaks are `<br>`.
   */
  readonly wrapParagraphs?: boolean
  /** Class used for spoilers. `null` removes the class attribute. */
  readonly spoilerClass?: string | null
  /** `target` applied to links. `null` omits the attribute. */
  readonly linkTarget?: string | null
  /** `rel` applied to links. `null` omits the attribute. */
  readonly linkRel?: string | null
  /** Prefix for the language class on code blocks. Default: `language-`. */
  readonly languageClassPrefix?: string | null
}

/**
 * Renders a parsed message to HTML.
 *
 * Every text node and attribute is escaped, and link URLs go through
 * `sanitizeUrl`, so the result is safe to pass to `v-html` or
 * `dangerouslySetInnerHTML`.
 */
export function renderHtml(
  document: ParsedMessage,
  options: HtmlRenderOptions = {},
): string {
  if (document.blocks.length === 0) return ''

  const wrapParagraphs = options.wrapParagraphs === true
  let html = ''

  document.blocks.forEach((block, index) => {
    if (!wrapParagraphs && index > 0) {
      const previous = document.blocks[index - 1]!
      html += renderSeparator(previous, block)
    }
    html += renderBlock(block, options)
  })

  return html
}

/** Escapes text for use in HTML text nodes and quoted attributes. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => {
    switch (character) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      case "'":
        return '&#39;'
      default:
        return character
    }
  })
}

function renderSeparator(previous: MessageBlock, current: MessageBlock): string {
  const bothParagraphs = previous.type === 'paragraph' && current.type === 'paragraph'
  const count = bothParagraphs
    ? current.newlinesBefore
    : Math.max(0, current.newlinesBefore - 1)
  return '<br>'.repeat(count)
}

function renderBlock(block: MessageBlock, options: HtmlRenderOptions): string {
  if (block.type === 'pre') {
    const languageClass = renderLanguageClass(block.language, options)
    return `<pre><code${languageClass}>${escapeHtml(block.code)}</code></pre>`
  }

  const content = block.lines
    .map((line) => renderLine(line.nodes, options))
    .join('<br>')

  if (block.type === 'quote') {
    return `<blockquote>${content}</blockquote>`
  }
  return options.wrapParagraphs === true ? `<p>${content}</p>` : content
}

function renderLine(
  nodes: readonly InlineNode[],
  options: HtmlRenderOptions,
): string {
  return nodes.map((node) => renderNode(node, options)).join('')
}

function renderNode(node: InlineNode, options: HtmlRenderOptions): string {
  switch (node.type) {
    case 'text':
      return escapeHtml(node.value)
    case 'code':
      return `<code>${escapeHtml(node.value)}</code>`
    case 'bold':
      return `<strong>${renderChildren(node.children, options)}</strong>`
    case 'italic':
      return `<em>${renderChildren(node.children, options)}</em>`
    case 'underline':
      return `<u>${renderChildren(node.children, options)}</u>`
    case 'strikethrough':
      return `<s>${renderChildren(node.children, options)}</s>`
    case 'spoiler':
      return renderSpoiler(node.children, options)
    case 'link':
      return renderLink(node, options)
  }
}

function renderChildren(
  children: readonly InlineNode[],
  options: HtmlRenderOptions,
): string {
  return children.map((child) => renderNode(child, options)).join('')
}

function renderSpoiler(
  children: readonly InlineNode[],
  options: HtmlRenderOptions,
): string {
  const className = options.spoilerClass === undefined
    ? 'tg-spoiler'
    : options.spoilerClass
  const classAttribute = className ? ` class="${escapeHtml(className)}"` : ''
  return `<span${classAttribute}>${renderChildren(children, options)}</span>`
}

function renderLink(
  node: Extract<InlineNode, { type: 'link' }>,
  options: HtmlRenderOptions,
): string {
  const href = sanitizeUrl(node.url, options)
  if (!href) return renderChildren(node.children, options)

  const target = options.linkTarget === undefined ? '_blank' : options.linkTarget
  const rel = options.linkRel === undefined
    ? 'noopener noreferrer nofollow'
    : options.linkRel
  const targetAttribute = target ? ` target="${escapeHtml(target)}"` : ''
  const relAttribute = rel ? ` rel="${escapeHtml(rel)}"` : ''

  return `<a href="${escapeHtml(href)}"${targetAttribute}${relAttribute}>${
    renderChildren(node.children, options)
  }</a>`
}

function renderLanguageClass(
  language: string | null,
  options: HtmlRenderOptions,
): string {
  if (!language) return ''
  const prefix = options.languageClassPrefix === undefined
    ? 'language-'
    : options.languageClassPrefix
  if (!prefix) return ''
  return ` class="${escapeHtml(`${prefix}${language}`)}"`
}
