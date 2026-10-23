<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  RichTextarea,
  type ActiveStyles,
  type ChangeEvent,
  type RichTextareaExpose,
  type SelectionEvent,
  type SubmitPayload,
} from 'hanger-editor/vue'
import type { MarkerVisibility } from 'hanger-editor/rich'

const SAMPLE = `**hanger-editor** renders formatted text while the value stays markdown.

Try _italic_, __underline__, ~~strikethrough~~, ||spoiler|| and \`inline code\`.
Select a word and press **Ctrl+B**.

> Quotes stay readable in the editor.

[Open the README](https://github.com/Josquin2/hanger-editor#readme)`

type PreviewTab = 'rendered' | 'markdown' | 'html' | 'text' | 'entities'
const TABS: ReadonlyArray<{ id: PreviewTab; label: string }> = [
  { id: 'rendered', label: 'Rendered' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'html', label: 'HTML' },
  { id: 'text', label: 'Text' },
  { id: 'entities', label: 'Entities' },
]

const editor = ref<RichTextareaExpose | null>(null)
const value = ref(SAMPLE)
const html = ref('')
const text = ref('')
const entities = ref('[]')
const entityCount = ref(0)
const length = ref(0)
const canSubmit = ref(false)
const errorCode = ref<string | null>(null)
const activeStyles = ref<ActiveStyles>({
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  spoiler: false,
  code: false,
  pre: false,
  quote: false,
})
const markers = ref<MarkerVisibility>('dim')
const tab = ref<PreviewTab>('rendered')
const notice = ref('')
const copied = ref(false)
let noticeTimer: number | undefined

const status = computed(() => {
  if (errorCode.value === 'EMPTY_MESSAGE') return 'Add something visible to send'
  if (errorCode.value === 'TOO_LONG') return 'Message is too long'
  if (errorCode.value) return errorCode.value
  return 'Ready to send'
})

const canSend = computed(() => canSubmit.value)

function showNotice(message: string): void {
  notice.value = message
  window.clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => {
    notice.value = ''
  }, 3200)
}

function applyChange(event: ChangeEvent): void {
  value.value = event.value
  length.value = event.validation.length
  canSubmit.value = event.canSubmit
  errorCode.value = event.validation.errors[0]?.code ?? null
  text.value = event.document.text
  entities.value = JSON.stringify(event.document.entities, null, 2)
  entityCount.value = event.document.entities.length
  html.value = editor.value?.editor?.getHtml() ?? ''
}

function syncFromEditor(): void {
  const instance = editor.value
  if (!instance?.editor) return

  const snapshot = instance.editor.getSnapshot()
  applyChange({
    value: snapshot.value,
    document: snapshot.document,
    validation: snapshot.validation,
    canSubmit: snapshot.canSubmit,
  })
  activeStyles.value = snapshot.activeStyles
}

function onSelection(event: SelectionEvent): void {
  activeStyles.value = event.activeStyles
}

function onSubmit(payload: SubmitPayload): void {
  showNotice(
    `Demo submit: ${payload.text.length} visible chars, `
    + `${payload.entities.length} entities. Nothing was sent.`,
  )
}

function run(command: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'spoiler' | 'code' | 'pre' | 'quote'): void {
  const instance = editor.value?.editor
  if (!instance) return

  switch (command) {
    case 'bold': instance.toggleBold(); break
    case 'italic': instance.toggleItalic(); break
    case 'underline': instance.toggleUnderline(); break
    case 'strikethrough': instance.toggleStrikethrough(); break
    case 'spoiler': instance.toggleSpoiler(); break
    case 'code': instance.toggleCode(); break
    case 'pre': instance.toggleCodeBlock(); break
    case 'quote': instance.toggleQuote(); break
  }
}

function insertLink(): void {
  const instance = editor.value?.editor
  if (!instance) return

  const url = window.prompt('Link URL', 'https://')
  if (!url) return
  if (!instance.insertLink(url.trim())) {
    showNotice('Use an http, https, mailto or tg link.')
  }
}

function send(): void {
  if (!editor.value?.submit()) return
  syncFromEditor()
}

function reset(): void {
  editor.value?.controller?.setValue(SAMPLE)
  editor.value?.focus()
}

