# hanger-editor-react

React bindings for [`hanger-editor`](https://github.com/Josquin2/hanger-editor#readme).

The package installs the core package automatically and declares only `react`
as a peer dependency.

## Install

```sh
pnpm add hanger-editor-react
```

## Usage

```tsx
import { useState } from 'react'
import { useMarkdownEditor } from 'hanger-editor-react'

export function Composer() {
  const [message, setMessage] = useState('')
  const editor = useMarkdownEditor(message, setMessage, {
    submitOnEnter: true,
    onSubmit: ({ raw }) => saveMessage(raw),
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

The hook owns the textarea value. Do not pass `value` or `onChange` to the
textarea as well.

## Rich textarea

The React package exposes the base editor hook. For the formatted overlay, use
the framework-agnostic controller from
[`hanger-editor-rich`](https://www.npmjs.com/package/hanger-editor-rich) inside
an effect:

```tsx
import { useEffect, useRef } from 'react'
import { createRichTextarea } from 'hanger-editor-rich'
import 'hanger-editor-rich/rich-textarea.css'

export function RichComposer() {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!host.current) return
    const rich = createRichTextarea(host.current, {
      value: '',
      submitOnEnter: true,
    })
    return () => rich.destroy()
  }, [])

  return <div ref={host} />
}
```

## Links

- [Documentation](https://github.com/Josquin2/hanger-editor/tree/main/docs)
- [Issues](https://github.com/Josquin2/hanger-editor/issues)

MIT
