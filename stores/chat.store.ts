import dayjs from 'dayjs'
import { defineStore } from 'pinia'
import { ref, computed, toRaw, watch, nextTick } from 'vue'
import type { ConversationEntity, ChatMessage, SteeringMessage } from '../types/chat'
import { ChatRepository } from '../db/repositories/chat.repository'
import { useModelStore } from './model.store'
import { useSettingsStore } from './settings.store'
import { useDocumentStore } from './document.store'
import { buildAnalysisPrompt } from '../services/prompt/analysis'
import type { Highlight } from '../types/document'
import { estimateTokens } from '../utils/token'
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
  /**
   * Whether to include the mounted page context when sending the next message.
   * Default true. The user can toggle this off in ChatInput to send a
   * "naked" question without the page markdown appended as context.
   */
  const includeContext = ref(true)
  const steeringQueue = ref<SteeringMessage[]>([])
  const queuePaused = ref(false)

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

  /** Resolve the document whose context should be attached. Priority:
   *  the conversation's bound document (durable — survives reload) → the
   *  in-memory mounted page (current-page capture). Returns undefined when
   *  the document can't be found (e.g. deleted from the library). */
  function resolveAttachedDocument(documentStore: ReturnType<typeof useDocumentStore>) {
    const boundId = currentDocumentId.value
    if (boundId) {
      const inList = documentStore.documents.find((d) => d.id === boundId)
      if (inList) return inList
    }
    return documentStore.pageDocument || documentStore.currentDocument
  }

  /** True when there's an attachable document with content AND the user
   *  hasn't disabled context. */
  function hasAttachablePageContext(): boolean {
    if (!includeContext.value) return false
    const documentStore = useDocumentStore()
    const doc = resolveAttachedDocument(documentStore)
    return !!doc?.markdown?.trim()
  }

  /** True when no prior user/assistant turn exists — i.e. the next send is
   *  the first turn of the conversation, which is the only turn that carries
   *  the page context. */
  function isFirstTurn(): boolean {
    return !messages.value.some((message) =>
      (message.role === 'user' || message.role === 'assistant') && message.content.trim(),
    )
  }

  /** True when a blank question can be sent this turn — only on the first
   *  turn with an attachable page. Exposed so ChatInput's multi-model path
   *  can reuse the exact same rule as `canSend`. */
  const canSendEmpty = computed<boolean>(() => isFirstTurn() && hasAttachablePageContext())

  const canSend = computed<boolean>(() => {
    if (isSending.value || isStreaming.value) return false

    const modelStore = useModelStore()
    const model = modelStore.currentModel
    if (!model) return false
    if (!model.enabled) return false
    if (!model.baseUrl) return false

    // Ollama doesn't require API key
    if (model.provider !== 'ollama' && !model.apiKey) return false

    // A blank question is valid only on the first turn when page context
    // will be attached. Later turns require an actual question (context is
    // not re-sent, so an empty question would send nothing meaningful).
    if (!inputText.value.trim() && !(isFirstTurn() && hasAttachablePageContext())) return false

    return true
  })

  // ── Actions ────────────────────────────────────────────
  function setInputText(text: string) {
    inputText.value = text
    // Clear error when user starts typing
    if (lastError.value) lastError.value = null
  }

  function setIncludeContext(value: boolean) {
    includeContext.value = value
  }

  function syncQueueFromConversation(conv?: ConversationEntity) {
    steeringQueue.value = conv?.steeringQueue ? cloneSteeringQueue(conv.steeringQueue) : []
    queuePaused.value = false
  }

  async function persistQueue(): Promise<void> {
    const cid = currentConversationId.value
    if (!cid) return
    const conv = await ChatRepository.findById(cid)
    if (!conv) return
    conv.steeringQueue = cloneSteeringQueue(steeringQueue.value)
    await ChatRepository.save(conv)
    const idx = conversations.value.findIndex((item) => item.id === cid)
    if (idx !== -1) conversations.value[idx] = { ...conversations.value[idx], steeringQueue: cloneSteeringQueue(steeringQueue.value) }
  }

  function enqueueMessage(content: string, modelConfigIds: string[]): void {
    const text = content.trim()
    if (!text || !currentConversationId.value) return
    steeringQueue.value.push({
      id: crypto.randomUUID(),
      content: text,
      modelConfigIds: [...modelConfigIds],
      createdAt: dayjs().toISOString(),
    })
    void persistQueue()
  }

  async function removeQueuedMessage(id: string): Promise<void> {
    steeringQueue.value = steeringQueue.value.filter((item) => item.id !== id)
    await persistQueue()
  }

  async function resumeQueue(): Promise<void> {
    queuePaused.value = false
    await drainQueue()
  }

  async function drainQueue(): Promise<void> {
    await nextTick()
    if (queuePaused.value || isSending.value || isStreaming.value) return
    const next = steeringQueue.value[0]
    if (!next) return
    steeringQueue.value.shift()
    await persistQueue()
    try {
      await sendMessage(next.content, next.modelConfigIds)
    } catch (err) {
      next.error = err instanceof Error ? err.message : String(err)
      steeringQueue.value.unshift(next)
      queuePaused.value = true
      await persistQueue()
    }
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

    if (!content.trim() && !(isFirstTurn() && hasAttachablePageContext())) {
      throw new Error('请输入问题，或先挂载页面上下文。')
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
      const title = content.trim()
        ? (content.slice(0, 40) + (content.length > 40 ? '...' : ''))
        // Empty first question: fall back to the document title so the
        // conversation list doesn't show a blank title.
        : (useDocumentStore().pageDocument?.title
          || useDocumentStore().currentDocument?.title
          || '新对话')
      await updateConversationTitle(title)
    }

    // ── Create user message ──────────────────────────────
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      status: 'success',
      createdAt: dayjs().toISOString(),
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
    // Mark streaming assistant messages as aborted. Iterate the StreamState's
    // captured messages (not the global messages.value) so this works even
    // when the user has switched to a different conversation mid-stream —
    // the background stream keeps writing into state.messages, so the
    // streaming placeholders live there, not necessarily in messages.value.
    for (const msg of state.messages) {
      if (msg.role === 'assistant' && msg.status === 'streaming') {
        msg.status = 'aborted'
        msg.updatedAt = dayjs().toISOString()
      }
    }
    // Persist so the partially-generated content survives a reload.
    // (Requirement: "保留已生成内容".) We deliberately do NOT write any
    // placeholder text — the aborted status is the source of truth and the
    // UI renders its own "已停止生成" hint.
    void persistConversationForId(cid, state.messages)
  }

  async function regenerate(targetAssistantId?: string): Promise<void> {
    const modelStore = useModelStore()
    const settingsStore = useSettingsStore()
    const defaultModel = modelStore.currentModel

    // Each entry = one assistant slot to (re)generate, with the model to use.
    interface RegenSlot { userMsg: ChatMessage; model: ModelConfig }
    const slots: RegenSlot[] = []

    if (targetAssistantId) {
      // Regenerate a specific assistant message: find its preceding user message.
      const asstIdx = messages.value.findIndex((m) => m.id === targetAssistantId)
      if (asstIdx === -1) return
      const original = messages.value[asstIdx]
      const model = modelStore.models.find((c) => c.id === original.modelConfigId)
        ?? modelStore.models.find((c) => c.modelId === original.modelId)
        ?? defaultModel
      if (!model) return

      for (let i = asstIdx - 1; i >= 0; i--) {
        if (messages.value[i].role === 'user') {
          // Keep the prompt and replace this assistant response.
          messages.value.splice(i + 1)
          slots.push({ userMsg: messages.value[i], model })
          break
        }
      }
      if (slots.length === 0) return
    } else {
      // No-arg regenerate: replace the LAST round's assistant message(s).
      // A round = last user message + all consecutive assistants after it.
      // Multi-model sends produce N assistants per round — all must be
      // regenerated, otherwise only the last bubble is re-done and the
      // others silently disappear (data loss).
      const lastUserIdx = findLastUserMessageIndex()
      if (lastUserIdx === -1) return

      const userMsg = messages.value[lastUserIdx]
      const roundAssistants = messages.value.slice(lastUserIdx + 1)
        .filter((m) => m.role === 'assistant')

      if (roundAssistants.length === 0) {
        // No assistant yet for this user turn — nothing to regenerate.
        return
      }

      // Truncate everything after the user message, then re-create one
      // assistant slot per original model.
      messages.value.splice(lastUserIdx + 1)
      for (const original of roundAssistants) {
        const model = modelStore.models.find((c) => c.id === original.modelConfigId)
          ?? modelStore.models.find((c) => c.modelId === original.modelId)
          ?? defaultModel
        if (!model) continue
        slots.push({ userMsg, model })
      }
      if (slots.length === 0) return
    }

    // All slots in one regenerate call share the same user message, so they
    // share the same context-attachment decision. Option 3: page context is
    // re-attached every turn from the bound document, independent of history.
    const firstSlot = slots[0]
    const attachContext = hasAttachablePageContext()

    // Create one fresh streaming assistant per slot.
    const assistantMsgs: ChatMessage[] = slots.map(({ model }) => ({
      id: crypto.randomUUID(),
      role: 'assistant' as const,
      content: '',
      modelId: model.modelId,
      modelConfigId: model.id,
      status: 'streaming' as const,
      createdAt: dayjs().toISOString(),
    }))
    for (const msg of assistantMsgs) messages.value.push(msg)

    const cid = currentConversationId.value!
    const capturedMessages = messages.value
    const controller = new AbortController()
    const state: StreamState = { controller, provider: null, messages: capturedMessages }
    streamStates.value.set(cid, state)

    const tasks = slots.map((slot, i) =>
      streamToProvider(
        slot.userMsg.content,
        slot.userMsg.id,
        assistantMsgs[i],
        slot.model,
        settingsStore.settings,
        state,
        attachContext,
      ).catch((err) => {
        const msg = capturedMessages.find((m) => m.id === assistantMsgs[i].id)
        if (msg && msg.status === 'streaming') {
          if (state.controller.signal.aborted) return
          msg.status = 'failed'
          msg.error = err?.message || String(err)
          msg.updatedAt = dayjs().toISOString()
        }
      }),
    )

    try {
      await Promise.allSettled(tasks)
    } finally {
      streamStates.value.delete(cid)
      if (!controller.signal.aborted) {
        await persistConversationForId(cid, capturedMessages)
        const failed = capturedMessages.some((message) => message.role === 'assistant' && message.status === 'failed')
        if (failed && cid === currentConversationId.value) {
          queuePaused.value = true
          await persistQueue()
        } else if (!failed && cid === currentConversationId.value) {
          await drainQueue()
        }
      }
    }
  }

  async function loadConversation(id: string): Promise<void> {
    const conv = await ChatRepository.findById(id)
    if (conv) {
      messages.value = [...conv.messages]
      currentConversationId.value = conv.id
      currentDocumentId.value = conv.documentId
      syncQueueFromConversation(conv)
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
      (a, b) => dayjs(b.updatedAt).valueOf() - dayjs(a.updatedAt).valueOf(),
    )

    if (all.length > 0) {
      const mostRecent = conversations.value[0]
      messages.value = [...mostRecent.messages]
      currentConversationId.value = mostRecent.id
      syncQueueFromConversation(mostRecent)
    } else {
      messages.value = []
      currentConversationId.value = null
      syncQueueFromConversation()
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
      createdAt: dayjs().toISOString(),
      updatedAt: dayjs().toISOString(),
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
    syncQueueFromConversation(conv)

    // Add to conversations list
    conversations.value.unshift(conv)

    return conv
  }

  async function branchConversationAt(messageId: string): Promise<ConversationEntity> {
    const sourceId = currentConversationId.value
    if (!sourceId) throw new Error('No active conversation to branch.')

    await persistConversation()
    const index = messages.value.findIndex((message) => message.id === messageId)
    if (index === -1) throw new Error('Message not found.')

    const source = conversations.value.find((conversation) => conversation.id === sourceId)
      ?? await ChatRepository.findById(sourceId)
    if (!source) throw new Error('Conversation not found.')

    const now = dayjs().toISOString()
    const branch: ConversationEntity = {
      id: crypto.randomUUID(),
      documentId: source.documentId,
      title: `${source.title || '新对话'} 分支`,
      parentConversationId: source.id,
      branchedAtMessageId: messageId,
      messages: cloneMessages(messages.value.slice(0, index + 1)),
      createdAt: now,
      updatedAt: now,
    }

    await ChatRepository.save(branch)
    conversations.value.unshift(branch)
    messages.value = [...branch.messages]
    currentConversationId.value = branch.id
    currentDocumentId.value = branch.documentId
    return branch
  }

  async function restoreConversationAt(messageId: string): Promise<ConversationEntity> {
    const sourceId = currentConversationId.value
    if (!sourceId) throw new Error('No active conversation to restore.')
    const index = messages.value.findIndex((message) => message.id === messageId)
    if (index === -1) throw new Error('Message not found.')

    await persistConversation()
    const source = await ChatRepository.findById(sourceId)
    if (!source) throw new Error('Conversation not found.')

    const now = dayjs().toISOString()
    const snapshot: ConversationEntity = {
      id: crypto.randomUUID(),
      documentId: source.documentId,
      title: `${source.title || '新对话'} 恢复前`,
      parentConversationId: source.id,
      branchedAtMessageId: messageId,
      messages: cloneMessages(messages.value),
      steeringQueue: cloneSteeringQueue(steeringQueue.value),
      createdAt: now,
      updatedAt: now,
    }
    await ChatRepository.save(snapshot)
    conversations.value.unshift(snapshot)

    messages.value = cloneMessages(messages.value.slice(0, index + 1))
    steeringQueue.value = []
    queuePaused.value = false
    source.messages = cloneMessages(messages.value)
    source.steeringQueue = []
    source.updatedAt = now
    await ChatRepository.save(source)
    const sourceIndex = conversations.value.findIndex((item) => item.id === source.id)
    if (sourceIndex !== -1) conversations.value[sourceIndex] = { ...source }
    return source
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
      const activeConv = conversations.value.find((item) => item.id === conversationId)
      syncQueueFromConversation(activeConv)
      return
    }

    const conv = await ChatRepository.findById(conversationId)
    if (conv) {
      messages.value = [...conv.messages]
      currentConversationId.value = conv.id
      currentDocumentId.value = conv.documentId
      syncQueueFromConversation(conv)
    }
  }

  /**
   * Reset all in-memory state. Called by refreshAfterDataChange() after bulk
   * DB mutations (import / sync) to prevent stale conversations/messages from
   * being displayed. The per-document conversation list will be reloaded
   * lazily when the user next clicks a document in LibraryView.
   */
  function resetState(): void {
    conversations.value = []
    messages.value = []
    currentConversationId.value = null
    currentDocumentId.value = null
    steeringQueue.value = []
    queuePaused.value = false
    streamStates.value.clear()
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

  async function updateConversationTitle(title: string, conversationId = currentConversationId.value): Promise<void> {
    if (!conversationId) return
    const conv = await ChatRepository.findById(conversationId)
    if (conv) {
      conv.title = title
      conv.updatedAt = dayjs().toISOString()
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
      modelConfigId: model.id,
      status: 'streaming',
      createdAt: dayjs().toISOString(),
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
      await streamToProvider(userContent, userMsgId, assistantMsg, model, settings, state, true)
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
      modelConfigId: m.id,
      status: 'streaming' as const,
      createdAt: dayjs().toISOString(),
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
      streamToProvider(userContent, userMsgId, assistantMsgs[i], model, settings, state, true).catch(
        (err) => {
          // Mark the specific assistant message as failed.
          // Use capturedMessages so we target the correct conversation even
          // if the user has switched away.
          const targetId = assistantMsgs[i].id
          const msg = capturedMessages.find((m) => m.id === targetId)
          if (msg && msg.status === 'streaming') {
            msg.status = 'failed'
            msg.error = err?.message || String(err)
            msg.updatedAt = dayjs().toISOString()
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
        const failed = capturedMessages.some((message) => message.role === 'assistant' && message.status === 'failed')
        if (failed && cid === currentConversationId.value) {
          queuePaused.value = true
          await persistQueue()
        } else if (!failed && cid === currentConversationId.value) {
          await drainQueue()
        }
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
    attachContext: boolean,
  ): Promise<void> {
    // Build prompt using the captured messages array so history remains stable
    // if the user switches conversations during streaming.
    const capturedMessages = streamState.messages
    const documentStore = useDocumentStore()
    let page: { title: string; url: string; markdown: string; wordCount: number; tokenCount: number; siteName?: string; capturedAt?: string } | undefined
    let highlights: Highlight[] | undefined
    // Option 3 (Cherry Studio semantics, DB-clean variant): the page context
    // is NEVER persisted into the user message — DB stays clean and the chat
    // bubble shows only the user's question. Instead, on EVERY turn the
    // context is re-attached from the conversation's bound document, so the
    // model sees it regardless of turn number. Source priority: the
    // conversation's bound document (durable across reloads) → in-memory
    // mounted page (current-page capture, not yet saved).
    if (attachContext && hasAttachablePageContext()) {
      const doc = resolveAttachedDocument(documentStore)
      if (doc?.markdown) {
        page = {
          title: doc.title,
          url: doc.url,
          markdown: doc.markdown,
          wordCount: doc.wordCount,
          tokenCount: doc.tokenCount,
          siteName: doc.siteName,
          capturedAt: doc.capturedAt,
        }
        highlights = doc.highlights
      }
    }

    const history = buildHistory(
      capturedMessages.filter((m) => m.id !== assistantMsg.id && m.id !== currentUserMsgId),
    )

    const promptOutput = buildAnalysisPrompt({
      model,
      fallbackSystemPrompt: settings.globalSystemPrompt,
      contextSettings: settings.context,
      page,
      highlights,
      history,
      userInput: userContent,
    })

    // NOTE: page context is NEVER written into the persisted user message
    // (option 3). DB content stays as the user's raw question, so the chat
    // bubble stays clean. The model still sees the page every turn because
    // it's re-attached above from the bound document — no history inheritance
    // needed.

    // Call provider stream.
    // Use capturedMessages (not messages.value) for all callbacks so tokens
    // continue flowing into the correct conversation even after a switch.
    const assistantId = assistantMsg.id
    const startedAt = performance.now()
    let firstTokenAt: number | undefined
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
          if (firstTokenAt == null) firstTokenAt = performance.now()
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
        onUsage(usage) {
          const msg = capturedMessages.find((m) => m.id === assistantId)
          if (msg) msg.tokenUsage = usage
        },
        onDone() {
          const msg = capturedMessages.find((m) => m.id === assistantId)
          if (msg) {
            msg.status = 'success'
            msg.updatedAt = dayjs().toISOString()
            msg.durationMs = Math.round(performance.now() - startedAt)
            if (firstTokenAt != null) {
              msg.firstTokenMs = Math.round(firstTokenAt - startedAt)
              msg.genMs = Math.round(performance.now() - firstTokenAt)
            }
            // Fallback estimate when the provider didn't return real usage
            // (e.g. some OpenAI-compatible endpoints). Real usage was already
            // written by onUsage above when available.
            if (!msg.tokenUsage) {
              const promptText = [
                promptOutput.system ?? '',
                ...promptOutput.messages.map((m) => m.content ?? ''),
              ].join('\n')
              msg.tokenUsage = {
                promptTokens: estimateTokens(promptText),
                completionTokens: estimateTokens(msg.content ?? ''),
              }
            }
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
            msg.updatedAt = dayjs().toISOString()
            msg.durationMs = Math.round(performance.now() - startedAt)
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
  function cloneSteeringQueue(items: SteeringMessage[]): SteeringMessage[] {
    return items.map((item) => ({ ...item, modelConfigIds: [...item.modelConfigIds] }))
  }

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
                  structuredClone({ [key]: (msg as unknown as Record<string, unknown>)[key] })
                } catch {
                  console.error(
                    `[chat.store] cloneMessages: property '${key}' (type=${typeof (msg as unknown as Record<string, unknown>)[key]}) is not cloneable`,
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
    if (lastError.value) lastError.value = null
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
    conv.updatedAt = dayjs().toISOString()

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
    conv.updatedAt = dayjs().toISOString()

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
    includeContext,
    steeringQueue,
    queuePaused,
    // computed
    canSend,
    canSendEmpty,
    // actions
    setInputText,
    setIncludeContext,
    enqueueMessage,
    removeQueuedMessage,
    resumeQueue,
    clearError,
    sendMessage,
    stopGeneration,
    regenerate,
    deleteMessage,
    editMessage,
    loadConversation,
    loadConversations,
    createConversation,
    branchConversationAt,
    restoreConversationAt,
    switchConversation,
    updateConversationTitle,
    deleteConversation,
    resetState,
  }
})