function clear(): void {
  editor.value?.clear()
  editor.value?.focus()
}

async function copyHtml(): Promise<void> {
  try {
    await navigator.clipboard.writeText(html.value)
    copied.value = true
    window.setTimeout(() => {
      copied.value = false
    }, 1500)
  }
  catch {
    showNotice('Clipboard access was denied.')
  }
}

function selectTab(next: PreviewTab): void {
  tab.value = next
}

function onTabKeydown(event: KeyboardEvent, index: number): void {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
  event.preventDefault()
  const offset = event.key === 'ArrowRight' ? 1 : -1
  const next = TABS[(index + offset + TABS.length) % TABS.length]
  if (!next) return
  tab.value = next.id
  const buttons = document.querySelectorAll<HTMLButtonElement>('.playground__tab')
  buttons[TABS.indexOf(next)]?.focus()
}

onMounted(async () => {
  await nextTick()
  syncFromEditor()
})

onBeforeUnmount(() => {
  window.clearTimeout(noticeTimer)
})
</script>

<template>
  <div class="playground">
    <section class="playground__card composer" aria-label="Composer">
      <header class="playground__head">
        <div>
          <span class="playground__eyebrow">Composer</span>
          <strong>rich textarea</strong>
        </div>
        <label class="playground__markers">
          <span>Markers</span>
          <select v-model="markers">
            <option value="hidden">Hidden</option>
            <option value="dim">Dim</option>
            <option value="visible">Visible</option>
          </select>
        </label>
      </header>

      <div class="playground__toolbar" role="toolbar" aria-label="Formatting" @mousedown.prevent>
        <button
          type="button"
          class="playground__tool"
          :class="{ 'is-active': activeStyles.bold }"
          aria-label="Bold"
          :aria-pressed="activeStyles.bold"
          title="Bold (Ctrl/Cmd+B)"
          @click="run('bold')"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          class="playground__tool"
          :class="{ 'is-active': activeStyles.italic }"
          aria-label="Italic"
          :aria-pressed="activeStyles.italic"
          title="Italic (Ctrl/Cmd+I)"
          @click="run('italic')"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          class="playground__tool"
          aria-label="Underline"
          :aria-pressed="activeStyles.underline"
          title="Underline (Ctrl/Cmd+U)"
          @click="run('underline')"
        >
          <span class="underline">U</span>
        </button>
        <button
          type="button"
          class="playground__tool"
          aria-label="Strikethrough"
          :aria-pressed="activeStyles.strikethrough"
          title="Strikethrough (Ctrl/Cmd+Shift+X)"
          @click="run('strikethrough')"
        >
          <s>S</s>
        </button>
        <button
          type="button"
          class="playground__tool"
          aria-label="Spoiler"
          :aria-pressed="activeStyles.spoiler"
          title="Spoiler (Ctrl/Cmd+Shift+P)"
          @click="run('spoiler')"
        >
          SP
        </button>
        <span class="playground__divider" aria-hidden="true" />
        <button
          type="button"
          class="playground__tool mono"
          aria-label="Inline code"
          :aria-pressed="activeStyles.code"
          title="Inline code (Ctrl/Cmd+E)"
          @click="run('code')"
        >
          &lt;/&gt;
        </button>
        <button
          type="button"
          class="playground__tool mono"
          aria-label="Code block"
          :aria-pressed="activeStyles.pre"
          title="Code block (Ctrl/Cmd+Shift+E)"
          @click="run('pre')"
        >
          { }
        </button>
        <button
          type="button"
          class="playground__tool"
          aria-label="Quote"
          :aria-pressed="activeStyles.quote"
          title="Quote (Ctrl/Cmd+Shift+Q)"
          @click="run('quote')"
        >
          ❝
        </button>
        <button
          type="button"
          class="playground__tool text"
          aria-label="Insert link"
          @click="insertLink"
        >
          Link
        </button>
      </div>

      <RichTextarea
        ref="editor"
        v-model="value"
        class="playground__editor"
        :markers="markers"
        placeholder="Write a message with **markdown**…"
        :max-length="4096"
        submit-on-enter
        :min-height="150"
        :max-height="300"
        aria-label="Markdown message"
        @change="applyChange"
        @selection="onSelection"
        @submit="onSubmit"
      />

      <footer class="playground__foot">
        <div class="playground__state">
          <span class="playground__status" :data-invalid="errorCode ? 'true' : undefined">
            {{ status }}
          </span>
          <span class="playground__count">{{ length }} / 4096</span>
        </div>
        <div class="playground__actions">
          <button type="button" class="playground__button" @click="reset">Reset</button>
          <button type="button" class="playground__button" @click="clear">Clear</button>
          <button
            type="button"
            class="playground__button primary"
            :disabled="!canSend"
            @click="send"
          >
            Send
          </button>
        </div>
      </footer>
      <p v-if="notice" class="playground__notice" role="status">{{ notice }}</p>
    </section>

    <section class="playground__card preview" aria-label="Parser output">
      <div class="playground__tabs" role="tablist" aria-label="Preview format">
        <button
          v-for="(item, index) in TABS"
          :key="item.id"
          :id="`playground-tab-${item.id}`"
          type="button"
          role="tab"
          class="playground__tab"
          :aria-controls="`playground-panel-${item.id}`"
          :aria-selected="tab === item.id"
          :tabindex="tab === item.id ? 0 : -1"
          @click="selectTab(item.id)"
          @keydown="onTabKeydown($event, index)"
        >
          {{ item.label }}
        </button>
      </div>

      <div class="playground__panels">
        <div
          v-show="tab === 'rendered'"
          id="playground-panel-rendered"
          class="playground__rendered"
          role="tabpanel"
          aria-labelledby="playground-tab-rendered"
        >
          <div v-if="html" v-html="html" />
          <p v-else class="playground__empty">Rendered output will appear here.</p>
        </div>
        <pre
          v-show="tab === 'markdown'"
          id="playground-panel-markdown"
          class="playground__code"
          role="tabpanel"
          aria-labelledby="playground-tab-markdown"
        ><code>{{ value || '(empty)' }}</code></pre>
        <pre
          v-show="tab === 'html'"
          id="playground-panel-html"
          class="playground__code"
          role="tabpanel"
          aria-labelledby="playground-tab-html"
        ><code>{{ html || '<!-- empty -->' }}</code></pre>
        <pre
          v-show="tab === 'text'"
          id="playground-panel-text"
          class="playground__code"
          role="tabpanel"
          aria-labelledby="playground-tab-text"
        ><code>{{ text || '(no visible text)' }}</code></pre>
        <pre
          v-show="tab === 'entities'"
          id="playground-panel-entities"
          class="playground__code"
          role="tabpanel"
          aria-labelledby="playground-tab-entities"
        ><code>{{ entities }}</code></pre>
      </div>

      <footer class="playground__foot">
        <span class="playground__count">
          {{ entityCount }} {{ entityCount === 1 ? 'entity' : 'entities' }}
        </span>
        <div class="playground__state">
          <span class="playground__count">{{ canSend ? 'valid' : 'invalid' }}</span>
          <button type="button" class="playground__copy" @click="copyHtml">
            {{ copied ? 'Copied' : 'Copy HTML' }}
          </button>
        </div>
      </footer>
    </section>
  </div>

  <p class="playground__hint">
    The textarea stores markdown; the formatted layer underneath uses the same
    box metrics. Delimiters keep their advance width, which is what keeps the
    native caret aligned. Use the Markers switch to compare the display modes.
  </p>
