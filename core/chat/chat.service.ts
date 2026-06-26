/**
 * Chat service — the Background-friendly entry point for "ask
 * the model about this document".
 *
 * This module glues three pieces together:
 *
 *   1. `documentRepository`  — fetch the captured document.
 *   2. `prompt-builder`      — assemble the `Message[]` array.
 *   3. `openai-compat.adapter.chat` — stream the completion and
 *      forward every `delta` back to the caller (and to the side
 *      panel via `CHAT_STREAM_DELTA`).
 *
 * Responsibilities:
 *
 *   - Resolve which model to use (`modelId` argument > the
 *     enabled default).
 *   - Resolve the system prompt (model override > global default
 *     > fallback).
 *   - Create / append to a `ChatHistory` so the conversation is
 *     persisted.
 *   - Allow cancellation via an `AbortSignal` (cancels both the
 *     model request and any in-flight `streamChat` call).
 *   - Stay test-friendly: every I/O dependency is injected so the
 *     unit test can swap a fake adapter / repo without touching
 *     the network or IndexedDB.
 *
 * The service is intentionally small and stateless — Background
 * keeps the per-session `AbortController` map in its own state,
 * this module just exposes the operations.
 */

import type {
  CapturedDocument,
  ChatHistory,
  ChatHistoryMessage,
  ChatMessage as RuntimeChatMessage,
  ModelProviderConfig,
} from '@db/schema'
import type { Message, StreamDelta, ChatMessage as AdapterChatMessage } from '@core/models/types'
import { documentRepository } from '@core/documents/document.repository'
import { modelRepository } from '@core/models/model.repository'
import { modelService } from '@core/models/service'
import { chat } from '@core/models/openai-compat.adapter'
import { sendMessageAsync } from '@shared/messaging/runtime-client'
import { chatRepository } from './chat.repository'
import { buildMessages } from './prompt-builder'

/** Public input for `streamChat`. */
export interface StreamChatInput {
  documentId: string
  question: string
  /** Optional explicit model id; otherwise the enabled default is used. */
  modelId?: string
  /**
   * If provided, append the new turn to this existing session.
   * If omitted, a fresh session is created.
   */
  historyId?: string
  /** Cancel the stream. */
  signal?: AbortSignal
}

/** Public output for `streamChat`. */
export interface StreamChatOutput {
  historyId: string
  userMessageId: string
  assistantMessageId: string
  model: string
}

/** Subset of `documentRepository` we actually depend on. */
export interface DocumentReader {
  get(id: string): Promise<CapturedDocument | undefined>
}

/** Subset of `modelRepository` we actually depend on. */
export interface ModelReader {
  get(id: string): Promise<ModelProviderConfig | undefined>
  getDefault(): Promise<ModelProviderConfig | undefined>
  list(): Promise<ModelProviderConfig[]>
}

/** Subset of `chatRepository` we actually depend on. */
export interface ChatStore {
  get(id: string): Promise<ChatHistory | undefined>
  create(
    history: Omit<ChatHistory, 'createdAt' | 'updatedAt'>
  ): Promise<ChatHistory>
  appendMessage(historyId: string, message: ChatHistoryMessage): Promise<void>
  getForDocument(documentId: string): Promise<ChatHistory[]>
}

/** Subset of `modelService` we actually depend on. */
export interface ModelServiceLike {
  resolveSystemPrompt(modelId?: string): Promise<string>
}

/** The chat-completion function we call into. */
export type ChatStreamFn = (
  config: ModelProviderConfig,
  messages: Message[],
  options: { signal?: AbortSignal; systemPrompt?: string },
  onDelta?: (delta: StreamDelta) => void
) => Promise<AdapterChatMessage>

/** Send a CHAT_STREAM_* message to the side panel(s). */
export type StreamSender = (
  payload:
    | { type: 'CHAT_STREAM_DELTA'; historyId: string; delta: string; messageId: string }
    | { type: 'CHAT_STREAM_DONE'; historyId: string; messageId: string; message: RuntimeChatMessage }
    | { type: 'CHAT_STREAM_ERROR'; historyId: string; error: string }
) => void

