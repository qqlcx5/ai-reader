import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UButton from './UButton.vue'

describe('UButton', () => {
  it('renders a native button with default variant and size', () => {
    const wrapper = mount(UButton)
    expect(wrapper.element.tagName).toBe('BUTTON')
    expect(wrapper.classes()).toContain('bg-zinc-100') // secondary
    expect(wrapper.attributes('type')).toBe('button')
  })

  it('applies primary variant class', () => {
    const wrapper = mount(UButton, { props: { variant: 'primary' } })
    expect(wrapper.classes()).toContain('bg-brand')
    expect(wrapper.classes()).toContain('text-white')
  })

  it('applies size sm class', () => {
    const wrapper = mount(UButton, { props: { size: 'sm' } })
    expect(wrapper.classes()).toContain('text-[11px]')
  })

  it('forwards type attribute', () => {
    const wrapper = mount(UButton, { props: { type: 'submit' } })
    expect(wrapper.attributes('type')).toBe('submit')
  })

  it('emits click when clicked', async () => {
    const wrapper = mount(UButton)
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()
    expect(wrapper.emitted('click')!.length).toBe(1)
  })

  it('disables the native button and blocks clicks', async () => {
    const wrapper = mount(UButton, { props: { disabled: true } })
    expect(wrapper.attributes('disabled')).toBeDefined()
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeFalsy()
  })

  it('renders slot content', () => {
    const wrapper = mount(UButton, { slots: { default: '提交' } })
    expect(wrapper.text()).toContain('提交')
  })
})
