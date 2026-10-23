# Validation

Validation runs on the parsed message, not on the raw markdown. Markers do not
count toward the length, and invisible-only messages are rejected.

```ts
import { isBlank, validateMessage } from 'hanger-editor'

const result = validateMessage('   \n\t', { maxLength: 4096 })

result.valid // false
result.isEmpty // true
result.errors[0]?.code // "EMPTY_MESSAGE"

isBlank('   \u200B\uFEFF') // true
validateMessage('**hello**').length // 5
```

## Rules

- **Empty text** — everything that is whitespace, a zero-width character, a bidi
  control, a soft hyphen, a variation selector, or a BOM is removed before the
  emptiness check. A message made of a million spaces cannot be sent.
- **Length** — the default limit is 4096 UTF-16 code units, the same unit as
  JavaScript strings and Telegram entities. Emoji count as two units.
- **Visible text only** — `**hello**` has length 5, not 9.
- **Allow empty** — pass `{ allowEmpty: true }` when an empty text is valid.
  Attachment-only messages can also use `submit({ force: true })`.

## Error codes

| Code | When |
| --- | --- |
| `EMPTY_MESSAGE` | No visible characters remain |
| `TOO_LONG` | Visible text exceeds `maxLength` |

The `ValidationError` object also carries `limit` and `actual` for `TOO_LONG`.
The English `message` is a fallback; translate by `code` in the app.

## In the editor

The controller exposes the same result and a `canSubmit` getter. Use it for the
send button and for error text:

::: code-group

```ts [Vanilla]
editor.on('change', ({ validation, canSubmit }) => {
  send.disabled = !canSubmit
  error.textContent = validation.errors[0]?.code ?? ''
})
```

```vue [Vue]
<script setup lang="ts">
const { canSubmit, error, validation } = useMarkdownEditor(textarea, message)
</script>

<template>
  <button :disabled="!canSubmit" @click="submit()">Send</button>
  <p v-if="error">{{ t(`errors.${error.code}`) }}</p>
  <span>{{ validation.length }} / 4096</span>
</template>
```

```tsx [React]
const editor = useMarkdownEditor(message, setMessage)

return (
  <>
    <button disabled={!editor.canSubmit} onClick={() => editor.submit()}>
      Send
    </button>
    {editor.error && <p>{t(`errors.${editor.error.code}`)}</p>}
  </>
)
```

:::

Validation can also run without an editor, on the server:

```ts
import { parseMessage, validateDocument } from 'hanger-editor'

const document = parseMessage(raw)
const result = validateDocument(document, { maxLength: 4096 })
```

`validateDocument` is useful when the same request also renders HTML and you
want to parse only once.
