/**
 * M4 会话 Store — URL 绑定与会话隔离
 *
 * loadOrCreate(pageId): 从 M8 主表读取 ConversationRecord；
 *   不存在则创建新记录（需要 ExtractionResult 信息）。
 * currentPageId: 当前锚定页面的 SHA-256 pageId，响应式。
 *
 * 切换 Tab 时不自动切换对话（静默锚定，由 context.store 维护）。
 */

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { ConversationRecord, MessageRecord, ChatMessage } from '@/lib/db/types'
import { conversationRepo } from '@/lib/db/repositories/conversation.repo'
import { messageRepo } from '@/lib/db/repositories/message.repo'
import { hashUrl } from '@/lib/chat/url-key'

export const useConversationStore = defineStore('conversation', () => {
  /** 当前锚定页面的 pageId（SHA-256 of normalizedUrl） */
  const currentPageId = ref<string | null>(null)

  /** 当前 ConversationRecord（主表元数据） */
  const currentConversation = ref<ConversationRecord | null>(null)

  /** 当前 MessageRecord（副表，含 chatHistory） */
  const currentMessages = ref<MessageRecord | null>(null)

  const isLoading = ref(false)

  const hasConversation = computed(() => currentConversation.value !== null)

  const chatHistory = computed<ChatMessage[]>(() => currentMessages.value?.chatHistory ?? [])

  // ─── 操作 ─────────────────────────────────────────────────────────────────

  /**
   * 根据 pageId 加载或创建会话。
   * - 已存在：从 M8 加载 ConversationRecord + MessageRecord
   * - 不存在：创建新的 ConversationRecord（副表在首次发消息时创建）
   */
  async function loadOrCreate(
    pageId: string,
    seedData?: {
      url: string
      title?: string
      favicon?: string
      domain?: string
      wordCount?: number
      engine?: 'readability' | 'defuddle' | 'fallback'
      rawText?: string
      metadata?: object
    },
  ): Promise<ConversationRecord> {
    isLoading.value = true
    currentPageId.value = pageId

    try {
      const existing = await conversationRepo.findById(pageId)

      if (existing) {
        currentConversation.value = existing
        // 懒加载副表（仅在有会话时加载）
        const msgRecord = await messageRepo.loadById(pageId)
        currentMessages.value = msgRecord ?? null
        return existing
      }

      // 创建新记录
      const now = Date.now()
      const record: ConversationRecord = {
        id: pageId,
        url: seedData?.url ?? '',
        title: seedData?.title ?? '未命名页面',
        favicon: seedData?.favicon ?? '',
        domain: seedData?.domain ?? '',
        createdAt: now,
        updatedAt: now,
        wordCount: seedData?.wordCount ?? 0,
        engine: seedData?.engine ?? 'fallback',
        messageCount: 0,
        models: [],
      }
      await conversationRepo.create(record)

      // 初始化副表（rawText 在首次发消息时写入）
      if (seedData?.rawText !== undefined) {
        const msgRecord: MessageRecord = {
          id: pageId,
          rawText: seedData.rawText,
          metadata: {},
          chatHistory: [],
        }
        await messageRepo.save(msgRecord)
        currentMessages.value = msgRecord
      } else {
        currentMessages.value = null
      }

      currentConversation.value = record
      return record
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 从 URL 字符串计算 pageId 并加载/创建会话。
   */
  async function loadOrCreateByUrl(
    url: string,
    seedData?: Parameters<typeof loadOrCreate>[1],
  ): Promise<ConversationRecord> {
    const pageId = await hashUrl(url)
    return loadOrCreate(pageId, { url, ...seedData })
  }

  /**
   * 追加一条消息到 chatHistory（同时更新主表元数据）。
   */
  async function appendMessage(msg: ChatMessage): Promise<void> {
    const pageId = currentPageId.value
    if (!pageId) return

    // 确保副表存在
    let msgRecord = await messageRepo.loadById(pageId)
    if (!msgRecord) {
      msgRecord = { id: pageId, rawText: '', metadata: {}, chatHistory: [] }
      await messageRepo.save(msgRecord)
    }

    await messageRepo.appendMessage(pageId, msg)

    // 更新本地缓存
    const updated = await messageRepo.loadById(pageId)
    currentMessages.value = updated ?? null

    // 更新主表计数
    if (currentConversation.value) {
      const newCount = currentMessages.value?.chatHistory.length ?? 0
      await conversationRepo.update(pageId, { messageCount: newCount, updatedAt: Date.now() })
      currentConversation.value = { ...currentConversation.value, messageCount: newCount }
    }
  }

  /**
   * 删除单条消息并持久化。
   */
  async function deleteMessage(msgId: string): Promise<void> {
    const pageId = currentPageId.value
    if (!pageId) return
    await messageRepo.deleteMessage(pageId, msgId)
    const updated = await messageRepo.loadById(pageId)
    currentMessages.value = updated ?? null
  }

  /**
   * 截断 msgId 之后的所有消息（用于编辑后重新生成）。
   */
  async function truncateAfter(msgId: string): Promise<void> {
    const pageId = currentPageId.value
    if (!pageId) return
    await messageRepo.truncateAfter(pageId, msgId)
    const updated = await messageRepo.loadById(pageId)
    currentMessages.value = updated ?? null
  }

  /**
   * 更新副表中的 rawText（首次提取后调用）。
   */
  async function setRawText(rawText: string): Promise<void> {
    const pageId = currentPageId.value
    if (!pageId) return
    let msgRecord = currentMessages.value
    if (!msgRecord) {
      msgRecord = { id: pageId, rawText, metadata: {}, chatHistory: [] }
      await messageRepo.save(msgRecord)
    } else {
      await messageRepo.save({ ...msgRecord, rawText })
    }
    currentMessages.value = { ...msgRecord, rawText }
  }

  /** 重置 store（切换到全新页面时使用） */
  function reset(): void {
    currentPageId.value = null
    currentConversation.value = null
    currentMessages.value = null
    isLoading.value = false
  }

  return {
    currentPageId,
    currentConversation,
    currentMessages,
    isLoading,
    hasConversation,
    chatHistory,
    loadOrCreate,
    loadOrCreateByUrl,
    appendMessage,
    deleteMessage,
    truncateAfter,
    setRawText,
    reset,
  }
})
