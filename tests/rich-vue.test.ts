import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { RichTextarea } from '../src/vue'
import type { RichTextareaExpose } from '../src/vue'

describe('RichTextarea (Vue)', () => {
  it('renders the overlay and emits v-model updates', async () => {
    const wrapper = mount(RichTextarea, {
      props: {
        modelValue: 'Hello **world**',
        markers: 'hidden',
        placeholder: 'Message',
      },
    })
    await nextTick()

    const textarea = wrapper.get('textarea')
    expect((textarea.element as HTMLTextAreaElement).value).toBe('Hello **world**')
    expect(wrapper.find('.hte-bold').text()).toBe('world')
    expect(wrapper.get('.hte').attributes('data-markers')).toBe('hidden')

    await textarea.setValue('Hello *there*')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['Hello *there*'])
    await nextTick()
    expect(wrapper.find('.hte-italic').text()).toBe('there')
  })

  it('applies external model changes and toolbar commands', async () => {
    const wrapper = mount(RichTextarea, {
      props: { modelValue: 'hello' },
    })
    await nextTick()

    const textarea = wrapper.get('textarea').element as HTMLTextAreaElement
    textarea.focus()
    textarea.setSelectionRange(0, 5)

    const exposed = wrapper.vm as unknown as RichTextareaExpose
    exposed.editor?.toggleBold()
    await nextTick()
    expect(textarea.value).toBe('**hello**')
    expect(wrapper.find('.hte-bold').text()).toBe('hello')

    await wrapper.setProps({ modelValue: 'external' })
    await nextTick()
    expect(textarea.value).toBe('external')
    expect(wrapper.find('.hte-bold').exists()).toBe(false)
  })

  it('switches marker visibility', async () => {
    const wrapper = mount(RichTextarea, {
      props: { modelValue: '**bold**', markers: 'dim' },
    })
    await nextTick()

    await wrapper.setProps({ markers: 'visible' })
    await nextTick()
    expect(wrapper.get('.hte').attributes('data-markers')).toBe('visible')
  })
})
