import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UTextarea from './UTextarea.vue'

describe('UTextarea', () => {
  it('renders a native textarea reflecting modelValue', () => {
    const wrapper = mount(UTextarea, { props: { modelValue: 'line1' } })
    expect(wrapper.element.tagName).toBe('TEXTAREA')
    expect((wrapper.element as HTMLTextAreaElement).value).toBe('line1')
  })

  it('emits update:modelValue when typing', async () => {
    const wrapper = mount(UTextarea, { props: { modelValue: '' } })
    await wrapper.find('textarea').setValue('new content')
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual(['new content'])
  })

  it('applies rows attribute', () => {
    const wrapper = mount(UTextarea, { props: { rows: 5 } })
    expect(wrapper.attributes('rows')).toBe('5')
  })

  it('defaults rows to 3', () => {
    const wrapper = mount(UTextarea)
    expect(wrapper.attributes('rows')).toBe('3')
  })

  it('forwards placeholder', () => {
    const wrapper = mount(UTextarea, { props: { placeholder: '输入...' } })
    expect(wrapper.attributes('placeholder')).toBe('输入...')
  })
})
