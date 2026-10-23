# hanger-editor

A small, framework-agnostic rich-text layer for Hanger's chat composer.

It keeps a native `<textarea>` (so IME, accessibility and mobile text selection
keep working), stores plain markdown, and gives you:

- an **editor controller** with Telegram/Discord-style formatting commands,
  keyboard shortcuts, validation and submit payloads;
- an **optional rich textarea** that draws formatted text underneath a
  transparent textarea, without putting HTML into the value;
- an **isomorphic parser** that turns that markdown into a typed AST and
  Telegram-compatible entities;
- a **sanitised HTML renderer** for displaying messages.

The core has no runtime dependencies. Vue and React bindings are optional peers.
The parser, validator and renderer are safe to use during SSR.

```ts
import { parseMessage, renderHtml, validateMessage } from 'hanger-editor'
import { createMarkdownEditor } from 'hanger-editor/vanilla'

const { text, entities } = parseMessage('Hello **world**')
const html = renderHtml(parseMessage('Hello **world**'))
const { valid, errors } = validateMessage('   ')
```

## Install

```sh
pnpm add hanger-editor
```

Install the framework you use only if you want the matching adapter:

```sh
pnpm add vue     # hanger-editor/vue
pnpm add react   # hanger-editor/react
```

`hanger-editor` is ESM + CJS, ships its own types, and targets modern browsers
and Node 18+ (for SSR).

## Docs and playground

The documentation is a VitePress site in `docs/`. It includes a live playground
built on the rich textarea, plus code groups that switch between Vanilla,
Vue/Nuxt and React.

```sh
pnpm docs:dev     # http://localhost:5173
pnpm docs:build   # static output in docs/.vitepress/dist
pnpm docs:preview # preview the production build
```

The docs site imports the library TypeScript source through Vite aliases, so
changes in `src/` are visible immediately. It is development tooling and is not
included in the npm package.

## What it is not

- It is **not** a `contenteditable` editor. The optional rich textarea is a
  native textarea over a formatted mirror; the value remains markdown.
