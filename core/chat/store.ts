/**
 * Pinia store for the chat layer.
 *
 * Owns the UI state for the Chat with Doc surface:
 *   - the list of sessions for the current document
 *   - which session is active
 *   - the streaming state of the active session
 *   - the model that will be used for the next question
 *
 * The store is a thin orchestrator on top of:
 *   - `chatRepository`   – persistence (Dexie)
 *   - `streamChat`       – background-friendly service function
 *
 * The streaming protocol itself is handled by `streamChat`: the
 * function takes a `StreamSender` (which broadcasts on the
 * background message bus) and the store listens to those messages
 * via `onMessage` so it can keep its local state in sync without
 * reaching into the background directly.
 */

import { defineStore } from 'pinia'
import { ref, computed, shallowRef } from 'vue'
import type { ChatHistory, ChatMessage, CapturedDocument, ModelProviderConfig } from '@db/schema'
import { chatRepository } from './chat.repository'
import { streamChat, AbortRegistry } from './chat.service'
import { documentRepository } from '@core/documents/document.repository'
import { modelRepository } from '@core/models/model.repository'
import { sendMessage, onMessage } from '@shared/messaging/runtime-client'
import { generateId } from '@shared/utils'

/** Module-level AbortRegistry shared by every store instance. */
const sharedAbortRegistry = new AbortRegistry()

