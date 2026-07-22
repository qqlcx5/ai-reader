import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatMessage from './ChatMessage.vue'
import type { ChatMessage as ChatMessageType } from '@/types/chat'

function makeMsg(overrides: Partial<ChatMessageType> = {}): ChatMessageType {
  return {
    id: 'msg-1',
    role: 'user',
    content: 'Hello',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('ChatMessage', () => {
  it('renders user message bubble with content', () => {
    const wrapper = mount(ChatMessage, {
      props: { message: makeMsg({ role: 'user', content: '你好世界' }) },
    })
    const bubble = wrapper.find('.bg-brand.text-white')
    expect(bubble.exists()).toBe(true)
    expect(bubble.text()).toBe('你好世界')
  })

  it('emits branch from the message action', async () => {
    const wrapper = mount(ChatMessage, {
      props: { message: makeMsg() },
    })
    await wrapper.find('button[title="从此处分支"]').trigger('click')
    expect(wrapper.emitted('branch')).toEqual([['msg-1']])
  })

  it('renders AI message bubble with AuraMind header', () => {
    const wrapper = mount(ChatMessage, {
      props: { message: makeMsg({ role: 'assistant', content: 'AI reply' }) },
    })
    expect(wrapper.text()).toContain('AuraMind')
    expect(wrapper.text()).toContain('AI reply')
  })

  it('shows model name in AI header when modelName prop provided', () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: makeMsg({ role: 'assistant', content: 'reply' }),
        modelName: 'GPT-4',
      },
    })
    expect(wrapper.text()).toContain('GPT-4')
  })

  it('shows streaming cursor when status is streaming', () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: makeMsg({ role: 'assistant', content: 'partial', status: 'streaming' }),
      },
    })
    expect(wrapper.find('.animate-pulse').exists()).toBe(true)
    expect(wrapper.text()).toContain('partial')
  })

  it('does not show collapse toggle for short user message', () => {
    const wrapper = mount(ChatMessage, {
      props: { message: makeMsg({ role: 'user', content: 'short' }) },
    })
    const bubble = wrapper.find('.bg-brand.text-white')
    expect(bubble.find('button').exists()).toBe(false)
  })

  it('renders failed state with error message', () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: makeMsg({
          role: 'assistant',
          content: 'partial answer',
          status: 'failed',
          error: 'Network timeout',
        }),
      },
    })
    expect(wrapper.text()).toContain('partial answer')
    expect(wrapper.text()).toContain('Network timeout')
    expect(wrapper.find('.text-red-600').exists()).toBe(true)
  })

  it('renders aborted state with stopped indicator', () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: makeMsg({ role: 'assistant', status: 'aborted' }),
      },
    })
    expect(wrapper.text()).toContain('已停止生成')
  })

  it('renders aborted state with partial content', () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: makeMsg({ role: 'assistant', content: 'partial', status: 'aborted' }),
      },
    })
    expect(wrapper.text()).toContain('partial')
    expect(wrapper.text()).toContain('已停止生成')
  })

  it('renders aborted with (stopped) placeholder text hidden', () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: makeMsg({ role: 'assistant', content: '(stopped)', status: 'aborted' }),
      },
    })
    expect(wrapper.text()).not.toContain('(stopped)')
    expect(wrapper.text()).toContain('已停止生成')
  })

  it('renders multi-line AI content correctly', () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: makeMsg({ role: 'assistant', content: 'Line 1\n\nLine 2\n\nLine 3' }),
      },
    })
    const paragraphs = wrapper.findAll('p')
    expect(paragraphs.length).toBeGreaterThanOrEqual(3)
  })

  it('applies correct classes for user message layout', () => {
    const wrapper = mount(ChatMessage, {
      props: { message: makeMsg({ role: 'user' }) },
    })
    expect(wrapper.find('.flex.justify-end').exists()).toBe(true)
  })

  it('applies red border for failed AI messages', () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: makeMsg({ role: 'assistant', status: 'failed', error: 'Err' }),
      },
    })
    expect(wrapper.find('.border-red-300').exists()).toBe(true)
  })
})
