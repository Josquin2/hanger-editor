import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { parseMessage } from '../core/parse'
import { renderHtml, type HtmlRenderOptions } from '../core/render-html'
import type { InlineStyle, ParsedMessage } from '../core/types'
import { validateMessage, type ValidationError, type ValidationResult } from '../core/validate'
import { MarkdownEditor } from '../editor/editor'
import {
  createEmptyActiveStyles,
  type ActiveStyles,
  type ChangeEvent,
  type EditorOptions,
  type EditorSnapshot,
  type SelectionEvent,
  type SelectionRange,
  type SubmitOptions,
  type SubmitPayload,
} from '../editor/types'

export type ReactEditorOptions = Omit<EditorOptions, 'value'>

export interface UseMarkdownEditorResult {
  /**
   * Attach this to the textarea. Do not also pass `value`/`onChange` to the
   * textarea: the hook owns its value and keeps it in sync.
   */
  textareaRef: RefObject<HTMLTextAreaElement | null>
  snapshot: EditorSnapshot | null
  document: ParsedMessage
  validation: ValidationResult
  canSubmit: boolean
  activeStyles: ActiveStyles
  selection: SelectionRange
  error: ValidationError | null
  isEmpty: boolean
  submit: (options?: SubmitOptions) => SubmitPayload | null
  clear: () => void
  focus: () => void
  setValue: (value: string) => void
  insertText: (text: string) => void
  insertLink: (url: string, label?: string) => boolean
  removeLink: () => boolean
  toggleStyle: (style: InlineStyle) => void
  toggleBold: () => void
  toggleItalic: () => void
  toggleUnderline: () => void
  toggleStrikethrough: () => void
  toggleSpoiler: () => void
  toggleCode: () => void
  toggleCodeBlock: (language?: string) => void
  toggleQuote: () => void
  getHtml: (options?: HtmlRenderOptions) => string
}

const EMPTY_ACTIVE_STYLES = Object.freeze(
  createEmptyActiveStyles(),
) as ActiveStyles
const EMPTY_SELECTION: SelectionRange = { start: 0, end: 0 }

/**
 * React binding for the markdown editor.
 *
 * `value` is the controlled text; `onChange` receives every edit, including
 * formatting commands. Lifecycle and the textarea are handled by the hook, so
 * no extra component wrapper is required.
 */
