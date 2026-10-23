# Syntax

The dialect is intentionally small and chat-shaped, close to Discord with a few
Telegram habits. The parser is synchronous and returns every offset in UTF-16
code units.

## Blocks

A message is split on `\n` (CRLF and CR are normalised first). Blank lines
separate blocks.

### Paragraph

Any run of non-blank lines that is not a quote or fenced block. Line breaks are
preserved and render as `<br>`. Inline formatting is parsed per line.

### Block quote

One or more consecutive lines starting with 0–3 spaces, `>`, and one optional
space:

```text
> quoted
> still quoted
not quoted
```

The prefix is removed from the visible text. A blank line ends the quote.
Quotes are one level deep; `>>` is literal text.

### Fenced code block

Starts with 0–3 spaces, at least three backticks, and an optional language:

````text
```ts
const a = 1
```
````

- The closing fence must be at least as long as the opening fence.
- Content is literal; inline markup is not parsed.
- The language is the first info-string token, limited to `[A-Za-z0-9_+#.-]+`.
- An unclosed fence runs to EOF and produces an `UNCLOSED_CODE_BLOCK` warning.

## Inline formatting

| Style | Marker | HTML |
| --- | --- | --- |
| bold | `**text**` | `<strong>` |
| italic | `*text*` or `_text_` | `<em>` |
| underline | `__text__` | `<u>` |
| strikethrough | `~~text~~` | `<s>` |
| spoiler | `\|\|text\|\|` | `<span class="tg-spoiler">` |
| code | `` `text` `` | `<code>` |
| link | `[text](url)` | `<a>` when the URL is safe |

### Flanking rules

Markers need a non-whitespace character on the inner side:

```text
**bold**        formats
** bold **      literal
|| secret ||    literal
||secret||      formats
```

Underscore markers do not open or close inside a word. This keeps identifiers
literal:

```text
snake_case_name          no formatting
_italic_                 italic
__underline__            underline
snake__case__name        no formatting
```

### Runs and nesting

- `***both***` produces bold and italic.
- Different styles can nest: `**a *b* c**`.
- The same style does not nest meaningfully; the parser pairs the nearest
  matching markers.
- Unmatched markers stay literal. The parser never throws on malformed input.
- Inline formatting is **line-scoped**. A marker opened on one line is not closed
  by a marker on another line. The editor applies inline commands line by line.

### Inline code

One or more backticks, closed by the same run length:

```text
`code * literal *`
``a ` b``           → a ` b
```

Backslashes inside code are literal. Unmatched backtick runs are text.

### Links

```text
[Hanger](https://thehanger.ru)
[**bold label**](https://example.com)
[a](https://example.com/a_(b))
[a\]b](https://example.com)
```

- The label may contain inline formatting.
- The label may contain nested square brackets, but not another link.
- URLs may contain balanced parentheses or backslash-escaped parentheses.
- A malformed link stays literal; links cannot span lines.

## Escapes

A backslash before ASCII punctuation removes that character's syntax meaning:

```text
\*literal\*      → *literal*
\_not italic\_  → _not italic_
\\              → \
\a              → \a (backslash stays)
```

## Entities

`document.text` plus `document.entities` is a Telegram-compatible view of the
message. Entities use UTF-16 offsets and lengths.

| Entity | Range |
| --- | --- |
| `bold`, `italic`, `underline`, `strikethrough`, `spoiler` | Styled text |
| `code` | Inline code text |
| `pre` | Fenced code, with optional `language` |
| `blockquote` | Quote text, including internal newlines |
| `text_link` | Link label, with `url` |

## Not supported

- headings, lists, tables, task lists;
- images and custom emoji entities;
- autolinking bare URLs;
- nested links;
- multiline inline entities;
- HTML input (it is escaped as text);
- Telegram Bot API MarkdownV2 escaping (`__` means underline here).

If you need any of these, treat the dialect as a starting point rather than a
complete Markdown implementation.
