# hanger-editor-rich

Formatted textarea overlay for [`hanger-editor`](https://github.com/Josquin2/hanger-editor#readme).

The textarea keeps plain markdown as its value. A second, source-aligned layer
renders bold, italic, code, quotes and links underneath the transparent
textarea, so formatting is visible without putting HTML into the value.

The package installs the core package automatically.

## Install

```sh
pnpm add hanger-editor-rich
```

## Usage

```ts
import { createRichTextarea } from 'hanger-editor-rich'
import 'hanger-editor-rich/rich-textarea.css'

const rich = createRichTextarea(document.querySelector('#composer')!, {
  value: '',
  placeholder: 'Write a message…',
  markers: 'dim',
  submitOnEnter: true,
  maxHeight: 320,
  onChange: ({ value }) => saveDraft(value),
  onSubmit: ({ raw, html }) => sendMessage({ content: raw, html }),
})

rich.editor.toggleBold()
rich.focus()
```

`markers` accepts `visible`, `dim` or `hidden`. Hidden delimiters keep their
advance width for caret alignment; use `dim` if the resulting gaps are
distracting.

## Links

- [Rich textarea guide](https://github.com/Josquin2/hanger-editor/blob/main/docs/guide/rich-textarea.md)
- [API](https://github.com/Josquin2/hanger-editor/blob/main/docs/reference/api.md)
- [Issues](https://github.com/Josquin2/hanger-editor/issues)

MIT
