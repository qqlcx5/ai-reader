import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UInput from './UInput.vue'

describe('UInput', () => {
  it('renders a native input reflecting modelValue', () => {
    const wrapper = mount(UInput, { props: { modelValue: 'hello' } })
    expect(wrapper.element.tagName).toBe('INPUT')
    expect((wrapper.element as HTMLInputElement).value).toBe('hello')
  })

  it('emits update:modelValue when typing', async () => {
    const wrapper = mount(UInput, { props: { modelValue: '' } })
    await wrapper.find('input').setValue('typed text')
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual(['typed text'])
  })

  it('forwards type and placeholder attributes', () => {
    const wrapper = mount(UInput, {
      props: { type: 'password', placeholder: 'sk-...' },
    })
    expect(wrapper.attributes('type')).toBe('password')
    expect(wrapper.attributes('placeholder')).toBe('sk-...')
  })

  it('defaults type to text', () => {
    const wrapper = mount(UInput)
    expect(wrapper.attributes('type')).toBe('text')
  })
})