/** Default implementations — wired to the real repositories. */
export interface ChatServiceDeps {
  documents: DocumentReader
  models: ModelReader
  chats: ChatStore
  modelService: ModelServiceLike
  chat: ChatStreamFn
  send: StreamSender
  generateId: () => string
  /** Wall clock for tests. */
  now?: () => number
}

/* ====================== Errors ====================== */

/** Thrown when the requested document does not exist. */
export class DocumentNotFoundError extends Error {
  constructor(public readonly documentId: string) {
    super(`Document ${documentId} not found`)
    this.name = 'DocumentNotFoundError'
  }
}

/** Thrown when no model is available. */
export class ModelNotConfiguredError extends Error {
  constructor(message = 'No model configured') {
    super(message)
    this.name = 'ModelNotConfiguredError'
  }
}

/** Thrown when the user cancels the stream. */
export class AbortedStreamError extends Error {
  constructor() {
    super('Stream aborted by caller')
    this.name = 'AbortedStreamError'
  }
}

/* ====================== Implementation ====================== */

/** Default dependency bundle (uses the real repositories + adapter). */
function defaultDeps(): ChatServiceDeps {
  return {
    documents: documentRepository,
    models: modelRepository,
    chats: chatRepository,
    modelService,
    chat,
    send: (payload) => {
      // The StreamSender type accepts only the three stream-related
      // messages; sendMessageAsync is a generic fire-and-forget.
      sendMessageAsync(payload as Parameters<typeof sendMessageAsync>[0])
    },
    generateId: () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    now: () => Date.now(),
  }
}

/**
 * Pick the model config to use, honouring explicit > default > first.
 */
async function pickModel(
  models: ModelReader,
  requestedId?: string
): Promise<ModelProviderConfig> {
  if (requestedId) {
    const m = await models.get(requestedId)
    if (m && m.enabled) return m
    // Caller asked for a specific model that we don't know about
    // (or it's disabled). Fail fast — falling back silently to
    // some other model would be surprising.
    if (m && !m.enabled) {
      throw new ModelNotConfiguredError(`Model ${requestedId} is disabled`)
    }
    throw new ModelNotConfiguredError(`Model ${requestedId} not found`)
  }
  const def = await models.getDefault()
  if (def) return def
  const all = await models.list()
  const enabled = all.find((m) => m.enabled)
  if (!enabled) throw new ModelNotConfiguredError()
  return enabled
}

/**
 * Run a streaming chat completion against the chosen model.
 *
 * The function:
 *
 *  1. Resolves the document + model config.
 *  2. Creates a new `ChatHistory` (or reuses `historyId`).
 *  3. Persists the user message.
 *  4. Calls the adapter with an `onDelta` callback that forwards
 *     each text fragment as a `CHAT_STREAM_DELTA` message.
 *  5. On completion, persists the assistant message and emits
 *     `CHAT_STREAM_DONE`.
 *  6. On error, emits `CHAT_STREAM_ERROR` (and the partial
 *     assistant message is still saved).
 */