export const useChatStore = defineStore('chat', () => {
  /* ====================== State ====================== */
  const sessions = ref<ChatHistory[]>([])
  const currentSessionId = ref<string | null>(null)
  const currentDocument = ref<CapturedDocument | null>(null)
  const streaming = ref(false)
  const streamingMessageId = ref<string | null>(null)
  const streamingContent = ref('')
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const activeModelId = ref<string | null>(null)

  // Listeners that the store wires up the first time it is used.
  const listeners = shallowRef<Array<() => void>>([])

  /* ====================== Getters ====================== */

  const currentSession = computed<ChatHistory | null>(() => {
    const id = currentSessionId.value
    if (!id) return null
    return sessions.value.find((s) => s.id === id) ?? null
  })

  const currentMessages = computed<ChatMessage[]>(() => {
    const session = currentSession.value
    if (!session) return []
    return session.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
      model: m.model,
      tokens: m.tokens,
    }))
  })

  const hasActiveSession = computed(() => !!currentSession.value)

  /* ====================== Internal helpers ====================== */

  function findSession(id: string): ChatHistory | undefined {
    return sessions.value.find((s) => s.id === id)
  }

  function upsertLocalSession(session: ChatHistory) {
    const idx = sessions.value.findIndex((s) => s.id === session.id)
    if (idx >= 0) {
      sessions.value.splice(idx, 1, session)
    } else {
      sessions.value.unshift(session)
    }
  }

  function appendLocalMessage(sessionId: string, message: ChatMessage) {
    const session = findSession(sessionId)
    if (!session) return
    session.messages = [
      ...session.messages,
      {
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
        model: message.model,
        tokens: message.tokens,
      },
    ]
    session.updatedAt = message.createdAt
  }

  function patchLocalMessage(sessionId: string, messageId: string, patch: Partial<ChatMessage>) {
    const session = findSession(sessionId)
    if (!session) return
    const idx = session.messages.findIndex((m) => m.id === messageId)
    if (idx < 0) return
    const next = { ...session.messages[idx], ...patch }
    session.messages = [...session.messages.slice(0, idx), next, ...session.messages.slice(idx + 1)]
  }

  function ensureMessageStream(
    sessionId: string,
    messageId: string,
    initialContent: string
  ) {
    const session = findSession(sessionId)
    if (!session) return
    if (session.messages.find((m) => m.id === messageId)) return
    appendLocalMessage(sessionId, {
      id: messageId,
      role: 'assistant',
      content: initialContent,
      createdAt: Date.now(),
    })
  }

  function setError(msg: string | null) {
    error.value = msg
  }

  /* ====================== Message bus wiring ====================== */

  function attachStreamListeners() {
    if (listeners.value.length > 0) return
    const off: Array<() => void> = []

    off.push(
      onMessage('CHAT_STREAM_DELTA', (message) => {
        const payload = message.payload as {
          sessionId: string
          messageId: string
          delta: string
        }
        if (!payload) return
        streamingMessageId.value = payload.messageId
        streamingContent.value = (streamingContent.value || '') + payload.delta
        ensureMessageStream(payload.sessionId, payload.messageId, streamingContent.value)
        patchLocalMessage(payload.sessionId, payload.messageId, {
          content: streamingContent.value,
        })
        return false
      })
    )

    off.push(
      onMessage('CHAT_STREAM_DONE', (message) => {
        const payload = message.payload as {
          sessionId: string
          messageId: string
          message: ChatMessage
        }
        if (!payload) return
        streaming.value = false
        streamingMessageId.value = null
        streamingContent.value = ''
        // Final write to local store / repo
        if (payload.message) {
          appendLocalMessage(payload.sessionId, payload.message)
          void chatRepository
            .get(payload.sessionId)
            .then((existing) => {
              if (existing) upsertLocalSession({ ...existing, updatedAt: Date.now() })
            })
            .catch(() => undefined)
        }
        sharedAbortRegistry.release(payload.sessionId)
        return false
      })
    )

    off.push(
      onMessage('CHAT_STREAM_ERROR', (message) => {
        const payload = message.payload as {
          sessionId: string
          error: string
        }
        if (!payload) return
        streaming.value = false
        streamingMessageId.value = null
        streamingContent.value = ''
        setError(payload.error)
        if (payload.messageId) {
          patchLocalMessage(payload.sessionId, payload.messageId, {
            error: payload.error,
          })
        }
        sharedAbortRegistry.release(payload.sessionId)
        return false
      })
    )

    listeners.value = off
  }

  function detachStreamListeners() {
    for (const off of listeners.value) off()
    listeners.value = []
  }

  /* ====================== Actions: documents / sessions ====================== */

  /**
   * Load all chat sessions for a given document. The active
   * session is reset to the most recent one (or left unchanged
   * if there are none).
   */
  async function loadForDocument(documentId: string) {
    isLoading.value = true
    setError(null)
    try {
      const [doc, list] = await Promise.all([
        documentRepository.get(documentId),
        chatRepository.getForDocument(documentId),
      ])
      currentDocument.value = doc ?? null
      sessions.value = list
      // Don't auto-select on load — let the caller decide.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chat sessions')
    } finally {
      isLoading.value = false
    }
  }

  function setCurrentDocument(doc: CapturedDocument | null) {
    currentDocument.value = doc
  }

  function setActiveModel(modelId: string | null) {
    activeModelId.value = modelId
  }

  /** Create a new empty session for the current document. */
  async function startNewSession(documentId: string, modelId?: string): Promise<ChatHistory> {
    const doc = await documentRepository.get(documentId)
    if (!doc) throw new Error(`Document ${documentId} not found`)
    const model: ModelProviderConfig | undefined = modelId
      ? await modelRepository.get(modelId)
      : (await modelRepository.getDefault()) ?? undefined
    const session = await chatRepository.create({
      id: generateId(),
      documentId: doc.id,
      modelId: model?.id ?? activeModelId.value ?? '',
      model: model?.name ?? '',
      messages: [],
    })
    upsertLocalSession(session)
    currentSessionId.value = session.id
    currentDocument.value = doc
    return session
  }

  function selectSession(id: string) {
    const session = findSession(id)
    if (session) {
      currentSessionId.value = id
      return
    }
    // Fall back to the database.
    chatRepository
      .get(id)
      .then((stored) => {
        if (stored) {
          upsertLocalSession(stored)
          currentSessionId.value = id
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load session'))
  }

  async function deleteSession(id: string) {
    if (currentSessionId.value === id) {
      currentSessionId.value = null
    }
    sessions.value = sessions.value.filter((s) => s.id !== id)
    try {
      await chatRepository.delete(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete session')
    }
  }

  /**
   * Fire-and-forget: ask the background to start a chat stream
   * for the given question.
   */
  async function sendMessage(text: string): Promise<void> {
    const trimmed = text.trim()
    if (!trimmed) return
    attachStreamListeners()
    setError(null)

    let session = currentSession.value
    if (!session && currentDocument.value) {
      session = await startNewSession(currentDocument.value.id, activeModelId.value ?? undefined)
    } else if (session && activeModelId.value) {
      // If the user has switched the model mid-session, update the
      // session's modelId so future deltas are tagged correctly.
      session.modelId = activeModelId.value
    }
    if (!session) {
      setError('No active document or session')
      return
    }

    streaming.value = true
    streamingContent.value = ''
    streamingMessageId.value = null

    // Optimistically append the user message locally.
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: trimmed,
      createdAt: Date.now(),
    }
    appendLocalMessage(session.id, userMessage)
    try {
      await chatRepository.appendMessage(session.id, {
        id: userMessage.id,
        role: 'user',
        content: trimmed,
        createdAt: userMessage.createdAt,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save user message')
    }

    // Ask the background to handle the model call. The background
    // will emit CHAT_STREAM_DELTA / CHAT_STREAM_DONE messages back
    // to the side panel which our listeners translate into local
    // state updates.
    try {
      const response = await sendMessage<
        'START_CHAT',
        { historyId: string; userMessageId: string; assistantMessageId: string; model: string }
      >('START_CHAT', {
        documentId: session.documentId,
        question: trimmed,
        modelId: activeModelId.value ?? undefined,
        historyId: session.id,
      })
      if (response?.data) {
        // The background might pre-create the assistant message
        // record; reflect that locally so the UI shows a typing
        // indicator immediately.
        streamingMessageId.value = response.data.assistantMessageId
        ensureMessageStream(session.id, response.data.assistantMessageId, '')
      }
    } catch (err) {
      streaming.value = false
      setError(err instanceof Error ? err.message : 'Failed to start chat stream')
    }
  }

  function abort() {
    const id = currentSessionId.value
    if (!id) return
    const ok = sharedAbortRegistry.abort(id)
    // The background also exposes ABORT_CHAT — fire it so the
    // service-worker side of things is in sync even if the local
    // registry was bypassed.
    try {
      chrome.runtime.sendMessage({ type: 'ABORT_CHAT', payload: { sessionId: id } })
    } catch {
      // ignore
    }
    if (ok) {
      streaming.value = false
      streamingMessageId.value = null
      streamingContent.value = ''
    }
  }

  /* ====================== Direct (non-background) actions ====================== */

  /**
   * Skip the background message bus and run the chat stream
   * directly. Useful for tests or for in-process contexts that
   * don't have a service worker to route through.
   */
  async function sendMessageDirect(text: string): Promise<void> {
    const trimmed = text.trim()
    if (!trimmed) return
    setError(null)
    let session = currentSession.value
    if (!session && currentDocument.value) {
      session = await startNewSession(currentDocument.value.id, activeModelId.value ?? undefined)
    }
    if (!session) {
      setError('No active document or session')
      return
    }
    streaming.value = true
    streamingMessageId.value = null
    streamingContent.value = ''
    try {
      const result = await streamChat({
        documentId: session.documentId,
        question: trimmed,
        modelId: activeModelId.value ?? undefined,
        historyId: session.id,
      })
      streamingMessageId.value = result.assistantMessageId
      // The chat service persists both turns and broadcasts the
      // stream events. Reload from disk so the local view matches.
      const fresh = await chatRepository.get(result.historyId)
      if (fresh) upsertLocalSession(fresh)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run chat')
    } finally {
      streaming.value = false
      streamingMessageId.value = null
      streamingContent.value = ''
    }
  }

  return {
    // state
    sessions,
    currentSessionId,
    currentDocument,
    streaming,
    streamingMessageId,
    streamingContent,
    isLoading,
    error,
    activeModelId,
    // getters
    currentSession,
    currentMessages,
    hasActiveSession,
    // actions
    loadForDocument,
    setCurrentDocument,
    setActiveModel,
    startNewSession,
    selectSession,
    deleteSession,
    sendMessage,
    sendMessageDirect,
    abort,
    attachStreamListeners,
    detachStreamListeners,
  }
})

export type ChatStore = ReturnType<typeof useChatStore>
