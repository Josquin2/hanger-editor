import { MarkdownEditor } from '../editor/editor'
import type { EditorOptions } from '../editor/types'

export { MarkdownEditor }
export { DEFAULT_MAX_LENGTH } from '../core/validate'

export type {
  ActiveStyles,
  ChangeEvent,
  CommandStyle,
  EditorEventMap,
  EditorOptions,
  EditorSnapshot,
  SelectionEvent,
  SelectionRange,
  SubmitOptions,
  SubmitPayload,
} from '../editor/types'

/** Convenience factory for vanilla JS consumers. */
export function createMarkdownEditor(
  textarea: HTMLTextAreaElement,
  options?: EditorOptions,
): MarkdownEditor {
  return new MarkdownEditor(textarea, options)
}
