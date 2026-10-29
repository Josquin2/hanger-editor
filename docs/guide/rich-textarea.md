# Rich textarea

`RichTextarea` is a native textarea with a formatted mirror underneath it. The
textarea still holds markdown, but bold, italic, code, quotes, and links are
visible while you type. No HTML tags enter the value.

It is two aligned layers: the textarea receives input and draws the caret; an
`aria-hidden` layer renders the same source with typographic classes. The layers
share font, padding, line height, wrapping, and scroll position.

```sh
pnpm add hanger-editor-rich
```

The Vue wrapper lives in `hanger-editor-vue`:

```sh
pnpm add hanger-editor-vue
```

```ts
import { createRichTextarea } from 'hanger-editor-rich'
import 'hanger-editor-rich/rich-textarea.css'
```

## Usage

::: code-group

```ts [Vanilla]
import { createRichTextarea } from 'hanger-editor-rich'
import 'hanger-editor-rich/rich-textarea.css'

const host = document.querySelector<HTMLElement>('#composer')!
const rich = createRichTextarea(host, {
  value: '',
  placeholder: 'Write a message…',
  markers: 'hidden',
  submitOnEnter: true,
  minHeight: 120,
  maxHeight: 260,
  onChange: ({ value }) => saveDraft(value),
  onSubmit: ({ raw, html }) => sendMessage({ content: raw, html }),
})

// The underlying controller is still available.
rich.editor.toggleBold()
rich.focus()
```

```vue [Vue / Nuxt]
<script setup lang="ts">
import { ref } from 'vue'
import { RichTextarea, type RichTextareaExpose } from 'hanger-editor-vue'
import 'hanger-editor-vue/rich-textarea.css'

const message = ref('')
const composer = ref<RichTextareaExpose | null>(null)

function send() {
  const payload = composer.value?.submit()
  if (payload) void sendMessage({ content: payload.raw })
}
</script>

<template>
  <RichTextarea
    ref="composer"
    v-model="message"
    placeholder="Write a message…"
    markers="hidden"
    submit-on-enter
  />
  <button type="button" @click="composer?.editor?.toggleBold()">B</button>
  <button type="button" @click="send">Send</button>
</template>
```

```tsx [React]
import { useEffect, useRef } from 'react'
import { createRichTextarea, type RichTextareaController } from 'hanger-editor-rich'
import 'hanger-editor-rich/rich-textarea.css'

export function Composer() {
  const host = useRef<HTMLDivElement>(null)
  const rich = useRef<RichTextareaController | null>(null)

  useEffect(() => {
    if (!host.current) return

    rich.current = createRichTextarea(host.current, {
      value: '',
      markers: 'hidden',
      submitOnEnter: true,
      onSubmit: ({ raw }) => void sendMessage(raw),
    })

    return () => {
      rich.current?.destroy()
      rich.current = null
    }
  }, [])

  return <div ref={host} />
}
```

:::

The Vue wrapper keeps `v-model` in sync and exposes the controller:

```ts
interface RichTextareaExpose {
  controller: RichTextareaController | null
  editor: MarkdownEditor | null
  focus(): void
  clear(): void
  submit(): SubmitPayload | null
  setMarkers(markers: MarkerVisibility): void
}
```

In React, use the vanilla controller inside an effect. The value sync, teardown,
and toolbar access are the same as any imperative DOM integration.

## Markers

The delimiters are part of the source, so they must keep their typographic width
for the native caret to stay aligned. The `markers` option controls their
appearance:

| Value | Effect |
| --- | --- |
| `hidden` | Formatting delimiters are transparent. Their advance width remains. |
| `dim` | Delimiters are drawn faintly. Default. |
| `visible` | Delimiters are close to normal text brightness. |

When markers are hidden, small gaps remain where `**`, `_`, and other
delimiters sit. Removing the width would move the formatted text away from the
textarea caret; no CSS can do one without the other. Use `dim` if the gaps are
more distracting than the syntax.

`setMarkers()` changes the mode at runtime:

```ts
rich.setMarkers('dim')
```

The [playground](/playground) has the same switch.

## Alignment constraints

The two layers are intentionally identical. If you theme the rich editor:

- keep the font on **both** layers; the component owns the classes, so use the
  CSS variables below rather than styling `.hte__input` or `.hte__backdrop`
  separately;
- use a monospace font. Bold and italic keep the same advance width there. With
  a proportional font, changing weight or slant can move subsequent glyphs away
  from the textarea caret;
- do not add margins or borders to only one layer;
- keep the textarea's scrollbar hidden. The component already does this so both
  layers wrap at the same width.

::: warning Client-only
`createRichTextarea` builds DOM. Call it from `onMounted` in Vue or `useEffect`
in React. It is not rendered during SSR, although the underlying value and
validation still work server-side.
:::

## Theme variables

Set these on `.hte` or a parent:

| Variable | Default |
| --- | --- |
| `--hte-font` | UI monospace stack |
| `--hte-font-size` | `15px` (`16px` on small screens) |
| `--hte-line-height` | `1.65` |
| `--hte-padding` | `12px 14px` |
| `--hte-bg` | VitePress background token |
| `--hte-text` | Primary text token |
| `--hte-marker` | Muted text token |
| `--hte-caret` | Brand color |
| `--hte-link` | Brand color |
| `--hte-code-bg` | Soft background token |

## Options

`RichTextareaOptions` extends `EditorOptions` with:

| Option | Default | Meaning |
| --- | --- | --- |
| `placeholder` | `''` | Placeholder shown when empty |
| `ariaLabel` | — | Accessible name for the textarea |
| `markers` | `'dim'` | Marker visibility |
| `minHeight` | `96` | Minimum textarea height in px |
| `maxHeight` | `320` | Maximum height before the textarea scrolls |
| `spellcheck` | `true` | Native spellcheck |
| `name` / `id` | — | Forwarded to the textarea |

Controller methods: `setValue`, `setMarkers`, `setPlaceholder`, `focus`,
`clear`, `submit`, `destroy`. Formatting commands live on
`rich.editor.toggleBold()` and the other editor methods.
