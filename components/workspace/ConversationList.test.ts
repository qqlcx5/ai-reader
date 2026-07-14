import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ConversationList from './ConversationList.vue'
import { useChatStore } from '@/stores/chat.store'
import type { ConversationEntity } from '@/types/chat'

// Mock ChatRepository so loadConversations etc don't hit IndexedDB
vi.mock('@/db/repositories/chat.repository', () => ({
  ChatRepository: {
    findById: vi.fn(),
    findAll: vi.fn(),
    findByDocumentId: vi.fn(async () => []),
    save: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/services/search', () => ({
  addToIndex: vi.fn(),
  removeFromIndex: vi.fn(),
  replaceInIndex: vi.fn(),
  initSearchIndex: vi.fn().mockResolvedValue(undefined),
}))

function makeConv(overrides: Partial<ConversationEntity> = {}): ConversationEntity {
  return {
    id: 'c1',
    documentId: 'doc-1',
    title: 'Test Conversation',
    messages: [
      { id: 'm1', role: 'user', content: 'Hello', status: 'success', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'm2', role: 'assistant', content: 'Hi there!', status: 'success', createdAt: '2026-01-01T00:00:01.000Z' },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('ConversationList', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders the "会话" header with count', () => {
    const store = useChatStore()
    store.conversations = [makeConv(), makeConv({ id: 'c2' })]

    const wrapper = mount(ConversationList)
    expect(wrapper.text()).toContain('会话')
    expect(wrapper.text()).toContain('2')
  })

  it('renders "新建" button', () => {
    const wrapper = mount(ConversationList)
    expect(wrapper.text()).toContain('新建')
  })

  it('renders conversation items with title', () => {
    const store = useChatStore()
    store.conversations = [makeConv({ title: 'My Chat' })]

    const wrapper = mount(ConversationList)
    expect(wrapper.text()).toContain('My Chat')
  })

  it('highlights active conversation', () => {
    const store = useChatStore()
    store.conversations = [
      makeConv({ id: 'c1', title: 'Active One' }),
      makeConv({ id: 'c2', title: 'Inactive' }),
    ]
    store.currentConversationId = 'c1'

    const wrapper = mount(ConversationList)

    const activeButtons = wrapper.findAll('.bg-brand\\/10')
    expect(activeButtons.length).toBe(1)
  })

  it('shows message count per conversation', () => {
    const store = useChatStore()
    store.conversations = [makeConv({ messages: [
      { id: 'm1', role: 'user', content: 'A', status: 'success', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'm2', role: 'assistant', content: 'B', status: 'success', createdAt: '2026-01-01T00:00:01.000Z' },
      { id: 'm3', role: 'user', content: 'C', status: 'success', createdAt: '2026-01-01T00:00:02.000Z' },
    ] })]

    const wrapper = mount(ConversationList)
    expect(wrapper.text()).toContain('3')
  })

  it('shows empty state when no conversations', () => {
    const store = useChatStore()
    store.conversations = []

    const wrapper = mount(ConversationList)
    expect(wrapper.text()).toContain('暂无会话')
  })
})
