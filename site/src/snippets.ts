export const FRAMEWORKS = [
  { id: 'vanilla', label: 'Vanilla', language: 'TypeScript' },
  { id: 'vue', label: 'Vue / Nuxt', language: 'Vue SFC' },
  { id: 'react', label: 'React', language: 'TSX' },
] as const

export type Framework = (typeof FRAMEWORKS)[number]['id']

export type Snippet = Record<Framework, string>

export const SNIPPETS = {
  quickstart: {
    vanilla: `import { createMarkdownEditor } from 'hanger-editor/vanilla'

const textarea = document.querySelector('textarea')!
const editor = createMarkdownEditor(textarea, {
  submitOnEnter: true,
  onSubmit: ({ raw, html, text }) => {
    // raw is what you store, html is what you render,
    // text is handy for notifications and search.
    sendMessage({ content: raw }, { html, text })
  },
})

editor.on('change', ({ canSubmit }) => {
  sendButton.disabled = !canSubmit
})`,
    vue: `<script setup lang="ts">
import { useMarkdownEditor } from 'hanger-editor/vue'

const emit = defineEmits<{ submit: [raw: string] }>()
const model = defineModel<string>({ default: '' })
const textarea = ref<HTMLTextAreaElement | null>(null)

const { canSubmit, activeStyles, toggleBold, submit } =
  useMarkdownEditor(textarea, model, {
    submitOnEnter: true,
    onSubmit: ({ raw }) => emit('submit', raw),
  })
</script>

<template>
  <textarea ref="textarea" v-model="model" />
  <button type="button" :disabled="!canSubmit" @click="submit()">
    Send
  </button>
</template>`,
    react: `import { useState } from 'react'
import { useMarkdownEditor } from 'hanger-editor/react'

export function Composer() {
  const [message, setMessage] = useState('')
  const editor = useMarkdownEditor(message, setMessage, {
    submitOnEnter: true,
    onSubmit: ({ raw }) => void sendMessage(raw),
  })

  return (
    <>
      <textarea ref={editor.textareaRef} />
      <button disabled={!editor.canSubmit} onClick={() => editor.submit()}>
        Send
      </button>
    </>
  )
}`,
  },
  toolbar: {
    vanilla: `const commands = {
  bold: () => editor.toggleBold(),
  italic: () => editor.toggleItalic(),
  code: () => editor.toggleCode(),
  quote: () => editor.toggleQuote(),
}

editor.on('selection', ({ activeStyles }) => {
  for (const [command, run] of Object.entries(commands)) {
    const button = toolbar.querySelector(\`[data-command="\${command}"]\`)
    button?.classList.toggle('is-active', activeStyles[command])
    button?.setAttribute('aria-pressed', String(activeStyles[command]))
    button?.addEventListener('click', run)
  }
})

// Keep the caret in the textarea when a toolbar button is pressed.
toolbar.addEventListener('mousedown', (event) => event.preventDefault())`,
    vue: `<template>
  <div class="toolbar" @mousedown.prevent>
    <button
      type="button"
      :class="{ 'is-active': activeStyles.bold }"
      :aria-pressed="activeStyles.bold"
      @click="toggleBold"
    >
      B
    </button>

    <button
      type="button"
      :class="{ 'is-active': activeStyles.code }"
      :aria-pressed="activeStyles.code"
      @click="toggleCode"
    >
      Code
    </button>
  </div>
</template>`,
    react: `export function Toolbar({ editor }: { editor: UseMarkdownEditorResult }) {
  const className = (active: boolean) => (active ? 'is-active' : undefined)

  return (
    <div className="toolbar" onMouseDown={(event) => event.preventDefault()}>
      <button
        type="button"
        className={className(editor.activeStyles.bold)}
        aria-pressed={editor.activeStyles.bold}
        onClick={editor.toggleBold}
      >
        B
      </button>

      <button
        type="button"
        className={className(editor.activeStyles.code)}
        aria-pressed={editor.activeStyles.code}
        onClick={editor.toggleCode}
      >
        Code
      </button>
    </div>
  )
}`,
  },
  validation: {
    vanilla: `import { isBlank, validateMessage } from 'hanger-editor'

const result = validateMessage('   \\n\\t', { maxLength: 4096 })

result.valid       // false
result.isEmpty     // true
result.errors[0]?.code // 'EMPTY_MESSAGE'

isBlank('   \\u200B\\uFEFF') // true — invisible-only messages are rejected
validateMessage('**hello**').length // 5 — markers are not counted

// The editor exposes the same state:
editor.canSubmit                  // boolean
editor.getValidation().errors     // readonly errors`,
    vue: `const { canSubmit, error, validation, submit } =
  useMarkdownEditor(textarea, model)

// canSubmit is a computed ref.
// error.value?.code is 'EMPTY_MESSAGE' or 'TOO_LONG'.
// validation.value.length counts visible characters.`,
    react: `const editor = useMarkdownEditor(message, setMessage)

editor.canSubmit          // boolean
editor.error?.code        // 'EMPTY_MESSAGE' | 'TOO_LONG'
editor.validation.length  // visible UTF-16 length
editor.submit()           // null when invalid`,
  },
  rendering: {
    vanilla: `import { parseMessage, renderHtml } from 'hanger-editor'

const document = parseMessage(message.content)
const html = renderHtml(document)

element.innerHTML = html // library output is escaped and URL-safe
element.textContent = document.text // optional: plain text preview`,
    vue: `<script setup lang="ts">
import { computed } from 'vue'
import { parseMessage, renderHtml } from 'hanger-editor'

const props = defineProps<{ content: string }>()
const html = computed(() => renderHtml(parseMessage(props.content)))
</script>

<template>
  <!-- Use a block container: quotes and code are block elements. -->
  <div class="message__text" v-html="html" />
</template>`,
    react: `import { useMemo } from 'react'
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
}`,
  },
} satisfies Record<string, Snippet>

export type SnippetKey = keyof typeof SNIPPETS

export function isSnippetKey(value: string): value is SnippetKey {
  return value in SNIPPETS
}
