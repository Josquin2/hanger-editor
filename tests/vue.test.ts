import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useMarkdownEditor, type UseMarkdownEditorReturn, type VueEditorOptions } from '../src/vue'

interface HarnessExposed {
  api: UseMarkdownEditorReturn
  getModel: () => string
  setModel: (value: string) => void
}

function createHarness(options: VueEditorOptions = {}, initial = '') {
  return defineComponent({
    setup(_, { expose }) {
      const textarea = ref<HTMLTextAreaElement | null>(null)
      const model = ref(initial)
      const api = useMarkdownEditor(textarea, model, options)
      expose({
        api,
        getModel: () => model.value,
        setModel: (next: string) => {
          model.value = next
        },
      })

      return () => h('div', [
        h('textarea', {
          ref: textarea,
          value: model.value,
          onInput: (event: Event) => {
            model.value = (event.target as HTMLTextAreaElement).value
          },
        }),
        h('span', { class: 'can-submit' }, String(api.canSubmit.value)),
        h('div', { class: 'html' }, api.getHtml()),
      ])
    },
  })
}

function exposed(wrapper: ReturnType<typeof mount>): HarnessExposed {
  return wrapper.vm as unknown as HarnessExposed
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('useMarkdownEditor (Vue)', () => {
  it('mounts against a textarea and exposes editor state', async () => {
    const wrapper = mount(createHarness({}, '**hello**'))
    await nextTick()

    const { getModel, api } = exposed(wrapper)
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('**hello**')
    expect(getModel()).toBe('**hello**')
    expect(api.canSubmit.value).toBe(true)
    expect(api.document.value?.text).toBe('hello')
    expect(wrapper.get('.can-submit').text()).toBe('true')
  })

  it('syncs user input to the model and validation state', async () => {
    const wrapper = mount(createHarness())
    await nextTick()
    const { getModel, api } = exposed(wrapper)
    const textarea = wrapper.get('textarea')

    await textarea.setValue('hello **world**')
    await nextTick()

    expect(getModel()).toBe('hello **world**')
    expect(api.canSubmit.value).toBe(true)
    expect(api.getHtml()).toBe('hello <strong>world</strong>')

    await textarea.setValue('   ')
    await nextTick()
    expect(api.canSubmit.value).toBe(false)
    expect(api.isEmpty.value).toBe(true)
    expect(wrapper.get('.can-submit').text()).toBe('false')
  })

  it('writes formatting commands back through v-model', async () => {
    const wrapper = mount(createHarness({}, 'hello'))
    await nextTick()
    const { getModel, api } = exposed(wrapper)
    const textarea = wrapper.get('textarea').element as HTMLTextAreaElement

    textarea.focus()
    textarea.setSelectionRange(0, 5)
    api.toggleBold()
    await nextTick()

    expect(textarea.value).toBe('**hello**')
    expect(getModel()).toBe('**hello**')
    expect(api.canSubmit.value).toBe(true)
    expect(api.activeStyles.value.bold).toBe(true)
  })

  it('applies external model changes to the textarea', async () => {
    const wrapper = mount(createHarness())
    await nextTick()
    const { setModel, api } = exposed(wrapper)
    const textarea = wrapper.get('textarea').element as HTMLTextAreaElement

    setModel('external **text**')
    await nextTick()
    await nextTick()

    expect(textarea.value).toBe('external **text**')
    expect(api.canSubmit.value).toBe(true)
    expect(api.getHtml()).toBe('external <strong>text</strong>')
  })

  it('submits on Enter when enabled', async () => {
    const onSubmit = vi.fn()
    const wrapper = mount(createHarness({ submitOnEnter: true, onSubmit }, 'hi'))
    await nextTick()
    const textarea = wrapper.get('textarea').element as HTMLTextAreaElement

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
    textarea.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      raw: 'hi',
      text: 'hi',
      html: 'hi',
    })
  })

  it('attaches when the textarea appears after the first render', async () => {
    let lateApi: UseMarkdownEditorReturn | null = null
    const LateHarness = defineComponent({
      setup() {
        const show = ref(false)
        const textarea = ref<HTMLTextAreaElement | null>(null)
        const model = ref('**hi**')
        const api = useMarkdownEditor(textarea, model)
        lateApi = api
        return () => h('div', [
          show.value
            ? h('textarea', { ref: textarea })
            : h('button', { onClick: () => { show.value = true } }, 'show'),
        ])
      },
    })

    const wrapper = mount(LateHarness)
    await wrapper.get('button').trigger('click')
    await nextTick()

    const element = wrapper.get('textarea').element as HTMLTextAreaElement
    expect(element.value).toBe('**hi**')
    expect(lateApi!.document.value.text).toBe('hi')
    expect(lateApi!.canSubmit.value).toBe(true)
  })

  it('renders validation state during SSR without touching the DOM', async () => {
    const App = defineComponent({
      setup() {
        const textarea = ref<HTMLTextAreaElement | null>(null)
        const model = ref('**hello**')
        const api = useMarkdownEditor(textarea, model)
        return () => h('div', [
          h('span', { class: 'ssr-can-submit' }, String(api.canSubmit.value)),
          h('textarea', { ref: textarea, value: model.value }),
        ])
      },
    })

    const html = await renderToString(createSSRApp(App))
    expect(html).toContain('<span class="ssr-can-submit">true</span>')
    expect(html).toContain('**hello**')
  })

  it('destroys the controller on unmount', async () => {
    const wrapper = mount(createHarness({}, 'hi'))
    await nextTick()
    const { api } = exposed(wrapper)
    const element = wrapper.get('textarea').element as HTMLTextAreaElement

    wrapper.unmount()
    expect(api.editor.value).toBeNull()
    expect(api.snapshot.value).toBeNull()

    element.value = 'after unmount'
    element.dispatchEvent(new Event('input', { bubbles: true }))
    expect(api.snapshot.value).toBeNull()
  })
})
