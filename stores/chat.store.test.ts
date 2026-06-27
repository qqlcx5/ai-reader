import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './chat.store'

describe('stores/chat.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should initialize with default values', () => {
    const store = useChatStore()
    expect(store.currentConversation).toBeNull()
    expect(store.inputText).toBe('')
    expect(store.isStreaming).toBe(false)
    expect(store.isSending).toBe(false)
  })

  it('should set input text', () => {
    const store = useChatStore()
    store.setInputText('Hello AI')
    expect(store.inputText).toBe('Hello AI')
  })

  it('should toggle streaming state', () => {
    const store = useChatStore()
    store.startStreaming()
    expect(store.isStreaming).toBe(true)
    store.stopStreaming()
    expect(store.isStreaming).toBe(false)
  })
})
