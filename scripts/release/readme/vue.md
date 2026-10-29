# hanger-editor-vue

Vue 3 and Nuxt bindings for [`hanger-editor`](https://github.com/Josquin2/hanger-editor#readme).

The package installs the core package automatically and declares only `vue` as a
peer dependency.

## Install

```sh
pnpm add hanger-editor-vue
```

## Plain textarea

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useMarkdownEditor } from 'hanger-editor-vue'

const message = ref('')
const textarea = ref<HTMLTextAreaElement | null>(null)

const { canSubmit, activeStyles, toggleBold, submit } = useMarkdownEditor(
  textarea,
  message,
  {
    submitOnEnter: true,
    onSubmit: ({ raw }) => saveMessage(raw),
  },
)
</script>

<template>
  <button
    type="button"
    :class="{ 'is-active': activeStyles.bold }"
    @mousedown.prevent
    @click="toggleBold"
  >
    B
  </button>
  <textarea ref="textarea" v-model="message" />
  <button :disabled="!canSubmit" @click="submit()">Send</button>
</template>
```

Import `RichTextarea` when you want formatted text while typing:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { RichTextarea } from 'hanger-editor-vue'
import 'hanger-editor-vue/rich-textarea.css'

const message = ref('')
</script>

<template>
  <RichTextarea v-model="message" markers="dim" submit-on-enter />
</template>
```

## Exports

`useMarkdownEditor`, `RichTextarea`, `RichTextareaExpose` and the editor types
from the core package.

## Links

- [Documentation](https://github.com/Josquin2/hanger-editor/tree/main/docs)
- [Rich textarea guide](https://github.com/Josquin2/hanger-editor/blob/main/docs/guide/rich-textarea.md)
- [Issues](https://github.com/Josquin2/hanger-editor/issues)

MIT
