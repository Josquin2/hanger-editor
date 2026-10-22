import { describe, expect, it } from 'vitest'
import { parseMessage } from '../src/core/parse'
import { escapeHtml, renderHtml } from '../src/core/render-html'
import { sanitizeUrl } from '../src/core/url'

function render(source: string, options?: Parameters<typeof renderHtml>[1]): string {
  return renderHtml(parseMessage(source), options)
}

describe('renderHtml', () => {
  it('renders inline styles', () => {
    expect(render('**bold** *italic* __underline__ ~~strike~~ ||spoiler||'))
      .toBe(
        '<strong>bold</strong> <em>italic</em> <u>underline</u> '
        + '<s>strike</s> <span class="tg-spoiler">spoiler</span>',
      )
  })

  it('renders line breaks as br by default', () => {
    expect(render('one\ntwo')).toBe('one<br>two')
  })

  it('can wrap paragraphs', () => {
    expect(render('one\ntwo\n\nthree', { wrapParagraphs: true }))
      .toBe('<p>one<br>two</p><p>three</p>')
  })

  it('separates consecutive paragraph blocks in inline mode', () => {
    expect(render('one\n\nthree')).toBe('one<br><br>three')
  })

  it('renders block quotes and code blocks', () => {
    expect(render('> quoted\n> line\n\n```ts\nconst a = 1\n```'))
      .toBe(
        '<blockquote>quoted<br>line</blockquote>'
        + '<br><pre><code class="language-ts">const a = 1</code></pre>',
      )
  })

  it('escapes HTML in text and code', () => {
    expect(render('<script>alert("x")</script>'))
      .toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
    expect(render('```\n<img src=x onerror=alert(1)>\n```'))
      .toBe(
        '<pre><code>&lt;img src=x onerror=alert(1)&gt;</code></pre>',
      )
  })

  it('escapes HTML inside attributes', () => {
    const html = render('[x](https://example.com/?q="quoted")')
    expect(html).toContain('href="https://example.com/?q=&quot;quoted&quot;"')
    expect(html).not.toContain('"quoted"')
  })

  it('renders links with safe attributes', () => {
    expect(render('[Hanger](https://thehanger.ru)'))
      .toBe(
        '<a href="https://thehanger.ru" target="_blank" '
        + 'rel="noopener noreferrer nofollow">Hanger</a>',
      )
  })

  it('supports link attribute options', () => {
    const html = render('[Hanger](https://thehanger.ru)', {
      linkTarget: null,
      linkRel: null,
    })
    expect(html).toBe('<a href="https://thehanger.ru">Hanger</a>')
  })

  it('drops unsafe link protocols but keeps the label', () => {
    expect(render('[click](javascript:alert(1))')).toBe('click')
    expect(render('[click](JaVaScRiPt:alert(1))')).toBe('click')
    expect(render('[click](data:text/html;base64,PHNjcmlwdD4=)')).toBe('click')
    expect(render('[click](//evil.example)')).toBe('click')
  })

  it('supports custom allowed schemes', () => {
    const source = '[open](hanger://channel/1)'
    expect(render(source)).toBe('open')
    expect(render(source, { allowedSchemes: ['hanger'] }))
      .toBe(
        '<a href="hanger://channel/1" target="_blank" '
        + 'rel="noopener noreferrer nofollow">open</a>',
      )
  })

  it('supports relative links when explicitly enabled', () => {
    expect(render('[one](/channels/1)')).toBe('one')
    expect(render('[one](/channels/1)', { allowRelativeLinks: true }))
      .toBe(
        '<a href="/channels/1" target="_blank" '
        + 'rel="noopener noreferrer nofollow">one</a>',
      )
  })

  it('does not allow protocol-relative URLs even with relative links enabled', () => {
    expect(render('[one](//evil.example)', { allowRelativeLinks: true })).toBe('one')
  })

  it('supports custom spoiler classes and removing the class', () => {
    expect(render('||secret||', { spoilerClass: 'spoiler' }))
      .toBe('<span class="spoiler">secret</span>')
    expect(render('||secret||', { spoilerClass: null }))
      .toBe('<span>secret</span>')
  })

  it('supports a configurable language class', () => {
    expect(render('```ts\nx\n```', { languageClassPrefix: 'lang-' }))
      .toBe('<pre><code class="lang-ts">x</code></pre>')
    expect(render('```ts\nx\n```', { languageClassPrefix: null }))
      .toBe('<pre><code>x</code></pre>')
    expect(render('```ts\nx\n```', { languageClassPrefix: '' }))
      .toBe('<pre><code>x</code></pre>')
  })

  it('renders formatted link labels', () => {
    expect(render('[**bold**](https://example.com)'))
      .toBe(
        '<a href="https://example.com" target="_blank" '
        + 'rel="noopener noreferrer nofollow"><strong>bold</strong></a>',
      )
  })

  it('ignores leading and trailing blank lines in HTML', () => {
    expect(render('\n\nhello\n\n')).toBe('hello')
  })

  it('returns an empty string for whitespace-only input', () => {
    expect(render('   \n  ')).toBe('')
  })
})

describe('escapeHtml', () => {
  it('escapes all HTML-sensitive characters', () => {
    expect(escapeHtml("&<>\"'")).toBe('&amp;&lt;&gt;&quot;&#39;')
  })
})

describe('sanitizeUrl', () => {
  it('accepts safe absolute URLs', () => {
    expect(sanitizeUrl('https://example.com/a?b=c#d')).toBe('https://example.com/a?b=c#d')
    expect(sanitizeUrl('HTTP://example.com')).toBe('HTTP://example.com')
    expect(sanitizeUrl('mailto:hi@example.com')).toBe('mailto:hi@example.com')
    expect(sanitizeUrl('tg://user?id=1')).toBe('tg://user?id=1')
  })

  it('rejects unsafe and malformed URLs', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull()
    expect(sanitizeUrl('vbscript:msgbox(1)')).toBeNull()
    expect(sanitizeUrl('data:text/html,hi')).toBeNull()
    expect(sanitizeUrl('java\nscript:alert(1)')).toBeNull()
    expect(sanitizeUrl('https://example.com/\\evil')).toBeNull()
    expect(sanitizeUrl('   ')).toBeNull()
    expect(sanitizeUrl('example.com')).toBeNull()
  })

  it('allows relative URLs only when configured', () => {
    expect(sanitizeUrl('/channels/1', { allowRelativeLinks: false })).toBeNull()
    expect(sanitizeUrl('/channels/1', { allowRelativeLinks: true })).toBe('/channels/1')
    expect(sanitizeUrl('//evil.example', { allowRelativeLinks: true })).toBeNull()
  })
})