</template>

<style scoped>
.playground {
  display: grid;
  grid-template-columns: minmax(0, 1.06fr) minmax(0, 0.94fr);
  gap: 16px;
  margin-top: 20px;
  align-items: start;
}

.playground__card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}

.playground__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 14px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.playground__head strong {
  display: block;
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  font-weight: 600;
}

.playground__eyebrow {
  display: block;
  margin-bottom: 1px;
  color: var(--vp-c-text-3);
  font-family: var(--vp-font-family-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.playground__markers {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--vp-c-text-3);
  font-size: 11px;
}

.playground__markers select {
  padding: 3px 20px 3px 7px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  font-size: 11px;
}

.playground__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  padding: 7px 10px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.playground__tool {
  display: inline-grid;
  min-width: 30px;
  height: 29px;
  place-items: center;
  padding: 0 7px;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: var(--vp-c-text-2);
  font-size: 12px;
  cursor: pointer;
}

.playground__tool:hover {
  border-color: var(--vp-c-divider);
  background: var(--vp-c-bg-alt);
  color: var(--vp-c-text-1);
}

.playground__tool.is-active {
  border-color: var(--vp-c-brand-soft);
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

.playground__tool.mono {
  font-family: var(--vp-font-family-mono);
  font-size: 10px;
}

.playground__tool.text {
  font-size: 11px;
}

.playground__divider {
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: var(--vp-c-divider);
}

.playground__editor :deep(.hte) {
  border: 0;
  border-radius: 0;
  background: var(--vp-c-bg);
}

.playground__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 14px;
  border-top: 1px solid var(--vp-c-divider);
}

.playground__state {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.playground__status {
  color: var(--vp-c-brand-1);
  font-size: 11px;
}

.playground__status[data-invalid="true"] {
  color: var(--vp-c-danger-1);
}

.playground__count {
  color: var(--vp-c-text-3);
  font-family: var(--vp-font-family-mono);
  font-size: 10px;
}

.playground__actions {
  display: flex;
  gap: 5px;
  margin-left: auto;
}

.playground__button {
  padding: 4px 9px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 5px;
  background: transparent;
  color: var(--vp-c-text-2);
  font-size: 11px;
  cursor: pointer;
}

.playground__button:hover {
  border-color: var(--vp-c-text-3);
  color: var(--vp-c-text-1);
}

.playground__button.primary {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-1);
  color: var(--vp-c-bg);
}

.playground__button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.playground__notice {
  margin: 0;
  padding: 9px 14px;
  border-top: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-2);
  font-size: 11px;
}

