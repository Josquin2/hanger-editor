# Editor

`MarkdownEditor` is the plain textarea controller. It owns the value, commands,
selection handling, validation, and submit payload. It does not render UI.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `value` | textarea value | Initial markdown |
| `maxLength` | `4096` | Visible UTF-16 length; `null` disables |
| `allowEmpty` | `false` | Allow a message with no visible characters |
| `submitOnEnter` | `false` | Enter submits. Shift+Enter inserts a line |
| `autoContinueQuote` | `true` | Enter on a quote line inserts `> ` |
| `shortcuts` | `true` | Enable keyboard formatting |
| `html` | `{}` | Default options for the submit HTML |
| `onChange` | — | `{ value, document, validation, canSubmit }` |
| `onSelectionChange` | — | `{ selection, activeStyles }` |
| `onSubmit` | — | `SubmitPayload` |

`Ctrl`/`Cmd` + `Enter` always submits, even when `submitOnEnter` is `false`.

## Commands

| Method | Shortcut | Writes |
| --- | --- | --- |
| `toggleBold()` | `Mod+B` | `**text**` |
| `toggleItalic()` | `Mod+I` | `*text*` |
| `toggleUnderline()` | `Mod+U` | `__text__` |
| `toggleStrikethrough()` | `Mod+Shift+X` | `~~text~~` |
| `toggleSpoiler()` | `Mod+Shift+P` | `\|\|text\|\|` |
| `toggleCode()` | `Mod+E` | `` `text` `` |
| `toggleCodeBlock(language?)` | `Mod+Shift+E` | fenced block |
| `toggleQuote()` | `Mod+Shift+Q` | `> line` |
| `insertLink(url, label?)` | — | `[label](url)` |
| `removeLink()` | — | strips the link |
| `insertText(text)` | — | insert at the caret |

Shortcuts use the physical key, so they work with non-Latin layouts. Use
`getActiveStyles()` to render pressed states:

::: code-group

```ts [Vanilla]
toolbar.addEventListener('mousedown', (event) => event.preventDefault())

editor.on('selection', ({ activeStyles }) => {
  boldButton.classList.toggle('is-active', activeStyles.bold)
  boldButton.setAttribute('aria-pressed', String(activeStyles.bold))
})

boldButton.addEventListener('click', () => editor.toggleBold())
```

```vue [Vue]
<button
  type="button"
  :class="{ 'is-active': activeStyles.bold }"
  :aria-pressed="activeStyles.bold"
  @mousedown.prevent
  @click="toggleBold"
>
  B
</button>
```

```tsx [React]
<button
  type="button"
  className={editor.activeStyles.bold ? 'is-active' : undefined}
  aria-pressed={editor.activeStyles.bold}
  onMouseDown={(event) => event.preventDefault()}
  onClick={editor.toggleBold}
>
  B
</button>
```

:::

## Selection semantics

- Commands operate on the current selection. With no selection, a marker pair is
  inserted and an invisible placeholder is selected. Typing replaces it.
- If the selection is inside an existing style, toggling the command removes
  that style's markers. Splitting a style into several pieces is not implemented.
- A selection that fully contains existing runs of the same style replaces their
  markers and wraps the whole selection, so `Ctrl+A` followed by bold produces
  one clean pair of markers instead of nested ones.
- A selection that cuts through the middle of an existing style is left alone;
  splitting a run into several pieces is not implemented.
- Inline formatting is line-scoped. If the selection spans lines, inline
  commands wrap each line separately.
- Fenced code blocks are opaque: inline formatting is a no-op inside them.
- A fenced code block created around text chooses a fence longer than the longest
  backtick run in that text.

## Value API

| Method | Meaning |
| --- | --- |
| `getDocument()` | Parsed message, cached by value |
| `getValidation()` | Current validation result |
| `getSnapshot()` | Value, document, validation, selection, active styles |
| `getHtml(options?)` | Render the current document |
| `getSelection()` / `setSelection(range)` | Raw UTF-16 offsets |
| `getActiveStyles()` | Commands active at the selection |
| `setValue(value, { emit? })` | Replace the value |
| `clear()` | Clear value and selection |
| `submit({ force? })` | Validate and emit, or return `null` |
| `on(event, listener)` | Subscribe; returns an unsubscribe function |
| `destroy()` | Remove all DOM listeners |

## Events

| Event | Payload |
| --- | --- |
| `change` | `{ value, document, validation, canSubmit }` |
| `selection` | `{ selection, activeStyles }` |
| `submit` | `{ raw, text, html, document, entities }` |
| `destroy` | `undefined` |

A `RichTextarea` exposes the same editor as `rich.editor`.
