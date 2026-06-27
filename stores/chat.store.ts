import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ChatRepository } from '../db/repositories/chat.repository'
import type { ConversationEntity, ChatMessage } from '../types/chat'

export const useChatStore = defineStore('chat', () => {
  const currentConversation = ref<ConversationEntity | null>(null)
  const inputText = ref('')
  const isStreaming = ref(false)
  const isSending = ref(false)

  function setInputText(text: string) {
    inputText.value = text
  }

  async function sendMessage(content: string) {
    if (!currentConversation.value || !content.trim()) return
    isSending.value = true
    try {
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
        status: 'success',
      }
      currentConversation.value.messages.push(message)
      currentConversation.value.updatedAt = new Date().toISOString()
      await ChatRepository.save(currentConversation.value)
    } finally {
      isSending.value = false
      inputText.value = ''
    }
  }

  async function startStreaming() {
    isStreaming.value = true
  }

  function stopStreaming() {
    isStreaming.value = false
  }

  async function loadConversation(id: string) {
    const conv = await ChatRepository.findById(id)
    if (conv) currentConversation.value = conv
  }

  async function createConversation(documentId: string, title?: string) {
    const conv: ConversationEntity = {
      id: crypto.randomUUID(),
      documentId,
      title,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await ChatRepository.save(conv)
    currentConversation.value = conv
    return conv
  }

  async function deleteConversation(id: string) {
    await ChatRepository.delete(id)
    if (currentConversation.value?.id === id) currentConversation.value = null
  }

  return {
    currentConversation,
    inputText,
    isStreaming,
    isSending,
    setInputText,
    sendMessage,
    startStreaming,
    stopStreaming,
    loadConversation,
    createConversation,
    deleteConversation,
  }
})
