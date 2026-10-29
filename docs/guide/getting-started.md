# Getting started

## Install

```sh
pnpm add hanger-editor          # core + vanilla editor
pnpm add hanger-editor-vue      # Vue 3 / Nuxt
pnpm add hanger-editor-react    # React
pnpm add hanger-editor-rich     # rich textarea (framework-agnostic)
```

The framework packages install the core package and declare only their own
framework as a peer. The examples use those package names; the equivalent
`hanger-editor/vue`, `/react` and `/rich` subpaths remain supported.

## Mount the editor

The plain controller attaches to a native `<textarea>` and owns its markdown
value, formatting commands, validation, and submit payload.

::: code-group

```ts [Vanilla]
import { createMarkdownEditor } from 'hanger-editor/vanilla'

const textarea = document.querySelector<HTMLTextAreaElement>('textarea')!
const editor = createMarkdownEditor(textarea, {
  submitOnEnter: true,
  onSubmit: ({ raw, html, text }) => {
    // raw is what you store.
    // html is what you render.
    // text is useful for notifications and search.
    saveMessage({ content: raw, html, text })
  },
})
```

```vue [Vue / Nuxt]
<script setup lang="ts">
import { useMarkdownEditor } from 'hanger-editor-vue'

const emit = defineEmits<{ submit: [raw: string] }>()
const message = defineModel<string>({ default: '' })
const textarea = ref<HTMLTextAreaElement | null>(null)

const { canSubmit, activeStyles, toggleBold, submit } = useMarkdownEditor(
  textarea,
  message,
  {
    submitOnEnter: true,
    onSubmit: ({ raw }) => emit('submit', raw),
  },
)
</script>

<template>
  <div class="composer">
    <button
      type="button"
      :class="{ 'is-active': activeStyles.bold }"
      @mousedown.prevent
      @click="toggleBold"
    >
      B
    </button>
    <textarea ref="textarea" v-model="message" />
    <button type="button" :disabled="!canSubmit" @click="submit()">
      Send
    </button>
  </div>
</template>
```

```tsx [React]
import { useState } from 'react'
import { useMarkdownEditor } from 'hanger-editor-react'

export function Composer() {
  const [message, setMessage] = useState('')
  const editor = useMarkdownEditor(message, setMessage, {
    submitOnEnter: true,
    onSubmit: ({ raw }) => void sendMessage(raw),
  })

  return (
    <>
      <textarea ref={editor.textareaRef} />
      <button
        type="button"
        disabled={!editor.canSubmit}
        onClick={() => editor.submit()}
      >
        Send
      </button>
    </>
  )
}
```

:::

Keep toolbar buttons on `@mousedown.prevent` (or call
`event.preventDefault()` on mouse down). Otherwise the button steals focus and
the textarea loses its selection before the command runs.

## Read the value

Every controller exposes the same value/validation surface:

| Method or property | Meaning |
| --- | --- |
| `value` / `getDocument()` | Current markdown and its parsed form |
| `getValidation()` / `canSubmit` | Visible length and errors |
| `getHtml(options?)` | Sanitised HTML for the message |
| `getSnapshot()` | Value, document, validation, selection and active styles |
| `submit({ force? })` | Emit a payload, or `null` when invalid |

The submit payload:

```ts
interface SubmitPayload {
  raw: string       // store this
  text: string      // notifications, search, previews
  html: string      // safe for v-html
  document: ParsedMessage
  entities: MessageEntity[]
}
```

The controller never sends or clears anything by itself. Call `clear()` or reset
your model after a successful request.

## Rendered or rich?

Two components share the same core:

- **`MarkdownEditor`** keeps a plain textarea visible. It is the smallest option,
  and markdown delimiters are always visible while writing.
- **`RichTextarea`** puts a formatted layer under a transparent textarea. The
  textarea value is still markdown, but bold, italic, code, and quotes are
  visible in place. Use it when you want a Telegram-like composer.

Continue with [the editor](/guide/editor), [the rich textarea](/guide/rich-textarea),
or [rendering](/guide/rendering).
