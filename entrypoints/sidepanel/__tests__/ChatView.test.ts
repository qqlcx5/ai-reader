// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChatView from '../views/ChatView.vue'

describe('ChatView — Component Structure', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
  })

  function createWrapper() {
    return mount(ChatView, {
      global: {
        stubs: {
          Sparkles: { template: '<svg />' },
          ChevronDown: { template: '<svg />' },
          Play: { template: '<svg />' },
          Square: { template: '<svg />' },
          Copy: { template: '<svg />' },
          Send: { template: '<svg />' },
          Trash2: { template: '<svg />' },
        },
      },
    })
  }

  it('renders the model selector dropdown', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('智能体模型')
    expect(wrapper.text()).toContain('DeepSeek Chat')
  })

  it('renders the workflow selector dropdown', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('消化工作流')
    expect(wrapper.text()).toContain('TL;DR')
  })

  it('renders the "Run AI Analysis" button initially', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('一键运行 AI 分析')
  })

  it('renders the placeholder state when idle', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('选择工作流，一键智能化解析')
  })

  it('renders the input box and send button', () => {
    const wrapper = createWrapper()
    expect(wrapper.find('input').exists()).toBe(true)
    expect(wrapper.find('button').exists()).toBe(true)
  })

  it('renders status indicator', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('空闲')
  })

  it('renders clear context button', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('清除上下文')
  })

  it('renders copy summary button', () => {
    const wrapper = createWrapper()
    const copyBtn = wrapper.find('[title="复制总结"]')
    expect(copyBtn.exists()).toBe(true)
  })
})
