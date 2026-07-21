import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import AssistantMenu from './AssistantMenu.vue'
import type { AssistantMenuItem } from './AssistantMenu.vue'

const items: AssistantMenuItem[] = [
  { key: 'quickread', label: 'AI 速读' },
  { key: 'capture', label: '抓取' },
  { key: 'workspace', label: '工作区' },
]

describe('AssistantMenu', () => {
  it('renders only the trigger ball when closed', () => {
    const wrapper = mount(AssistantMenu, { props: { items } })
    expect(wrapper.find('[data-assistant-trigger]').exists()).toBe(true)
    // Card not present until opened
    expect(wrapper.findAll('button').length).toBe(1)
  })

  it('opens on trigger click and renders primary + secondary rows', async () => {
    const wrapper = mount(AssistantMenu, { props: { items } })
    await wrapper.find('[data-assistant-trigger]').trigger('click')
    // primary (quickread) + 2 secondary = 3 action buttons + 1 trigger
    expect(wrapper.findAll('button').length).toBe(4)
    expect(wrapper.text()).toContain('AI 速读')
    expect(wrapper.text()).toContain('抓取')
  })

  it('emits select with the picked item', async () => {
    const wrapper = mount(AssistantMenu, { props: { items } })
    await wrapper.find('[data-assistant-trigger]').trigger('click')
    // Secondary buttons appear after primary; click the workspace one.
    const buttons = wrapper.findAll('button')
    await buttons[buttons.length - 1].trigger('click')
    expect(wrapper.emitted('select')).toBeTruthy()
    const emitted = wrapper.emitted('select')![0][0] as AssistantMenuItem
    expect(emitted.key).toBe('workspace')
  })

  it('ignores click on disabled item', async () => {
    const disabledItems: AssistantMenuItem[] = [
      { key: 'quickread', label: 'AI 速读', disabled: true },
    ]
    const wrapper = mount(AssistantMenu, { props: { items: disabledItems } })
    await wrapper.find('[data-assistant-trigger]').trigger('click')
    await wrapper.find('button:not([data-assistant-trigger])').trigger('click')
    expect(wrapper.emitted('select')).toBeFalsy()
  })

  it('opens card on hover (mouseenter)', async () => {
    const wrapper = mount(AssistantMenu, { props: { items } })
    await wrapper.trigger('mouseenter')
    await nextTick()
    expect(wrapper.text()).toContain('AI 速读')
  })
})
