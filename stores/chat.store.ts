import { defineStore } from 'pinia'
import { ref, computed, toRaw, watch } from 'vue'
import type { ConversationEntity, ChatMessage } from '../types/chat'
import { ChatRepository } from '../db/repositories/chat.repository'
import { useModelStore } from './model.store'
import { useSettingsStore } from './settings.store'
import { useDocumentStore } from './document.store'
import { PromptBuilder } from '../services/prompt/builder'
import type { PromptInput } from '../services/prompt/builder'
import { buildPageContext } from '../services/prompt/context'
import { truncateContext } from '../services/prompt/truncate'
import { createProvider } from '../services/ai/factory'
import type { ModelConfig } from '../types/model'
import type { AIProvider } from '../services/ai/types'
import type { AppSettings } from '../types/settings'

export const useChatStore = defineStore('chat', () => {
  // ── State ──────────────────────────────────────────────
  const messages = ref<ChatMessage[]>([])
  const conversations = ref<ConversationEntity[]>([])
  const currentConversationId = ref<string | null>(null)
  const currentDocumentId = ref<string | null>(null)
  const inputText = ref('')
  const lastError = ref<string | null>(null)

  /** Per-conversation stream state. Key = conversationId. */
  interface StreamState {
    controller: AbortController
    provider: AIProvider | null
    /** Captured messages array for this conversation. Used so background
     *  streams continue updating the correct array even after the user
     *  switches to another conversation (which replaces messages.value). */
    messages: ChatMessage[]
  }
  const streamStates = ref<Map<string, StreamState>>(new Map())

  // ── Computed ───────────────────────────────────────────
  /**
   * Whether the CURRENT conversation is streaming/sending.
   *
   * These are ref (not computed) because Pinia 3.x may not reliably unwrap
   * ComputedRef across component boundaries.  The watch below keeps them in
   * sync with streamStates + currentConversationId.
   */
  const isStreaming = ref(false)
  const isSending = ref(false)

  watch(
    [currentConversationId, () => streamStates.value.size],
    () => {
      const cid = currentConversationId.value
      const active = cid ? streamStates.value.has(cid) : false
      isStreaming.value = active
      isSending.value = active
    },
    { immediate: true },
  )

  const canSend = computed<boolean>(() => {
    if (isSending.value || isStreaming.value) return false

    const modelStore = useModelStore()
    const model = modelStore.currentModel
    if (!model) return false
    if (!model.enabled) return false
    if (!model.baseUrl) return false

    // Ollama doesn't require API key
    if (model.provider !== 'ollama' && !model.apiKey) return false

    // Allow empty input when system prompt or document context exists
    if (!inputText.value.trim()) {
      const settingsStore = useSettingsStore()
      const hasSystemPrompt = !!(model.systemPrompt || settingsStore.settings.globalSystemPrompt)
      const documentStore = useDocumentStore()
      const doc = documentStore.pageDocument || documentStore.currentDocument
      const hasContext = !!(doc?.markdown)
      if (!hasSystemPrompt && !hasContext) return false
    }

    return true
  })

  // ── Actions ────────────────────────────────────────────
  function setInputText(text: string) {
    inputText.value = text
    // Clear error when user starts typing
    if (lastError.value) lastError.value = null
  }

  function clearError() {
    lastError.value = null
  }

  async function sendMessage(content: string, modelIds?: string[]): Promise<void> {
    // ── Guard: prevent concurrent sends ──────────────────
    if (isSending.value || isStreaming.value) {
      throw new Error('A message is already in progress. Please wait or stop the current generation.')
    }

    const modelStore = useModelStore()
    const settingsStore = useSettingsStore()

    // ── Resolve models to use ────────────────────────────
    const resolvedModelIds = modelIds && modelIds.length > 0
      ? modelIds
      : modelStore.currentModelId
        ? [modelStore.currentModelId]
        : []

    if (resolvedModelIds.length === 0) {
      throw new Error('No model selected. Please select at least one model before sending.')
    }

    const resolvedModels: ModelConfig[] = []
    for (const id of resolvedModelIds) {
      const m = modelStore.models.find((mod) => mod.id === id)
      if (!m) {
        throw new Error(`Model not found: ${id}`)
      }
      if (!m.enabled) {
        throw new Error(`Model "${m.name}" is disabled. Enable it in Settings.`)
      }
      if (!m.baseUrl) {
        throw new Error(`Model "${m.name}" has no base URL configured.`)
      }
      if (m.provider !== 'ollama' && !m.apiKey) {
        throw new Error(`API key is not set for provider "${m.name}". Set it in Settings.`)
      }
      resolvedModels.push(m)
    }

    // ── Ensure active conversation ───────────────────────
    if (!currentConversationId.value) {
      let docId = currentDocumentId.value
      // Fallback: try document store if currentDocumentId is not set
      if (!docId) {
        const documentStore = useDocumentStore()
        docId = documentStore.pageDocument?.id || documentStore.currentDocument?.id || null
      }
      if (!docId) {
        throw new Error('No document context. Open a page or select a document from Library.')
      }
      await createConversation(docId)
    }

    // ── Set title from first user message ────────────────
    const isFirstMessage = messages.value.length === 0
    if (isFirstMessage) {
      const title = content.slice(0, 40) + (content.length > 40 ? '...' : '')
      await updateConversationTitle(title)
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

    // ── Single model path ────────────────────────────────
    if (resolvedModels.length === 1) {
      await sendSingleModel(content, userMsg.id, resolvedModels[0], settingsStore.settings)
      return
    }

    // ── Multi-model path ─────────────────────────────────
    await sendMultiModel(content, userMsg.id, resolvedModels, settingsStore.settings)
  }

  function stopGeneration() {
    const cid = currentConversationId.value
    if (!cid) return
    const state = streamStates.value.get(cid)
    if (!state) return
    state.controller.abort()
    streamStates.value.delete(cid)
    // Mark streaming assistant messages in the CURRENT conversation as aborted
    for (let i = messages.value.length - 1; i >= 0; i--) {
      const msg = messages.value[i]
      if (msg.role === 'assistant' && msg.status === 'streaming') {
        msg.status = 'aborted'
        if (!msg.content) {
          msg.content = '(stopped)'
        }
        msg.updatedAt = new Date().toISOString()
      }
    }
  }

  async function regenerate(targetAssistantId?: string): Promise<void> {
    const modelStore = useModelStore()
    const settingsStore = useSettingsStore()
    const model = modelStore.currentModel
    if (!model) return

    let userMsg: ChatMessage | undefined

    if (targetAssistantId) {
      // Regenerate a specific assistant message: find its corresponding user message
      const asstIdx = messages.value.findIndex((m) => m.id === targetAssistantId)
      if (asstIdx === -1) return

      // Walk backwards to find the preceding user message
      for (let i = asstIdx - 1; i >= 0; i--) {
        if (messages.value[i].role === 'user') {
          userMsg = messages.value[i]
          // Truncate all messages from this user onward
          messages.value.splice(i)
          break
        }
      }
      if (!userMsg) return
    } else {
      const lastUserIdx = findLastUserMessageIndex()
      if (lastUserIdx === -1) return

      // Remove the last assistant message (if any)
      if (messages.value.length > lastUserIdx + 1) {
        const lastAsst = messages.value[messages.value.length - 1]
        if (lastAsst.role === 'assistant') {
          messages.value.pop()
        }
      }

      userMsg = messages.value[lastUserIdx]
    }

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

    const cid = currentConversationId.value!
    const capturedMessages = messages.value

    const controller = new AbortController()
    const state: StreamState = { controller, provider: null, messages: capturedMessages }
    streamStates.value.set(cid, state)

    try {
      await streamToProvider(userMsg.content, userMsg.id, assistantMsg, model, settingsStore.settings, state)
    } finally {
      streamStates.value.delete(cid)
      if (!controller.signal.aborted) {
        await persistConversationForId(cid, capturedMessages)
      }
    }
  }

  async function loadConversation(id: string): Promise<void> {
    const conv = await ChatRepository.findById(id)
    if (conv) {
      messages.value = [...conv.messages]
      currentConversationId.value = conv.id
    }
  }

  async function loadConversations(documentId: string): Promise<void> {
    // Persist any active conversation before switching document context.
    // This prevents data loss when the user navigates away mid-stream
    // (component unmount may orphan the streaming Promise and skip persistConversation).
    await persistConversation()

    currentDocumentId.value = documentId
    const all = await ChatRepository.findByDocumentId(documentId)
    conversations.value = all.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )

    if (all.length > 0) {
      const mostRecent = conversations.value[0]
      messages.value = [...mostRecent.messages]
      currentConversationId.value = mostRecent.id
    } else {
      messages.value = []
      currentConversationId.value = null
    }
  }

  async function createConversation(documentId: string, title?: string): Promise<ConversationEntity> {
    // Persist the current conversation before creating a new one.
    // This prevents data loss when the user clicks "New Conversation"
    // before the previous stream's persistConversation() has completed.
    await persistConversation()

    const conv: ConversationEntity = {
      id: crypto.randomUUID(),
      documentId,
      title: title || '新对话',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    try {
      await ChatRepository.save(conv)
    } catch (err) {
      console.error(`[chat.store] Failed to save new conversation to IndexedDB:`, err)
      throw new Error('Failed to create conversation. Please try again.')
    }

    messages.value = []
    currentConversationId.value = conv.id
    currentDocumentId.value = documentId

    // Add to conversations list
    conversations.value.unshift(conv)

    return conv
  }

  async function switchConversation(conversationId: string): Promise<void> {
    // Persist current before switching
    await persistConversation()

    // If the target conversation has an active background stream, use its
    // live in-memory messages array (which has been receiving tokens while
    // the user was on another conversation) instead of the stale IndexedDB copy.
    const activeStream = streamStates.value.get(conversationId)
    if (activeStream) {
      messages.value = activeStream.messages
      currentConversationId.value = conversationId
      return
    }

    const conv = await ChatRepository.findById(conversationId)
    if (conv) {
      messages.value = [...conv.messages]
      currentConversationId.value = conv.id
    }
  }

  async function deleteConversation(id: string): Promise<void> {
    // Persist current conversation first (unless we're deleting it — no point)
    if (currentConversationId.value && currentConversationId.value !== id) {
      await persistConversation()
    }

    try {
      await ChatRepository.delete(id)
    } catch (err) {
      console.error(`[chat.store] Failed to delete conversation ${id} from IndexedDB:`, err)
      // Still update the UI so the user sees the conversation removed.
      // If the DB delete failed, the conversation will reappear on next loadConversations.
    }

    conversations.value = conversations.value.filter((c) => c.id !== id)

    if (currentConversationId.value === id) {
      if (conversations.value.length > 0) {
        const next = conversations.value[0]
        // Load next conversation's messages from DB (not from stale list copy)
        const nextConv = await ChatRepository.findById(next.id)
        messages.value = nextConv ? [...nextConv.messages] : []
        currentConversationId.value = next.id
      } else {
        messages.value = []
        currentConversationId.value = null
      }
    }
  }

  async function updateConversationTitle(title: string): Promise<void> {
    if (!currentConversationId.value) return
    const conv = await ChatRepository.findById(currentConversationId.value)
    if (conv) {
      conv.title = title
      conv.updatedAt = new Date().toISOString()
      await ChatRepository.save(conv)

      // Update in conversations list
      const idx = conversations.value.findIndex((c) => c.id === conv.id)
      if (idx !== -1) {
        conversations.value[idx] = { ...conv, messages: conversations.value[idx].messages }
      }
    }
  }

  // ── Internal helpers ───────────────────────────────────

  /**
   * Single-model streaming path (original behavior).
   */
  async function sendSingleModel(
    userContent: string,
    userMsgId: string,
    model: ModelConfig,
    settings: AppSettings,
  ): Promise<void> {
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      modelId: model.modelId,
      status: 'streaming',
      createdAt: new Date().toISOString(),
    }
    messages.value.push(assistantMsg)

    const cid = currentConversationId.value!
    // Capture the messages array reference so background stream callbacks
    // continue updating this array even if the user switches conversations
    // (which replaces messages.value).
    const capturedMessages = messages.value

    const controller = new AbortController()
    const state: StreamState = { controller, provider: null, messages: capturedMessages }
    streamStates.value.set(cid, state)

    try {
      await streamToProvider(userContent, userMsgId, assistantMsg, model, settings, state)
    } finally {
      streamStates.value.delete(cid)
      if (!controller.signal.aborted) {
        await persistConversationForId(cid, capturedMessages)
      }
    }
  }

  /**
   * Multi-model streaming: fire all models concurrently.
   */
  async function sendMultiModel(
    userContent: string,
    userMsgId: string,
    models: ModelConfig[],
    settings: AppSettings,
  ): Promise<void> {
    // Create placeholder assistant message for each model
    const assistantMsgs: ChatMessage[] = models.map((m) => ({
      id: crypto.randomUUID(),
      role: 'assistant' as const,
      content: '',
      modelId: m.modelId,
      status: 'streaming' as const,
      createdAt: new Date().toISOString(),
    }))

    // Push all at once so UI renders them together
    for (const msg of assistantMsgs) {
      messages.value.push(msg)
    }

    const cid = currentConversationId.value!
    // Capture the messages array reference (see sendSingleModel for rationale).
    const capturedMessages = messages.value

    const controller = new AbortController()
    const state: StreamState = { controller, provider: null, messages: capturedMessages }
    streamStates.value.set(cid, state)

    const signal = controller.signal

    // Fire all streams concurrently
    const tasks = models.map((model, i) =>
      streamToProvider(userContent, userMsgId, assistantMsgs[i], model, settings, state).catch(
        (err) => {
          // Mark the specific assistant message as failed.
          // Use capturedMessages so we target the correct conversation even
          // if the user has switched away.
          const targetId = assistantMsgs[i].id
          const msg = capturedMessages.find((m) => m.id === targetId)
          if (msg && msg.status === 'streaming') {
            msg.status = 'failed'
            msg.error = err?.message || String(err)
            msg.updatedAt = new Date().toISOString()
          }
        },
      ),
    )

    try {
      await Promise.allSettled(tasks)
    } finally {
      // Only mark as done if ALL streams completed (not aborted mid-way)
      if (!signal.aborted) {
        streamStates.value.delete(cid)
        await persistConversationForId(cid, capturedMessages)
      } else {
        streamStates.value.delete(cid)
      }
    }
  }

  async function streamToProvider(
    userContent: string,
    currentUserMsgId: string,
    assistantMsg: ChatMessage,
    model: ModelConfig,
    settings: AppSettings,
    streamState: StreamState,
  ): Promise<void> {
    // Build page context from current document
    const documentStore = useDocumentStore()
    const doc = documentStore.pageDocument || documentStore.currentDocument
    let context: string | undefined
    if (doc?.markdown) {
      context = buildPageContext({
        title: doc.title,
        url: doc.url,
        markdown: doc.markdown,
        wordCount: doc.wordCount,
        tokenCount: doc.tokenCount,
        siteName: doc.siteName,
        capturedAt: doc.capturedAt,
      })
    }

    // Truncate context before building the prompt (was previously done
    // post-build by checking m.role === 'system', but context is now user-role).
    const maxTokens = Math.min(
      model.contextWindow,
      settings.context.maxContextTokens,
    )
    if (context) {
      context = truncateContext(context, maxTokens)
    }

    // Build prompt using the captured messages array (streamState.messages)
    // rather than messages.value, so history stays correct even if the user
    // switches to another conversation mid-stream.
    const builder = new PromptBuilder()
    const capturedMessages = streamState.messages
    const history = buildHistory(
      capturedMessages.filter((m) => m.id !== assistantMsg.id && m.id !== currentUserMsgId),
    )

    const promptInput: PromptInput = {
      systemPrompt: model.systemPrompt || settings.globalSystemPrompt,
      context,
      history,
      userInput: userContent,
    }

    const promptOutput = builder.build(promptInput)

    // Call provider stream.
    // Use capturedMessages (not messages.value) for all callbacks so tokens
    // continue flowing into the correct conversation even after a switch.
    const assistantId = assistantMsg.id
    streamState.provider = createProvider(model)
    await streamState.provider.streamChat(
      {
        model,
        systemPrompt: promptOutput.system,
        messages: promptOutput.messages,
        signal: streamState.controller.signal,
      },
      {
        onToken(text: string) {
          const msg = capturedMessages.find((m) => m.id === assistantId)
          if (msg) msg.content += text
        },
        onReasoning(text: string) {
          const msg = capturedMessages.find((m) => m.id === assistantId)
          if (msg) {
            if (!msg.reasoningContent) msg.reasoningContent = ''
            msg.reasoningContent += text
          }
        },
        onDone() {
          const msg = capturedMessages.find((m) => m.id === assistantId)
          if (msg) {
            msg.status = 'success'
            msg.updatedAt = new Date().toISOString()
          }
        },
        onError(error: Error) {
          const msg = capturedMessages.find((m) => m.id === assistantId)
          if (msg) {
            // stopGeneration() synchronously marks messages as 'aborted' and
            // aborts the controller.  The provider's abort-triggered onError
            // fires asynchronously — it must not overwrite 'aborted' with
            // 'failed'.
            if (streamState.controller.signal.aborted) {
              return
            }
            msg.status = 'failed'
            msg.error = error.message || String(error)
            msg.updatedAt = new Date().toISOString()
          }
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

  /**
   * Deep-clone store messages to plain objects so IndexedDB structured clone doesn't
   * fail on Vue reactive Proxy objects (DataCloneError).
   *
   * Strategy: structuredClone is the primary path (preserves Date, etc.).
   * If it fails (e.g. a non-cloneable property leaked into a message object),
   * fall back to JSON round-trip which naturally strips functions, Symbols,
   * and undefined values.
   */
  function cloneMessages(msgs: ChatMessage[]): ChatMessage[] {
    const raw = toRaw(msgs)
    try {
      return structuredClone(raw) as ChatMessage[]
    } catch (err) {
      console.warn(
        '[chat.store] cloneMessages: structuredClone failed, falling back to JSON serialization.',
        err,
      )

      // Diagnostic: try to identify which message / property is non-cloneable
      if (Array.isArray(raw)) {
        for (let i = 0; i < raw.length; i++) {
          const msg = raw[i]
          try {
            structuredClone(msg)
          } catch (e) {
            console.error(
              `[chat.store] cloneMessages: message[${i}] (id=${msg?.id}) is not cloneable. Keys:`,
              msg ? Object.keys(msg) : '(null/undefined)',
            )
            if (msg && typeof msg === 'object') {
              for (const key of Object.keys(msg)) {
                try {
                  structuredClone({ [key]: (msg as Record<string, unknown>)[key] })
                } catch {
                  console.error(
                    `[chat.store] cloneMessages: property '${key}' (type=${typeof (msg as Record<string, unknown>)[key]}) is not cloneable`,
                  )
                }
              }
            }
            break
          }
        }
      }

      // Fallback: JSON round-trip sanitizes non-cloneable values
      return JSON.parse(JSON.stringify(raw)) as ChatMessage[]
    }
  }

  function deleteMessage(id: string): void {
    const idx = messages.value.findIndex((m) => m.id === id)
    if (idx === -1) return
    messages.value.splice(idx, 1)
    persistConversation()
  }

  function editMessage(id: string, content: string): void {
    const idx = messages.value.findIndex((m) => m.id === id)
    if (idx === -1) return
    // Truncate from this user message onward, then set input to its content
    messages.value.splice(idx)
    inputText.value = content
    persistConversation()
  }

  async function persistConversation(): Promise<void> {
    if (!currentConversationId.value) return

    let conv: ConversationEntity | undefined
    try {
      conv = await ChatRepository.findById(currentConversationId.value)
    } catch (err) {
      console.error(`[chat.store] persistConversation: DB read failed for ${currentConversationId.value}`, err)
      return
    }

    if (!conv) {
      // Expected race: new conversation created but DB write hasn't completed yet.
      console.warn(`[chat.store] persistConversation: conversation ${currentConversationId.value} not found in IndexedDB (may be a new conversation still being created)`)
      return
    }

    const clonedMsgs = cloneMessages(messages.value)
    conv.messages = clonedMsgs
    conv.updatedAt = new Date().toISOString()

    try {
      await ChatRepository.save(conv)
    } catch (err) {
      console.error(`[chat.store] persistConversation: DB write failed for ${conv.id}`, err)
      // Don't throw — keep UI responsive even if persistence fails.
      return
    }

    // Sync back to conversations list so messageCount stays correct in UI.
    // Without this, newly created conversations always show 0 messages
    // because the object in conversations.value was pushed with messages: [].
    const idx = conversations.value.findIndex((c) => c.id === conv.id)
    if (idx !== -1) {
      conversations.value[idx] = {
        ...conversations.value[idx],
        messages: clonedMsgs,
        updatedAt: conv.updatedAt,
      }
    }
  }

  /**
   * Persist a specific conversation by ID using the given messages array.
   * Used by background streams that complete after the user has switched
   * to another conversation (so currentConversationId no longer matches).
   */
  async function persistConversationForId(cid: string, msgs: ChatMessage[]): Promise<void> {
    let conv: ConversationEntity | undefined
    try {
      conv = await ChatRepository.findById(cid)
    } catch (err) {
      console.error(`[chat.store] persistConversationForId: DB read failed for ${cid}`, err)
      return
    }

    if (!conv) {
      console.warn(`[chat.store] persistConversationForId: conversation ${cid} not found in IndexedDB`)
      return
    }

    const clonedMsgs = cloneMessages(msgs)
    conv.messages = clonedMsgs
    conv.updatedAt = new Date().toISOString()

    try {
      await ChatRepository.save(conv)
    } catch (err) {
      console.error(`[chat.store] persistConversationForId: DB write failed for ${cid}`, err)
      return
    }

    // Sync back to conversations list
    const idx = conversations.value.findIndex((c) => c.id === cid)
    if (idx !== -1) {
      conversations.value[idx] = {
        ...conversations.value[idx],
        messages: clonedMsgs,
        updatedAt: conv.updatedAt,
      }
    }
  }

  return {
    // state
    messages,
    conversations,
    currentConversationId,
    currentDocumentId,
    inputText,
    isStreaming,
    isSending,
    lastError,
    // computed
    canSend,
    // actions
    setInputText,
    clearError,
    sendMessage,
    stopGeneration,
    regenerate,
    deleteMessage,
    editMessage,
    loadConversation,
    loadConversations,
    createConversation,
    switchConversation,
    deleteConversation,
  }
})
