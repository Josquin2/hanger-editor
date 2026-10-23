import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type PropType,
} from 'vue'
import type { MarkdownEditor } from '../editor/editor'
import type {
  ChangeEvent,
  SelectionEvent,
  SubmitPayload,
} from '../editor/types'
import type { HtmlRenderOptions } from '../core/render-html'
import {
  createRichTextarea,
  type MarkerVisibility,
  type RichTextareaController,
} from '../rich/rich-textarea'

export interface RichTextareaExpose {
  readonly controller: RichTextareaController | null
  readonly editor: MarkdownEditor | null
  focus: () => void
  clear: () => void
  submit: () => SubmitPayload | null
  setMarkers: (markers: MarkerVisibility) => void
}

/**
 * Vue wrapper for the overlay editor. The stylesheet is a separate import:
 *
 * ```ts
 * import 'hanger-editor/rich-textarea.css'
 * ```
 */
export const RichTextarea = defineComponent({
  name: 'HangerRichTextarea',
  props: {
    modelValue: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    markers: {
      type: String as PropType<MarkerVisibility>,
      default: 'dim',
    },
    maxLength: { type: Number, default: undefined },
    allowEmpty: { type: Boolean, default: false },
    submitOnEnter: { type: Boolean, default: false },
    autoContinueQuote: { type: Boolean, default: true },
    shortcuts: { type: Boolean, default: true },
    minHeight: { type: Number, default: undefined },
    maxHeight: { type: Number, default: undefined },
    ariaLabel: { type: String, default: '' },
    spellcheck: { type: Boolean, default: true },
    html: {
      type: Object as PropType<HtmlRenderOptions>,
      default: undefined,
    },
  },
  emits: {
    'update:modelValue': (value: string) => typeof value === 'string',
    change: (event: ChangeEvent) => typeof event.value === 'string',
    selection: (event: SelectionEvent) => typeof event.selection.start === 'number',
    submit: (payload: SubmitPayload) => typeof payload.raw === 'string',
  },
  setup(props, { emit, expose }) {
    const host = ref<HTMLElement | null>(null)
    let controller: RichTextareaController | null = null

    const create = (): void => {
      if (!host.value || controller) return

      controller = createRichTextarea(host.value, {
        value: props.modelValue,
        placeholder: props.placeholder,
        markers: props.markers,
        maxLength: props.maxLength,
        allowEmpty: props.allowEmpty,
        submitOnEnter: props.submitOnEnter,
        autoContinueQuote: props.autoContinueQuote,
        shortcuts: props.shortcuts,
        minHeight: props.minHeight,
        maxHeight: props.maxHeight,
        ariaLabel: props.ariaLabel || undefined,
        spellcheck: props.spellcheck,
        html: props.html,
        onChange: (event) => {
          emit('update:modelValue', event.value)
          emit('change', event)
        },
        onSelectionChange: (event) => emit('selection', event),
        onSubmit: (payload) => emit('submit', payload),
      })
    }

    onMounted(create)

    watch(() => props.modelValue, (value) => {
      if (controller && controller.value !== value) {
        controller.setValue(value, { emit: false })
      }
    })

    watch(() => props.markers, (value) => {
      controller?.setMarkers(value)
    })

    watch(() => props.placeholder, (value) => {
      controller?.setPlaceholder(value)
    })

    onBeforeUnmount(() => {
      controller?.destroy()
      controller = null
    })

    expose({
      get controller(): RichTextareaController | null {
        return controller
      },
      get editor(): MarkdownEditor | null {
        return controller?.editor ?? null
      },
      focus: (): void => controller?.focus(),
      clear: (): void => controller?.clear(),
      submit: (): SubmitPayload | null => controller?.submit() ?? null,
      setMarkers: (markers: MarkerVisibility): void => controller?.setMarkers(markers),
    } satisfies RichTextareaExpose)

    return () => h('div', { ref: host })
  },
})