.playground__tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 5px 8px;
  border-bottom: 1px solid var(--vp-c-divider);
  overflow-x: auto;
}

.playground__tab {
  padding: 5px 7px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--vp-c-text-3);
  font-family: var(--vp-font-family-mono);
  font-size: 10px;
  cursor: pointer;
  white-space: nowrap;
}

.playground__tab:hover {
  color: var(--vp-c-text-1);
}

.playground__tab[aria-selected="true"] {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

.playground__copy {
  padding: 3px 7px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 5px;
  background: transparent;
  color: var(--vp-c-text-3);
  font-size: 10px;
  cursor: pointer;
  white-space: nowrap;
}

.playground__copy:hover {
  border-color: var(--vp-c-text-3);
  color: var(--vp-c-text-1);
}

.playground__panels {
  min-height: 380px;
  background: var(--vp-c-bg);
}

.playground__rendered {
  padding: 16px;
  color: var(--vp-c-text-1);
  font-size: 13px;
  line-height: 1.75;
  overflow-wrap: anywhere;
}

.playground__rendered :deep(blockquote) {
  margin: 12px 0;
  padding-left: 12px;
  border-left: 3px solid var(--vp-c-brand-1);
  color: var(--vp-c-text-2);
}

.playground__rendered :deep(pre) {
  margin: 12px 0;
  padding: 12px;
  overflow-x: auto;
  border: 1px solid var(--vp-c-divider);
  border-radius: 7px;
  background: var(--vp-c-bg-alt);
  font-size: 12px;
  line-height: 1.6;
}

.playground__rendered :deep(code) {
  padding: 1px 4px;
  border-radius: 4px;
  background: var(--vp-c-default-soft);
  font-size: 0.92em;
}

.playground__rendered :deep(pre code) {
  padding: 0;
  background: transparent;
}

.playground__rendered :deep(a) {
  color: var(--vp-c-brand-1);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.playground__empty {
  margin: 0;
  color: var(--vp-c-text-3);
  font-style: italic;
}

.playground__code {
  max-height: 380px;
  margin: 0;
  padding: 14px 16px;
  overflow: auto;
  color: var(--vp-c-text-2);
  font-family: var(--vp-font-family-mono);
  font-size: 11.5px;
  line-height: 1.65;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.playground__hint {
  max-width: 760px;
  margin: 16px 0 0;
  color: var(--vp-c-text-3);
  font-size: 12px;
  line-height: 1.65;
}

@media (max-width: 900px) {
  .playground {
    grid-template-columns: minmax(0, 1fr);
  }

  .playground__panels {
    min-height: 280px;
  }
}
</style>
