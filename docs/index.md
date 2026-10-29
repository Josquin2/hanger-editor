---
title: hanger-editor
description: Markdown editing, validation and safe HTML rendering for Hanger chat.
---

# hanger-editor

Chat markdown for Hanger: a parser, validator, sanitised HTML renderer, and two
textarea controllers. The core is plain TypeScript; the Vue and React bindings
are optional.

## Install

```sh
pnpm add hanger-editor
```

Framework bindings live in separate packages with a single peer dependency:

```sh
pnpm add hanger-editor-vue     # Vue 3 / Nuxt
pnpm add hanger-editor-react   # React
pnpm add hanger-editor-rich    # framework-agnostic rich textarea
```

The `hanger-editor/vue`, `/react` and `/rich` subpaths remain available for
compatibility. The dedicated packages install the core package and are the
recommended choice.

## At a glance

```ts
import { parseMessage, renderHtml, validateMessage } from 'hanger-editor'

const message = parseMessage('Hello **world**')

message.text // "Hello world"
message.entities // [{ type: 'bold', offset: 6, length: 5 }]
renderHtml(message) // "Hello <strong>world</strong>"
validateMessage('   ').errors[0]?.code // "EMPTY_MESSAGE"
```

The editor is a native textarea: markdown is the value, formatting is applied by
the controller. If you want the formatted text to be visible while typing, use
the [rich textarea overlay](/guide/rich-textarea).

::: tip Try it first
The [playground](/playground) runs the real library source: edit a message,
switch the preview between rendered HTML, markdown, plain text, and entities, and
change how markdown delimiters are displayed.
:::

## What you get

| Entry | Contents |
| --- | --- |
| `hanger-editor` | Parser, validator, HTML renderer, URL policy |
| `hanger-editor/vanilla` | `MarkdownEditor`, `createMarkdownEditor` |
| `hanger-editor/rich` | `RichTextareaController`, `createRichTextarea` |
| `hanger-editor-vue` | `useMarkdownEditor`, `RichTextarea` |
| `hanger-editor-react` | `useMarkdownEditor` |
| `hanger-editor-rich` | Rich textarea and CSS |

## Quick start

::: code-group

```ts [Vanilla]
import { createMarkdownEditor } from 'hanger-editor/vanilla'

const editor = createMarkdownEditor(document.querySelector('textarea')!, {
  submitOnEnter: true,
  onSubmit: ({ raw, html }) => saveMessage({ content: raw, html }),
})

editor.on('change', ({ canSubmit }) => {
  sendButton.disabled = !canSubmit
})
```

```vue [Vue / Nuxt]
<script setup lang="ts">
import { useMarkdownEditor } from 'hanger-editor-vue'

const message = ref('')
const textarea = ref<HTMLTextAreaElement | null>(null)

const { canSubmit, submit } = useMarkdownEditor(textarea, message, {
  submitOnEnter: true,
  onSubmit: ({ raw }) => saveMessage({ content: raw }),
})
</script>

<template>
  <textarea ref="textarea" v-model="message" />
  <button :disabled="!canSubmit" @click="submit()">Send</button>
</template>
```

```tsx [React]
import { useState } from 'react'
import { useMarkdownEditor } from 'hanger-editor-react'

export function Composer() {
  const [message, setMessage] = useState('')
  const editor = useMarkdownEditor(message, setMessage, {
    submitOnEnter: true,
    onSubmit: ({ raw }) => saveMessage({ content: raw }),
  })

  return (
    <>
      <textarea ref={editor.textareaRef} />
      <button disabled={!editor.canSubmit} onClick={() => editor.submit()}>
        Send
      </button>
    </>
  )
}
```

:::

Read the [getting started guide](/guide/getting-started) for the full wiring, or
jump to [syntax](/reference/syntax) and the [API reference](/reference/api).
