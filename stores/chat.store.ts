import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ConversationEntity, ChatMessage } from '../types/chat'
import { ChatRepository } from '../db/repositories/chat.repository'
import { useModelStore } from './model.store'
import { useSettingsStore } from './settings.store'
import { PromptBuilder } from '../services/prompt/builder'
import type { PromptInput } from '../services/prompt/builder'
import { truncateContext } from '../services/prompt/truncate'
import { createProvider } from '../services/ai/factory'
import type { ModelConfig } from '../types/model'
import type { AIProvider } from '../services/ai/types'
import type { AppSettings } from '../types/settings'

const RATE_LIMIT_RESET_TIME = 60000 // 1 minute in milliseconds
let lastRequestTime = 0

export function resetRateLimit() {
  lastRequestTime = 0
}

export const useChatStore = defineStore('chat', () => {
  // ── State ──────────────────────────────────────────────
  const messages = ref<ChatMessage[]>([])
  const currentConversationId = ref<string | null>(null)
  const inputText = ref('')
  const isStreaming = ref(false)
  const isSending = ref(false)

  let abortController: AbortController | null = null
  let provider: AIProvider | null = null

  // ── Computed ───────────────────────────────────────────
  const canSend = computed<boolean>(() => {
    if (isSending.value || isStreaming.value) return false
    if (!inputText.value.trim()) return false

    const modelStore = useModelStore()
    const model = modelStore.currentModel
    if (!model) return false
    if (!model.enabled) return false
    if (!model.baseUrl) return false

    // Ollama doesn't require API key
    if (model.provider !== 'ollama' && !model.apiKey) return false

    return true
  })

  // ── Actions ────────────────────────────────────────────
  function setInputText(text: string) {
    inputText.value = text
  }

  async function sendMessage(content: string): Promise<void> {
    // ── Rate limit check ─────────────────────────────────
    const now = Date.now()
    if (now - lastRequestTime < RATE_LIMIT_RESET_TIME) {
      const remaining = Math.ceil((RATE_LIMIT_RESET_TIME - (now - lastRequestTime)) / 1000)
      throw new Error(`Rate limit: please wait ${remaining} seconds before sending another request.`)
    }

    // ── Guard: prevent concurrent sends ──────────────────
    if (isSending.value || isStreaming.value) {
      throw new Error('A message is already in progress. Please wait or stop the current generation.')
    }

    const modelStore = useModelStore()
    const settingsStore = useSettingsStore()

    // ── Validation ───────────────────────────────────────
    const model = modelStore.currentModel
    if (!model) {
      throw new Error('No model selected. Please select a model before sending.')
    }
    if (!model.enabled) {
      throw new Error(`Model "${model.name}" is disabled. Enable it in Settings.`)
    }
    if (!model.baseUrl) {
      throw new Error(`Model "${model.name}" has no base URL configured.`)
    }
    if (model.provider !== 'ollama' && !model.apiKey) {
      throw new Error(`API key is not set for provider "${model.name}". Set it in Settings.`)
    }

    // ── Create user message ──────────────────────────────
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      status: 'success',
      createdAt: new Date().toISOString(),
    }
    messages.value.push(userMsg)

    // ── Create assistant message (streaming) ─────────────
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      modelId: model.modelId,
      status: 'streaming',
      createdAt: new Date().toISOString(),
    }
    messages.value.push(assistantMsg)

    isSending.value = true
    isStreaming.value = true
    abortController = new AbortController()

    try {
      await streamToProvider(content, assistantMsg, model, settingsStore.settings)
    } finally {
      isSending.value = false
      isStreaming.value = false
      abortController = null
      provider = null
      lastRequestTime = Date.now()

      await persistConversation()
    }
  }

  function stopGeneration() {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    const lastMsg = messages.value[messages.value.length - 1]
    if (lastMsg && lastMsg.role === 'assistant' && lastMsg.status === 'streaming') {
      lastMsg.status = 'aborted'
      if (!lastMsg.content) {
        lastMsg.content = '(stopped)'
      }
      lastMsg.updatedAt = new Date().toISOString()
    }
  }

  async function regenerate(): Promise<void> {
    const lastUserIdx = findLastUserMessageIndex()
    if (lastUserIdx === -1) return

    // Remove the last assistant message (if any)
    if (messages.value.length > lastUserIdx + 1) {
      const lastAsst = messages.value[messages.value.length - 1]
      if (lastAsst.role === 'assistant') {
        messages.value.pop()
      }
    }

    const lastUserMsg = messages.value[lastUserIdx]

    const modelStore = useModelStore()
    const settingsStore = useSettingsStore()
    const model = modelStore.currentModel
    if (!model) return

    // Create a fresh assistant message for re-generation
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      modelId: model.modelId,
      status: 'streaming',
      createdAt: new Date().toISOString(),
    }
    messages.value.push(assistantMsg)

    isSending.value = true
    isStreaming.value = true
    abortController = new AbortController()

    try {
      await streamToProvider(lastUserMsg.content, assistantMsg, model, settingsStore.settings)
    } finally {
      isSending.value = false
      isStreaming.value = false
      abortController = null
      provider = null
      lastRequestTime = Date.now()
      await persistConversation()
    }
  }

  async function loadConversation(id: string): Promise<void> {
    const conv = await ChatRepository.findById(id)
    if (conv) {
      messages.value = [...conv.messages]
      currentConversationId.value = conv.id
    }
  }

  async function createConversation(documentId: string, title?: string): Promise<ConversationEntity> {
    const conv: ConversationEntity = {
      id: crypto.randomUUID(),
      documentId,
      title,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await ChatRepository.save(conv)
    messages.value = []
    currentConversationId.value = conv.id
    return conv
  }

  async function deleteConversation(id: string): Promise<void> {
    await ChatRepository.delete(id)
    if (currentConversationId.value === id) {
      messages.value = []
      currentConversationId.value = null
    }
  }

  // ── Internal helpers ───────────────────────────────────

  async function streamToProvider(
    userContent: string,
    assistantMsg: ChatMessage,
    model: ModelConfig,
    settings: AppSettings,
  ): Promise<void> {
    // Build prompt
    const builder = new PromptBuilder()
    const history = buildHistory(messages.value.filter((m) => m.id !== assistantMsg.id))

    const promptInput: PromptInput = {
      systemPrompt: model.systemPrompt || settings.globalSystemPrompt,
      context: undefined,
      history,
      userInput: userContent,
    }

    const promptOutput = builder.build(promptInput)

    // Truncate context if needed
    const maxTokens = Math.min(
      model.contextWindow,
      settings.context.maxContextTokens,
    )

    const processedMessages = promptOutput.messages.map((m) => {
      if (m.role === 'system') {
        return { ...m, content: truncateContext(m.content, maxTokens) }
      }
      return m
    })

    // Call provider stream
    provider = createProvider(model)
    await provider.streamChat(
      {
        model,
        systemPrompt: promptOutput.system,
        messages: processedMessages,
        signal: abortController!.signal,
      },
      {
        onToken(text: string) {
          assistantMsg.content += text
        },
        onDone() {
          assistantMsg.status = 'success'
          assistantMsg.updatedAt = new Date().toISOString()
        },
        onError(error: Error) {
          assistantMsg.status = 'failed'
          assistantMsg.error = error.message || String(error)
          assistantMsg.updatedAt = new Date().toISOString()
        },
      },
    )
  }

  function buildHistory(msgs: ChatMessage[]): Array<{ role: 'user' | 'assistant'; content: string }> {
    return msgs
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))
  }

  function findLastUserMessageIndex(): number {
    for (let i = messages.value.length - 1; i >= 0; i--) {
      if (messages.value[i].role === 'user') return i
    }
    return -1
  }

  async function persistConversation(): Promise<void> {
    if (!currentConversationId.value) return

    const conv = await ChatRepository.findById(currentConversationId.value)
    if (conv) {
      conv.messages = [...messages.value]
      conv.updatedAt = new Date().toISOString()
      await ChatRepository.save(conv)
    }
  }

  return {
    messages,
    currentConversationId,
    inputText,
    isStreaming,
    isSending,
    canSend,
    setInputText,
    sendMessage,
    stopGeneration,
    regenerate,
    loadConversation,
    createConversation,
    deleteConversation,
  }
})
