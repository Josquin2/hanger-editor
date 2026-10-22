# Hanger markdown grammar

This is the dialect understood by `parseMessage` and produced by the editor.
It is intentionally smaller than CommonMark: a chat message is not a document.
The syntax is close to Discord with a few Telegram habits (`_italic_`,
`> quotes`, fenced code languages).

Everything is parsed synchronously and all offsets are UTF-16 code units.

## Blocks

A message is split into lines on `\n` (CRLF and CR are normalised first). Blank
lines separate blocks; leading and trailing newlines are preserved in
`doc.text` but ignored by the HTML renderer.

### Paragraph

Any run of non-blank lines that is not a quote or a fenced block. The original
line breaks are preserved and render as `<br>`. Inline formatting is parsed on
each line independently.

```text
first line
second with **bold**
```

### Block quote

A quote is one or more consecutive lines starting with 0–3 spaces, `>`, and an
optional single space:

```text
> quoted
> still quoted
not quoted
```

The `>` prefix is removed from the visible text. A quote cannot span a blank
line; a later `>` line starts a new quote block. Quotes are one level deep —
`>>` is visible text.

### Fenced code block

A fenced block starts with a line containing 0–3 spaces, at least three
backticks, and an optional language info string:

````text
```ts
const a = 1
```
````

- The closing fence must have at least as many backticks as the opening fence.
- Everything between the fences is literal: inline markup is not parsed.
- The language is the first info-string token, limited to
  `[A-Za-z0-9_+#.-]+`; other info is ignored.
- An unclosed fence runs to the end of the message and produces an
  `UNCLOSED_CODE_BLOCK` warning.
- A fence produced by the editor is lengthened when the selected content itself
  contains backticks.

## Inline formatting

| Name | Marker | HTML |
| --- | --- | --- |
| bold | `**text**` | `<strong>` |
| italic | `*text*` or `_text_` | `<em>` |
| underline | `__text__` | `<u>` |
| strikethrough | `~~text~~` | `<s>` |
| spoiler | `\|\|text\|\|` | `<span class="tg-spoiler">` (configurable) |
| inline code | `` `text` `` | `<code>` |
| link | `[text](url)` | `<a>` if the URL is safe |

### Where markers may start and end

A closing or opening marker must touch a non-whitespace character:

```text
**bold**        formats
** bold **      stays literal
|| secret ||    stays literal
||secret||      formats
```

For `_` markers, underscore runs that sit inside a word are literal:

```text
snake_case_name          no formatting
_italic_                 italic
__underline__            underline
snake__case__name        no formatting
```

This keeps identifiers and file names readable while allowing underscore
italics at word boundaries.

### Runs and nesting

- A double marker is bold/underline; a single marker is italic.
- A run of `***` opens bold then italic, so `***both***` produces
  `<strong><em>both</em></strong>`.
- Different styles nest: `**a *b* c**`.
- The same style does not nest meaningfully; the parser pairs the nearest
  matching markers and leaves crossing or unmatched markers literal.
- Markers are paired in one pass, so malformed input never throws and never
  disappears: unmatched markers are shown as text.
- Inline formatting is **line-scoped**. A marker opened on one line is never
  closed by a marker on another line. The editor works around this by applying
  inline commands to each selected line.

### Inline code

Inline code is a run of one or more backticks closed by a run of exactly the
same length:

```text
`code * literal *`
``a ` b``           -> a ` b
```

Backslashes inside code spans are literal. An unmatched backtick run is text.

### Links

```text
[Hanger](https://thehanger.ru)
[**bold label**](https://example.com)
[a](https://example.com/a_(b))
[a\]b](https://example.com)
```

- The label may contain inline styles.
- The label may contain nested square brackets; it may not contain another link.
- The URL may contain balanced parentheses and backslash-escaped parentheses.
- A malformed link (`[a](url` with no close) stays literal.
- Links are line-scoped.
- URL rendering is allow-list based; see the security notes below.

### Escapes

A backslash before an ASCII punctuation character removes that character's
syntax meaning:

```text
\*literal\*      -> *literal*
\_not italic\_  -> _not italic_
\\              -> \
\a              -> \a (backslash kept)
```

### Block quotes and inline formatting

Inline formatting works inside quote lines:

```text
> **bold** quote
```

The whole quote line range also gets a `blockquote` entity.

## Entities

The flattened `doc.text` plus `doc.entities` is a Telegram-compatible view of
the message. Offsets and lengths are UTF-16 code units.

| Entity | Covers |
| --- | --- |
| `bold`, `italic`, `underline`, `strikethrough`, `spoiler` | the visible styled text |
| `code` | the visible inline-code text |
| `pre` | the code block text, optionally with `language` |
| `blockquote` | all visible quote lines, including internal newlines |
| `text_link` | the visible link label, with `url` |

Nested styles produce nested entity ranges. Entities are sorted by offset, then
longest first, then by a stable type priority. Formatting markers are not part
of `doc.text` and are not counted by validation.

## HTML rendering

- Text and attribute values are HTML-escaped.
- Paragraph/default mode joins paragraph lines with `<br>` and uses
  `<blockquote>` / `<pre><code>` for blocks.
- `wrapParagraphs: true` uses `<p>` for paragraph blocks instead.
- Links get `target="_blank"` and `rel="noopener noreferrer nofollow"` unless
  overridden.
- `code` blocks get `class="language-<lang>"` unless the prefix is disabled.

## URL policy

A URL is rendered as a link only when it:

- has a scheme in `allowedSchemes` (default `http`, `https`, `mailto`, `tg`), or
  is relative when `allowRelativeLinks` is enabled;
- contains no ASCII control characters or whitespace;
- contains no backslashes;
- is not protocol-relative (`//host/...`).

Anything else is rendered as its label without an `<a>`.

## Deliberate non-goals

These are not supported, and should not be assumed by callers:

- headings, lists, tables, task lists;
- images or custom emoji entities;
- autolinking bare URLs;
- nested links;
- multiline inline entities;
- Telegram Bot API MarkdownV2 escaping rules (`__italic__` means underline here);
- HTML input. HTML is never parsed; it is escaped as text.

## Examples

````text
**Bold**, *italic*, __underline__, ~~strike~~, ||spoiler||
> quoted **text**
> second line

```ts
const answer = 42
```

[the hanger](https://thehanger.ru) and \*literal\*
````

Rendered (abbreviated):

```html
<strong>Bold</strong>, <em>italic</em>, <u>underline</u>,
<s>strike</s>, <span class="tg-spoiler">spoiler</span>
<blockquote>quoted <strong>text</strong><br>second line</blockquote>
<pre><code class="language-ts">const answer = 42</code></pre>
<a href="https://thehanger.ru" target="_blank"
   rel="noopener noreferrer nofollow">the hanger</a> and *literal*
```
