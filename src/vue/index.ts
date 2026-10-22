import {
  computed,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  watch,
  type ComputedRef,
  type Ref,
  type ShallowRef,
} from 'vue'
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

export type VueEditorOptions = Omit<EditorOptions, 'value'>

export interface UseMarkdownEditorReturn {
  /** The underlying controller. Null until the textarea is mounted. */
  editor: ShallowRef<MarkdownEditor | null>
  snapshot: ShallowRef<EditorSnapshot | null>
  document: ComputedRef<ParsedMessage>
  validation: ComputedRef<ValidationResult>
  canSubmit: ComputedRef<boolean>
  activeStyles: ComputedRef<ActiveStyles>
  selection: ComputedRef<SelectionRange>
  error: ComputedRef<ValidationError | null>
  isEmpty: ComputedRef<boolean>
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

/**
 * Binds the markdown editor to a textarea and a Vue ref.
 *
 * The composable keeps the model in sync in both directions. A `v-model` on
 * the same textarea is optional but harmless; it makes the initial render and
 * SSR straightforward.
 */
export function useMarkdownEditor(
  textarea: Ref<HTMLTextAreaElement | null>,
  model: Ref<string>,
  options: VueEditorOptions = {},
): UseMarkdownEditorReturn {
  const editor = shallowRef<MarkdownEditor | null>(null)
  const snapshot = shallowRef<EditorSnapshot | null>(null)

  let instance: MarkdownEditor | null = null
  let attachedElement: HTMLTextAreaElement | null = null
  let unsubscribers: Array<() => void> = []
  let mounted = false

  const refresh = (): void => {
    if (!instance) return
    snapshot.value = instance.getSnapshot()
  }

  const teardown = (): void => {
    for (const unsubscribe of unsubscribers) unsubscribe()
    unsubscribers = []
    instance?.destroy()
    instance = null
    editor.value = null
    attachedElement = null
    snapshot.value = null
  }

  const attach = (): void => {
    const element = textarea.value
    if (!element || instance) return

    const callbacks = {
      onChange: (event: ChangeEvent): void => {
        if (model.value !== event.value) model.value = event.value
        options.onChange?.(event)
      },
      onSelectionChange: (event: SelectionEvent): void => {
        options.onSelectionChange?.(event)
      },
    }

    const controller = new MarkdownEditor(element, {
      ...options,
      value: model.value,
      ...callbacks,
    })
    instance = controller
    attachedElement = element
    editor.value = controller
    unsubscribers = [
      controller.on('change', refresh),
      controller.on('selection', refresh),
    ]
    refresh()
  }

  onMounted(() => {
    mounted = true
    attach()
  })

  watch(textarea, (element) => {
    if (!mounted) return
    if (element === attachedElement) return
    teardown()
    attach()
  }, { flush: 'post' })

  watch(model, (value) => {
    if (!instance) return
    if (instance.value === value) return
    instance.setValue(value, { emit: false })
    refresh()
  })

  onBeforeUnmount(() => {
    mounted = false
    teardown()
  })

  const activeStyles = computed<ActiveStyles>(() => {
    return snapshot.value?.activeStyles ?? createEmptyActiveStyles()
  })

  const document = computed(() => {
    return snapshot.value?.document ?? parseMessage(model.value)
  })
  const validation = computed(() => {
    return snapshot.value?.validation ?? validateMessage(model.value, {
      maxLength: options.maxLength,
      allowEmpty: options.allowEmpty,
    })
  })
  const canSubmit = computed(() => validation.value.valid)
  const selection = computed<SelectionRange>(() => {
    return snapshot.value?.selection ?? { start: 0, end: 0 }
  })
  const error = computed(() => validation.value.errors[0] ?? null)
  const isEmpty = computed(() => validation.value.isEmpty)

  return {
    editor,
    snapshot,
    document,
    validation,
    canSubmit,
    activeStyles,
    selection,
    error,
    isEmpty,
    submit: (submitOptions) => editor.value?.submit(submitOptions) ?? null,
    clear: () => {
      if (editor.value) editor.value.clear()
      else model.value = ''
    },
    focus: () => editor.value?.focus(),
    setValue: (value) => {
      if (editor.value) editor.value.setValue(value)
      else model.value = value
    },
    insertText: (text) => editor.value?.insertText(text),
    insertLink: (url, label) => editor.value?.insertLink(url, label) ?? false,
    removeLink: () => editor.value?.removeLink() ?? false,
    toggleStyle: (style) => editor.value?.toggleStyle(style),
    toggleBold: () => editor.value?.toggleBold(),
    toggleItalic: () => editor.value?.toggleItalic(),
    toggleUnderline: () => editor.value?.toggleUnderline(),
    toggleStrikethrough: () => editor.value?.toggleStrikethrough(),
    toggleSpoiler: () => editor.value?.toggleSpoiler(),
    toggleCode: () => editor.value?.toggleCode(),
    toggleCodeBlock: (language = '') => editor.value?.toggleCodeBlock(language),
    toggleQuote: () => editor.value?.toggleQuote(),
    getHtml: (htmlOptions) => {
      if (editor.value) return editor.value.getHtml(htmlOptions)
      return renderHtml(document.value, htmlOptions)
    },
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
