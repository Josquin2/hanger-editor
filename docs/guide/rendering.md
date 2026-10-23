# Rendering

Store the raw markdown. Parse and render it where messages are shown. The
renderer escapes every text node and attribute; it never accepts HTML input.

::: code-group

```ts [Vanilla]
import { parseMessage, renderHtml } from 'hanger-editor'

const document = parseMessage(message.content)
const html = renderHtml(document)

element.innerHTML = html // library output is escaped and URL-safe
const preview = document.text // plain text for notifications and search
```

```vue [Vue]
<script setup lang="ts">
import { computed } from 'vue'
import { parseMessage, renderHtml } from 'hanger-editor'

const props = defineProps<{ content: string }>()
const html = computed(() => renderHtml(parseMessage(props.content)))
</script>

<template>
  <!-- Use a block element: blockquote and pre are block-level tags. -->
  <div class="message__text" v-html="html" />
</template>
```

```tsx [React]
import { useMemo } from 'react'
import { parseMessage, renderHtml } from 'hanger-editor'

export function Message({ content }: { content: string }) {
  const html = useMemo(
    () => renderHtml(parseMessage(content)),
    [content],
  )

  return (
    <div
      className="message__text"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
```

:::

## Default output

By default the renderer returns a chat fragment: line breaks are `<br>`, quotes
are `<blockquote>`, and code blocks are `<pre><code>`. Pass
`{ wrapParagraphs: true }` to get `<p>` wrappers instead.

```ts
renderHtml(parseMessage('one\ntwo')) // "one<br>two"

renderHtml(parseMessage('hello\n\nworld'), {
  wrapParagraphs: true,
}) // "<p>hello</p><p>world</p>"
```

Options:

| Option | Default | Meaning |
| --- | --- | --- |
| `wrapParagraphs` | `false` | Use `<p>` for paragraphs |
| `spoilerClass` | `'tg-spoiler'` | Class on spoilers; `null` removes it |
| `linkTarget` | `'_blank'` | Link target; `null` removes it |
| `linkRel` | `'noopener noreferrer nofollow'` | Link rel; `null` removes it |
| `languageClassPrefix` | `'language-'` | Prefix for code language classes |
| `allowedSchemes` | `http`, `https`, `mailto`, `tg` | Allowed link schemes |
| `allowRelativeLinks` | `false` | Allow relative URLs |

`renderHtml` is safe to use with `v-html` **as long as the input is
`hanger-editor` output**. Do not concatenate other untrusted HTML into the same
element. See [security](/reference/security).

## Entities

`document.entities` is a Telegram-compatible view of the rendered text. Offsets
are UTF-16 code units.

| Type | Covers |
| --- | --- |
| `bold`, `italic`, `underline`, `strikethrough`, `spoiler` | Styled text |
| `code` | Inline code text |
| `pre` | Fenced code text; optional `language` |
| `blockquote` | Quote lines |
| `text_link` | Link label; includes `url` |

Nested formatting produces overlapping entity ranges. `document.text` is the
plain text with markers removed.

## Caching

For long histories, parse each message once. The parsed document is immutable,
so it can be cached by message id or content version:

```ts
const cache = new Map<string, ParsedMessage>()

function renderCached(id: string, content: string): string {
  let document = cache.get(id)
  if (!document) {
    document = parseMessage(content)
    cache.set(id, document)
  }
  return renderHtml(document)
}
```

The rich textarea's mirror uses a different renderer —
[`renderRichSource`](/reference/api#renderrichsource) — because it must preserve
the source exactly for caret alignment.