export async function streamChat(
  input: StreamChatInput,
  deps?: ChatServiceDeps
): Promise<StreamChatOutput> {
  const resolvedDeps = deps ?? defaultDeps()
  const document = await resolvedDeps.documents.get(input.documentId)
  if (!document) throw new DocumentNotFoundError(input.documentId)

  const model = await pickModel(resolvedDeps.models, input.modelId)
  const systemPrompt = await resolvedDeps.modelService.resolveSystemPrompt(model.id)

  // Resolve / create the history record.
  let history: ChatHistory
  if (input.historyId) {
    const existing = await resolvedDeps.chats.get(input.historyId)
    if (!existing) throw new Error(`Chat history ${input.historyId} not found`)
    history = existing
  } else {
    history = await resolvedDeps.chats.create({
      id: resolvedDeps.generateId(),
      documentId: input.documentId,
      modelId: model.id,
      model: model.name,
      messages: [],
    })
  }

  const now = resolvedDeps.now ? resolvedDeps.now() : Date.now()
  const userMessage: ChatHistoryMessage = {
    id: resolvedDeps.generateId(),
    role: 'user',
    content: input.question,
    createdAt: now,
    model: model.model,
  }
  await resolvedDeps.chats.appendMessage(history.id, userMessage)

  const assistantMessageId = resolvedDeps.generateId()
  const messages: Message[] = buildMessages(
    document,
    input.question,
    history.messages,
    systemPrompt
  )

  let aggregated = ''
  try {
    const final = await resolvedDeps.chat(
      model,
      messages,
      { signal: input.signal, systemPrompt },
      (delta) => {
        if (delta.type === 'text' && delta.content) {
          aggregated += delta.content
          resolvedDeps.send({
            type: 'CHAT_STREAM_DELTA',
            historyId: history.id,
            delta: delta.content,
            messageId: assistantMessageId,
          })
        } else if (delta.type === 'done') {
          // Nothing extra to do; we send a single DONE at the end.
        } else if (delta.type === 'error') {
          resolvedDeps.send({
            type: 'CHAT_STREAM_ERROR',
            historyId: history.id,
            error: delta.error ?? 'unknown error',
          })
        }
      }
    )
    // Use the final aggregated text from the adapter if we somehow
    // missed a delta (rare — but the adapter is the source of truth).
    if (final.content && final.content.length > aggregated.length) {
      aggregated = final.content
    }
    const assistantMessage: ChatHistoryMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: aggregated,
      createdAt: now,
      model: final.model ?? model.model,
      tokens: final.usage?.totalTokens,
    }
    await resolvedDeps.chats.appendMessage(history.id, assistantMessage)

    // Persist the final model id onto the session so the UI can
    // show which model produced the answer even after the user
    // switches the default in settings.
    history.model = final.model ?? model.name
    history.modelId = model.id

    const runtimeMessage: RuntimeChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: aggregated,
      createdAt: now,
      model: final.model ?? model.model,
      tokens: final.usage?.totalTokens,
    }
    resolvedDeps.send({
      type: 'CHAT_STREAM_DONE',
      historyId: history.id,
      messageId: assistantMessageId,
      message: runtimeMessage,
    })

    return {
      historyId: history.id,
      userMessageId: userMessage.id,
      assistantMessageId,
      model: final.model ?? model.model,
    }
  } catch (err) {
    // Persist whatever we got so the user sees a partial answer.
    if (aggregated.length > 0) {
      const partial: ChatHistoryMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: aggregated,
        createdAt: now,
        model: model.model,
        error: err instanceof Error ? err.message : String(err),
      }
      try {
        await resolvedDeps.chats.appendMessage(history.id, partial)
      } catch {
        // ignore — best-effort persistence
      }
    }
    const errorMsg = err instanceof Error ? err.message : String(err)
    resolvedDeps.send({
      type: 'CHAT_STREAM_ERROR',
      historyId: history.id,
      error: errorMsg,
    })
    // Re-throw AbortErrors unchanged so the background can tell
    // user-initiated cancels apart from real failures.
    if (isAbortError(err)) {
      throw new AbortedStreamError()
    }
    throw err
  }
}

/* ====================== Abort registry ====================== */

/**
 * Returns true for both `Error` instances with `name === 'AbortError'`
 * (what `fetch` / `AbortController` reject with) and DOMException
 * aborts (what the browser event-source path raises).
 */
function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const name = (err as { name?: unknown }).name
  return name === 'AbortError'
}

/**
 * Per-historyId AbortController registry. The Background service
 * worker keeps one of these and hands it to `streamChat` so a
 * later `abortChat(historyId)` call can cancel an in-flight
 * completion cleanly.
 */
export class AbortRegistry {
  private readonly controllers = new Map<string, AbortController>()

  /** Create (or replace) the controller for a given historyId. */
  create(historyId: string): AbortSignal {
    const prev = this.controllers.get(historyId)
    if (prev) prev.abort()
    const controller = new AbortController()
    this.controllers.set(historyId, controller)
    return controller.signal
  }

  /** Cancel the controller for the given historyId, if any. */
  abort(historyId: string): boolean {
    const controller = this.controllers.get(historyId)
    if (!controller) return false
    controller.abort()
    this.controllers.delete(historyId)
    return true
  }

  /** Drop the controller reference once a stream finishes cleanly. */
  release(historyId: string): void {
    this.controllers.delete(historyId)
  }
}
