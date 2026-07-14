import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Switch from './Switch.vue'

describe('Switch', () => {
  it('emits update:modelValue(false) when clicked while on', async () => {
    const wrapper = mount(Switch, { props: { modelValue: true } })

    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
  })

  it('emits update:modelValue(true) when clicked while off', async () => {
    const wrapper = mount(Switch, { props: { modelValue: false } })

    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('update:modelValue')![0]).toEqual([true])
  })

  it('reflects checked data-state from modelValue', () => {
    const on = mount(Switch, { props: { modelValue: true } })
    expect(on.find('button').attributes('data-state')).toBe('checked')

    const off = mount(Switch, { props: { modelValue: false } })
    expect(off.find('button').attributes('data-state')).toBe('unchecked')
  })

  it('does not emit update:modelValue when disabled', async () => {
    const wrapper = mount(Switch, { props: { modelValue: false, disabled: true } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeFalsy()
  })
})