- It is **not** a full CommonMark implementation. The dialect is deliberately
  small and chat-shaped; see [syntax](https://github.com/Josquin2/hanger-editor/blob/main/docs/reference/syntax.md).
- It does **not** send messages. It validates and produces a payload; your app
  decides when and how to send it.
- It does **not** sanitise arbitrary HTML. It never accepts HTML as input —
  markdown is parsed and re-rendered, so passing the output to `v-html` is safe.

## Quick start (vanilla)

```ts
import { createMarkdownEditor } from 'hanger-editor/vanilla'

const textarea = document.querySelector<HTMLTextAreaElement>('#composer')!

const editor = createMarkdownEditor(textarea, {
  maxLength: 4096,
  submitOnEnter: true,
  onSubmit: ({ raw, text, html, entities }) => {
    // `raw` is what you store in the backend.
    // `text` is useful for notifications and search.
    // `html` is ready to render in the chat history.
    void sendMessage({ content: raw })
  },
})

editor.toggleBold()
editor.on('change', ({ canSubmit, validation }) => {
  sendButton.disabled = !canSubmit
  errorLabel.textContent = validation.errors[0]?.message ?? ''
})
```

You can also instantiate `new MarkdownEditor(textarea, options)` directly;
`createMarkdownEditor` is just a convenience factory.

## Rich textarea

Use this when you want formatted text in place instead of only raw markdown.
The textarea stays native and keeps the markdown value.

```ts
import { createRichTextarea } from 'hanger-editor/rich'
import 'hanger-editor/rich-textarea.css'

const rich = createRichTextarea(document.querySelector('#composer')!, {
  markers: 'hidden', // 'dim' | 'visible'
  submitOnEnter: true,
  onSubmit: ({ raw, html }) => saveMessage({ content: raw, html }),
})

rich.editor.toggleBold()
```

In Vue:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { RichTextarea, type RichTextareaExpose } from 'hanger-editor/vue'
import 'hanger-editor/rich-textarea.css'

const message = ref('')
const composer = ref<RichTextareaExpose | null>(null)
</script>

<template>
  <RichTextarea ref="composer" v-model="message" markers="dim" />
  <button @click="composer?.editor?.toggleBold()">B</button>
</template>
```

The textarea and the formatted layer must share font metrics for the native
caret to stay aligned. The default is monospace. Hidden delimiters still occupy
their advance width; that is why a small gap remains where `**` or `_` was.

Read the [rich textarea guide](https://github.com/Josquin2/hanger-editor/blob/main/docs/guide/rich-textarea.md)
for the alignment rules, marker modes, and the controller API.

## Nuxt / Vue

```vue
<script setup lang="ts">
import { useMarkdownEditor } from 'hanger-editor/vue'

const emit = defineEmits<{ submit: [raw: string] }>()
const model = defineModel<string>({ default: '' })
const textarea = ref<HTMLTextAreaElement | null>(null)

const {
  canSubmit,
  activeStyles,
  error,
  toggleBold,
  toggleItalic,
  toggleCode,
  toggleQuote,
  submit,
} = useMarkdownEditor(textarea, model, {
  submitOnEnter: true,
  onSubmit: ({ raw }) => emit('submit', raw),
})
</script>

<template>
  <div class="composer">
    <div class="composer__toolbar">
      <button
        type="button"
        :class="{ 'is-active': activeStyles.bold }"
        aria-label="Bold"
        @mousedown.prevent
        @click="toggleBold"
      >
        B
      </button>
      <button type="button" @mousedown.prevent @click="toggleItalic">I</button>
      <button type="button" @mousedown.prevent @click="toggleCode">Code</button>
      <button type="button" @mousedown.prevent @click="toggleQuote">Quote</button>
    </div>

    <textarea ref="textarea" v-model="model" />

    <button type="button" :disabled="!canSubmit" @click="submit()">
      Send
    </button>
    <p v-if="error">{{ error.code }}</p>
  </div>
</template>
```

The composable keeps the model and the textarea in sync in both directions, so
`v-model` is optional but harmless. `useMarkdownEditor` must be called during
`setup()`; the textarea ref may appear later (for example behind `v-if`).

`error` is the first validation error. Use `error.code` (`EMPTY_MESSAGE`,
`TOO_LONG`) for translated messages rather than the English `error.message`.

`@mousedown.prevent` on toolbar buttons is important: it stops the button from
stealing the textarea selection before the command runs.

### Attachment-only messages

`canSubmit` only considers text. If Hanger allows sending only an image, combine
the two states in the UI and force the submit:

```ts
const canSend = computed(() => canSubmit.value || files.value.length > 0)

function send() {
  const payload = files.value.length > 0 && !canSubmit.value
    ? submit({ force: true })
    : submit()

  if (payload) void sendMessage({ content: payload.raw, files: files.value })
}
```

`submit({ force: true })` bypasses text validation but still returns a payload.

## React

```tsx
import { useState } from 'react'
import { useMarkdownEditor } from 'hanger-editor/react'

export function Composer() {
  const [message, setMessage] = useState('')
  const editor = useMarkdownEditor(message, setMessage, {
    submitOnEnter: true,
    onSubmit: ({ raw }) => void sendMessage({ content: raw }),
  })

  return (
    <div>
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={editor.toggleBold}
      >
        B
      </button>
      <textarea ref={editor.textareaRef} />
      <button
        type="button"
        disabled={!editor.canSubmit}
        onClick={() => editor.submit()}
      >
        Send
      </button>
      <p>{editor.error?.code}</p>
    </div>
  )
}
```

Attach `textareaRef` and nothing else: **do not** also pass `value` or
`onChange` to the `<textarea>`. The hook owns the element value so that
formatting commands can preserve the caret. External changes to the controlled
`value` are applied silently.

## Rendering messages

```ts
import { parseMessage, renderHtml } from 'hanger-editor'

const document = parseMessage(message.content)
const html = renderHtml(document) // safe for v-html / dangerouslySetInnerHTML
const preview = document.text     // markers stripped, whitespace preserved
const entities = document.entities
```

In Vue:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { parseMessage, renderHtml } from 'hanger-editor'

const props = defineProps<{ content: string }>()
const html = computed(() => renderHtml(parseMessage(props.content)))
</script>

<template>
  <!-- Use a block container: quotes and code blocks are block elements. -->
  <div class="message__text" v-html="html" />
</template>
```

By default `renderHtml` returns a chat-friendly fragment: line breaks are
`<br>` and quotes/code use `<blockquote>`/`<pre>`. Pass
`{ wrapParagraphs: true }` if you want semantic `<p>` wrappers instead.

Useful render options:

| Option | Default | Meaning |
| --- | --- | --- |
| `wrapParagraphs` | `false` | Wrap paragraphs in `<p>` |
| `spoilerClass` | `'tg-spoiler'` | Class for spoilers; `null` removes it |
| `linkTarget` | `'_blank'` | `target` on links; `null` removes it |
| `linkRel` | `'noopener noreferrer nofollow'` | `rel` on links; `null` removes it |
| `languageClassPrefix` | `'language-'` | Prefix for fenced-code language classes |
| `allowedSchemes` | `['http','https','mailto','tg']` | Schemes allowed in `href` |
| `allowRelativeLinks` | `false` | Allow `/channels/1`-style links |

Spoilers need CSS to feel like spoilers. A minimal example:

```css
.tg-spoiler {
  background: color-mix(in oklab, currentColor 22%, transparent);
  border-radius: 0.25em;
  color: transparent;
  cursor: pointer;
  text-shadow: 0 0 10px color-mix(in oklab, currentColor 70%, transparent);
}

.tg-spoiler:focus,
.tg-spoiler:hover {
  background: transparent;
  color: inherit;
  text-shadow: none;
}
```

## Formatting syntax

| Syntax | Result |
| --- | --- |
| `**bold**` | **bold** |
| `*italic*` or `_italic_` | *italic* |
| `__underline__` | underline |
| `~~strikethrough~~` | strikethrough |
| `\|\|spoiler\|\|` | spoiler |
| `` `inline code` `` | inline code |
| ```` ```ts ... ``` ```` | fenced code block |
| `[label](https://example.com)` | link |
| `> quoted line` | block quote (consecutive lines) |
| `\*literal stars\*` | escaped markers |

Rules that matter in practice:

- Inline formatting is **line-scoped**. A `**` opened on one line does not close
  on another. The editor applies inline commands line by line when the
  selection spans lines.
- Markers need non-whitespace next to them. `** bold **` stays literal; `**bold**`
  formats.
- Underscore markers do not open or close inside words, so `snake_case_name` is
  untouched.
- A run of three asterisks is bold + italic: `***both***`.
- Quotes are one level deep. `>>` is literal text.
- Lists, headings, tables, images and bare-URL autolinking are intentionally not
  part of the dialect.
- Code spans and fenced code blocks are opaque: markup inside them is literal.
- Links may contain inline formatting in the label. Nested links are not
  supported, and links cannot span lines.

See [syntax](https://github.com/Josquin2/hanger-editor/blob/main/docs/reference/syntax.md) for the exact rules and edge cases.

## Validation

```ts
import { isBlank, validateMessage } from 'hanger-editor'

isBlank('   \u200B\uFEFF') // true
const result = validateMessage('   ')
result.valid      // false
result.isEmpty    // true
result.length     // 3
result.errors     // [{ code: 'EMPTY_MESSAGE', ... }]

validateMessage('**hello**').length // 5 — markers are not counted
```

Validation runs against the **visible** text, not the raw markdown.

- `EMPTY_MESSAGE` — after removing whitespace, zero-width characters, bidi
  controls, soft hyphens and BOMs, nothing is left. A message made of a million
  spaces is invalid; so is one made of zero-width characters.
- `TOO_LONG` — visible text exceeds `maxLength`. The default is 4096 UTF-16 code
  units (the same unit as JavaScript strings and Telegram entity offsets), and
  `maxLength: null` disables the limit.
- `allowEmpty: true` permits an empty message (for attachment-only sends).
- Markup markers do not count toward the length: `**hello**` is length 5.

`validateMessage` returns the parsed `document` too, so validation and rendering
can share one parse:

```ts
const document = parseMessage(raw)
const result = validateDocument(document)
const html = renderHtml(document)
```

## Editor API

### Options

| Option | Default | Meaning |
| --- | --- | --- |
| `value` | textarea value | Initial markdown |
| `maxLength` | `4096` | Visible limit; `null` disables |
| `allowEmpty` | `false` | Allow blank text |
| `submitOnEnter` | `false` | Enter triggers submit; Shift+Enter inserts a newline |
| `autoContinueQuote` | `true` | Enter on a quote line inserts `\n> ` |
| `shortcuts` | `true` | Enable formatting shortcuts |
| `html` | `{}` | Default options for the HTML payload |
| `onChange` | — | Receives `{ value, document, validation, canSubmit }` |
| `onSelectionChange` | — | Receives `{ selection, activeStyles }` |
| `onSubmit` | — | Receives a submit payload |

Ctrl/Cmd+Enter always submits, even when `submitOnEnter` is false.

Options are read when the controller is created. Changing `maxLength`,
`submitOnEnter` or other non-callback options after mounting is not supported;
recreate the editor or handle the value externally if you need that. In React,
callbacks are always read from the latest render; in Vue, pass closures that
read reactive state.

### Methods

| Method | Description |
| --- | --- |
| `getDocument()` | Parsed message (cached per value) |
| `getValidation()` | Validation result for the current value |
| `getSnapshot()` | Value + document + validation + selection + active styles |
| `getHtml(options?)` | Rendered HTML |
| `getActiveStyles()` | Which commands are active at the caret |
| `getSelection()` / `setSelection(range)` | Read/write caret offsets |
| `setValue(value, { emit? })` | Programmatically replace the value |
| `clear()` | Clear the value and selection |
| `insertText(text)` | Insert at the caret, replacing the selection |
| `insertLink(url, label?)` | Wrap the selection (or insert a link) |
| `removeLink()` | Remove the link around the caret |
| `toggleStyle(style)` | `bold`, `italic`, `underline`, `strikethrough`, `spoiler` |
| `toggleBold()` / `toggleItalic()` / `toggleUnderline()` | Convenience wrappers |
| `toggleStrikethrough()` / `toggleSpoiler()` | Convenience wrappers |
| `toggleCode()` | Inline code |
| `toggleCodeBlock(language?)` | Fenced code block |
| `toggleQuote()` | Quote/unquote the selected lines |
| `submit({ force? })` | Validate and emit a payload, or `null` |
| `focus()` | Focus the textarea |
| `on(event, listener)` / `off(...)` | Subscribe/unsubscribe; `on` returns a cleanup |
| `destroy()` | Remove every DOM listener and clear subscribers |

### Events

| Event | Payload |
| --- | --- |
| `change` | `{ value, document, validation, canSubmit }` |
| `selection` | `{ selection, activeStyles }` |
| `submit` | `{ raw, text, html, document, entities }` |
| `destroy` | `undefined` |

### Submit payload

```ts
interface SubmitPayload {
  raw: string           // markdown to store
  text: string          // visible text (notifications, search)
  html: string          // sanitised HTML (chat history)
  document: ParsedMessage
  entities: MessageEntity[] // Telegram-compatible UTF-16 entities
}
```

The editor never clears the textarea after submit; call `clear()` or set the
model to `''` when your send succeeds.

### Keyboard shortcuts

| Shortcut | Command |
| --- | --- |
| `Mod+B` | Bold |
| `Mod+I` | Italic |
| `Mod+U` | Underline |
| `Mod+Shift+X` | Strikethrough |
| `Mod+Shift+P` | Spoiler |
| `Mod+E` | Inline code |
| `Mod+Shift+E` | Code block |
| `Mod+Shift+Q` | Quote |
| `Mod+Shift+M` | Inline code (Telegram habit) |
| `Mod+Enter` | Submit |
| `Enter` | Submit when `submitOnEnter` is true |
| `Shift+Enter` | New line |

Shortcuts use the physical key, so `Mod+B` works on non-Latin layouts too.

## Parsed message shape

```ts
interface ParsedMessage {
  source: string            // CRLF normalised to LF
  text: string              // visible text, markers removed
  entities: MessageEntity[] // UTF-16 offsets, Telegram-compatible types
  blocks: MessageBlock[]    // paragraphs, quotes and fenced code
  warnings: ParseWarning[]  // currently unclosed code blocks
}
```

Entity types: `bold`, `italic`, `underline`, `strikethrough`, `spoiler`,
`code`, `pre`, `blockquote`, `text_link`. Inline nodes also carry `sourceStart`,
`sourceEnd`, `contentStart` and `contentEnd`, which is what makes selection-aware
editing possible.

## Security

The renderer never trusts the parser's input as HTML:

- text and attribute values are HTML-escaped;
- links only render with an allowed scheme (`http`, `https`, `mailto`, `tg` by
  default);
- `javascript:`, `data:`, `vbscript:`, control characters, whitespace, backslashes
  and protocol-relative URLs are rejected;
- rejected links render as their label;
- link attributes are fixed defaults unless you override them;
- fenced-code languages are sanitised.

The output is safe to put in `v-html` or `dangerouslySetInnerHTML` **as long as
you pass only `hanger-editor` output**. Do not concatenate other untrusted HTML
into the same element.

If you extend `allowedSchemes`, you own the consequences.

## Integrating with Hanger

The current `hanger-landing` composer sends raw text, and `Chat/History.vue`
renders `{{ block.content }}`. The minimal integration is:

1. In `Chat/Input.vue`, keep the existing markup and bind the textarea with
   `v-model`. Replace `defineModel` wiring and the Enter handler with
   `useMarkdownEditor`:

   ```ts
   const model = defineModel<string>({ default: '' })
   const textareaRef = ref<HTMLTextAreaElement | null>(null)
   const editor = useMarkdownEditor(textareaRef, model, {
     submitOnEnter: true,
     onSubmit: (payload) => emit('submit', payload.raw),
   })
   ```

   Then use `editor.canSubmit` / `editor.submit({ force: true })` to respect
   attachment-only messages, and expose toolbar buttons for the format commands
   you want.

2. Store `payload.raw` in `content` (the existing API field already takes a
   string).
3. In `Chat/History.vue`, replace the text interpolation with a block container:

   ```vue
   <div
     class="chat-history__msg"
     v-html="renderHtml(parseMessage(block.content))"
   />
   ```

   For long histories, memoise the parse/render per message instead of doing it
   on every render.

4. Use `document.text` for reply previews, notifications and search.

Rollout caveat: old messages were authored as plain text. Rendering them with
the markdown parser will treat accidental `*`, `_`, `~~`, backticks and leading
`>` as formatting. If that matters, gate rendering on a message format/version,
or migrate the old rows deliberately. The parser is tolerant: unpaired markers
stay literal.

## Development

```sh
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check       # lint, typecheck, tests, library and docs builds
pnpm docs:dev    # live docs and playground at http://localhost:5173
pnpm docs:build  # static docs in docs/.vitepress/dist
```

The test suite covers the parser, entity offsets, HTML escaping, URL policy,
validation, every editor command, keyboard shortcuts, the rich overlay, Vue and
React adapters, SSR, and a deterministic fuzz corpus.

## License

MIT