export function useMarkdownEditor(
  value: string,
  onChange: (value: string) => void,
  options: ReactEditorOptions = {},
): UseMarkdownEditorResult {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const editorRef = useRef<MarkdownEditor | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const [snapshot, setSnapshot] = useState<EditorSnapshot | null>(null)

  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const optionsRef = useRef(options)
  valueRef.current = value
  onChangeRef.current = onChange
  optionsRef.current = options

  const refresh = useCallback((): void => {
    const editor = editorRef.current
    if (editor) setSnapshot(editor.getSnapshot())
  }, [])

  // Runs after every render so a textarea that appears after the first mount
  // (conditional rendering, tabs) still gets a controller.
  useEffect(() => {
    const element = textareaRef.current
    if (editorRef.current?.textarea === element) return

    cleanupRef.current?.()
    cleanupRef.current = null
    editorRef.current = null

    if (!element) return

    const {
      onChange: _onChange,
      onSelectionChange: _onSelectionChange,
      onSubmit: _onSubmit,
      ...baseOptions
    } = optionsRef.current

    const editor = new MarkdownEditor(element, {
      ...baseOptions,
      value: valueRef.current,
    })
    editorRef.current = editor

    const unsubscribers = [
      editor.on('change', (event: ChangeEvent) => {
        onChangeRef.current(event.value)
        optionsRef.current.onChange?.(event)
        refresh()
      }),
      editor.on('selection', (event: SelectionEvent) => {
        optionsRef.current.onSelectionChange?.(event)
        refresh()
      }),
      editor.on('submit', (payload: SubmitPayload) => {
        optionsRef.current.onSubmit?.(payload)
      }),
    ]

    cleanupRef.current = () => {
      for (const unsubscribe of unsubscribers) unsubscribe()
      editor.destroy()
      if (editorRef.current === editor) editorRef.current = null
    }

    refresh()
  })

  useEffect(() => {
    return () => {
      cleanupRef.current?.()
      cleanupRef.current = null
      editorRef.current = null
    }
  }, [])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    if (editor.value === value) return

    editor.setValue(value, { emit: false })
    setSnapshot(editor.getSnapshot())
  }, [value])

  const submit = useCallback((submitOptions?: SubmitOptions): SubmitPayload | null => {
    return editorRef.current?.submit(submitOptions) ?? null
  }, [])

  const clear = useCallback((): void => {
    if (editorRef.current) editorRef.current.clear()
    else onChangeRef.current('')
  }, [])

  const focus = useCallback((): void => {
    editorRef.current?.focus()
  }, [])

  const setValue = useCallback((next: string): void => {
    if (editorRef.current) editorRef.current.setValue(next)
    else onChangeRef.current(next)
  }, [])

  const insertText = useCallback((text: string): void => {
    editorRef.current?.insertText(text)
  }, [])

  const insertLink = useCallback((url: string, label?: string): boolean => {
    return editorRef.current?.insertLink(url, label) ?? false
  }, [])

  const removeLink = useCallback((): boolean => {
    return editorRef.current?.removeLink() ?? false
  }, [])

  const toggleStyle = useCallback((style: InlineStyle): void => {
    editorRef.current?.toggleStyle(style)
  }, [])

  const toggleBold = useCallback((): void => {
    editorRef.current?.toggleBold()
  }, [])

  const toggleItalic = useCallback((): void => {
    editorRef.current?.toggleItalic()
  }, [])

  const toggleUnderline = useCallback((): void => {
    editorRef.current?.toggleUnderline()
  }, [])

  const toggleStrikethrough = useCallback((): void => {
    editorRef.current?.toggleStrikethrough()
  }, [])

  const toggleSpoiler = useCallback((): void => {
    editorRef.current?.toggleSpoiler()
  }, [])

  const toggleCode = useCallback((): void => {
    editorRef.current?.toggleCode()
  }, [])

  const toggleCodeBlock = useCallback((language = ''): void => {
    editorRef.current?.toggleCodeBlock(language)
  }, [])

  const toggleQuote = useCallback((): void => {
    editorRef.current?.toggleQuote()
  }, [])

  const getHtml = useCallback((htmlOptions?: HtmlRenderOptions): string => {
    if (editorRef.current) return editorRef.current.getHtml(htmlOptions)
    return renderHtml(parseMessage(valueRef.current), htmlOptions)
  }, [])

  const fallback = snapshot
    ? null
    : validateMessage(value, {
      maxLength: options.maxLength,
      allowEmpty: options.allowEmpty,
    })
  const validation = snapshot?.validation ?? fallback!
  const document = snapshot?.document ?? fallback!.document

  return {
    textareaRef,
    snapshot,
    document,
    validation,
    canSubmit: validation.valid,
    activeStyles: snapshot?.activeStyles ?? EMPTY_ACTIVE_STYLES,
    selection: snapshot?.selection ?? EMPTY_SELECTION,
    error: validation.errors[0] ?? null,
    isEmpty: validation.isEmpty,
    submit,
    clear,
    focus,
    setValue,
    insertText,
    insertLink,
    removeLink,
    toggleStyle,
    toggleBold,
    toggleItalic,
    toggleUnderline,
    toggleStrikethrough,
    toggleSpoiler,
    toggleCode,
    toggleCodeBlock,
    toggleQuote,
    getHtml,
  }
}

export type {
  ActiveStyles,
  ChangeEvent,
  EditorEventMap,
  EditorSnapshot,
  SelectionEvent,
  SelectionRange,
  SubmitOptions,
  SubmitPayload,
} from '../editor/types'
