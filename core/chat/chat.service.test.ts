/**
 * chat.service unit tests.
 *
 * We build a hand-rolled fake for every dependency so the test
 * never touches Dexie, the network, or Pinia. The adapter
 * (`deps.chat`) is the one piece that has real semantics; we
 * feed it a programmable mock that yields a sequence of
 * `StreamDelta`s and a final `ChatMessage`.
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../../db/dexie'
import {
  streamChat,
  AbortRegistry,
  DocumentNotFoundError,
  ModelNotConfiguredError,
  AbortedStreamError,
  type ChatServiceDeps,
  type StreamSender,
  type ChatStreamFn,
} from './chat.service'
import { chatRepository } from './chat.repository'
import type {
  CapturedDocument,
  ChatHistoryMessage,
  ModelProviderConfig,
} from '@db/schema'
import type { Message, StreamDelta, ChatMessage as AdapterChatMessage } from '@core/models/types'

/* ====================== Fixtures ====================== */

function makeDoc(overrides: Partial<CapturedDocument> = {}): CapturedDocument {
  return {
    id: 'doc-1',
    url: 'https://example.com',
    title: 'Test',
    markdownContent: '# Hi\n\nBody.',
    wordCount: 2,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  }
}

function makeModel(overrides: Partial<ModelProviderConfig> = {}): ModelProviderConfig {
  return {
    id: 'm1',
    name: 'Test Model',
    provider: 'openai-compatible',
    enabled: true,
    apiKey: 'sk-x',
    baseUrl: 'https://api.example.com/v1',
    model: 'test-model',
    isDefault: true,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

interface ChatCall {
  config: ModelProviderConfig
  messages: Message[]
  options: { signal?: AbortSignal; systemPrompt?: string }
  onDelta?: (delta: StreamDelta) => void
}

/** Build a programmable chat mock. */
function makeChatMock(
  plan: (call: ChatCall) => AsyncIterable<StreamDelta>
): { fn: ChatStreamFn; calls: ChatCall[] } {
  const calls: ChatCall[] = []
  const fn: ChatStreamFn = (config, messages, options, onDelta) => {
    const call: ChatCall = { config, messages, options, onDelta }
    calls.push(call)
    return new Promise<AdapterChatMessage>((resolve, reject) => {
      void (async () => {
        try {
          for await (const d of plan(call)) {
            onDelta?.(d)
          }
          resolve({
            id: 'final-1',
            role: 'assistant',
            content: '',
            createdAt: 0,
            model: config.model,
          })
        } catch (err) {
          reject(err)
        }
      })()
    })
  }
  return { fn, calls }
}

function buildDeps(overrides: Partial<ChatServiceDeps> = {}): ChatServiceDeps {
  const document = overrides.documents?.get
    ? undefined
    : { get: async (id: string) => (id === 'doc-1' ? makeDoc() : undefined) }
  const model = overrides.models?.get
    ? undefined
    : {
        get: async (id: string) => (id === 'm1' ? makeModel() : undefined),
        getDefault: async () => makeModel(),
        list: async () => [makeModel()],
      }
  const chat = overrides.chats?.get
    ? undefined
    : {
        get: async (id: string) => chatRepository.get(id),
        create: async (h: Parameters<typeof chatRepository.create>[0]) =>
          chatRepository.create(h),
        appendMessage: chatRepository.appendMessage,
        getForDocument: chatRepository.getForDocument,
      }
  const modelService = overrides.modelService ?? {
    resolveSystemPrompt: async () => 'You are a helpful assistant.',
  }
  const defaultSend: StreamSender = () => undefined
  return {
    documents: (document as ChatServiceDeps['documents']) ??
      (overrides.documents as ChatServiceDeps['documents']),
    models:
      (model as ChatServiceDeps['models']) ?? (overrides.models as ChatServiceDeps['models']),
    chats: (chat as ChatServiceDeps['chats']) ?? (overrides.chats as ChatServiceDeps['chats']),
    modelService,
    chat: overrides.chat ?? (async () => ({ id: 'x', role: 'assistant', content: '', createdAt: 0 })),
    send: overrides.send ?? defaultSend,
    generateId: overrides.generateId ?? (() => `id-${Math.random().toString(36).slice(2, 8)}`),
    now: overrides.now ?? (() => 1_700_000_000_000),
  }
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  await chatRepository.clear()
})

/* ====================== Tests ====================== */

describe('streamChat', () => {
  it('throws DocumentNotFoundError when the document is missing', async () => {
    const deps = buildDeps({
      documents: { get: async () => undefined },
    })
    await expect(streamChat({ documentId: 'missing', question: 'q' }, deps)).rejects.toBeInstanceOf(
      DocumentNotFoundError
    )
  })

  it('throws ModelNotConfiguredError when no model is available', async () => {
    const deps = buildDeps({
      models: {
        get: async () => undefined,
        getDefault: async () => undefined,
        list: async () => [],
      },
    })
    await expect(streamChat({ documentId: 'doc-1', question: 'q' }, deps)).rejects.toBeInstanceOf(
      ModelNotConfiguredError
    )
  })

  it('throws ModelNotConfiguredError when an explicit model is disabled', async () => {
    const deps = buildDeps({
      models: {
        get: async () => makeModel({ id: 'm1', enabled: false }),
        getDefault: async () => makeModel(),
        list: async () => [makeModel({ enabled: false })],
      },
    })
    await expect(
      streamChat({ documentId: 'doc-1', question: 'q', modelId: 'm1' }, deps)
    ).rejects.toThrow(/disabled/)
  })

  it('streams deltas, persists both turns, and emits a DONE', async () => {
    const send = vi.fn() as unknown as StreamSender
    const chatMock = makeChatMock(async function* () {
      yield { type: 'text', content: 'Hello' }
      yield { type: 'text', content: ' world' }
      yield { type: 'done', finishReason: 'stop' }
    })
    const deps = buildDeps({ chat: chatMock.fn, send })

    const result = await streamChat({ documentId: 'doc-1', question: 'What?' }, deps)

    expect(result.historyId).toBeTruthy()
    expect(result.userMessageId).toBeTruthy()
    expect(result.assistantMessageId).toBeTruthy()
    expect(chatMock.calls).toHaveLength(1)
    expect(chatMock.calls[0].messages[0].role).toBe('system')
    expect(chatMock.calls[0].messages[1].role).toBe('user')
    expect(chatMock.calls[0].messages[1].content).toContain('Document context')

    // Side-panel sees the deltas + DONE.
    const sentTypes = (send as unknown as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0].type
    )
    expect(sentTypes).toEqual([
      'CHAT_STREAM_DELTA',
      'CHAT_STREAM_DELTA',
      'CHAT_STREAM_DONE',
    ])
    const doneCall = (send as unknown as ReturnType<typeof vi.fn>).mock.calls[2][0]
    expect(doneCall.message.content).toBe('Hello world')

    // Both turns are persisted.
    const stored = await chatRepository.get(result.historyId)
    expect(stored?.messages).toHaveLength(2)
    expect(stored?.messages[0].role).toBe('user')
    expect(stored?.messages[0].content).toBe('What?')
    expect(stored?.messages[1].role).toBe('assistant')
    expect(stored?.messages[1].content).toBe('Hello world')
  })

  it('honours an explicit modelId', async () => {
    const chatMock = makeChatMock(async function* () {
      yield { type: 'text', content: 'x' }
    })
    const deps = buildDeps({ chat: chatMock.fn })
    await streamChat({ documentId: 'doc-1', question: 'q', modelId: 'm1' }, deps)
    expect(chatMock.calls[0].config.id).toBe('m1')
  })

  it('appends to an existing historyId instead of creating a new one', async () => {
    const existing = await chatRepository.create({
      id: 'existing-1',
      documentId: 'doc-1',
      modelId: 'm1',
      model: 'Test Model',
      messages: [
        { id: 'm-prev', role: 'user', content: 'old q', createdAt: 1 },
      ],
    })
    const chatMock = makeChatMock(async function* () {
      yield { type: 'text', content: 'reply' }
    })
    const deps = buildDeps({ chat: chatMock.fn })
    const result = await streamChat(
      { documentId: 'doc-1', question: 'new q', historyId: existing.id },
      deps
    )
    expect(result.historyId).toBe(existing.id)
    const stored = await chatRepository.get(existing.id)
    expect(stored?.messages).toHaveLength(3)
    expect(stored?.messages.map((m: ChatHistoryMessage) => m.content)).toEqual([
      'old q',
      'new q',
      'reply',
    ])
  })

  it('throws when an unknown historyId is provided', async () => {
    const deps = buildDeps()
    await expect(
      streamChat(
        { documentId: 'doc-1', question: 'q', historyId: 'does-not-exist' },
        deps
      )
    ).rejects.toThrow(/not found/)
  })

  it('persists a partial assistant message and re-throws on adapter error', async () => {
    const send = vi.fn() as unknown as StreamSender
    const chatMock = makeChatMock(async function* () {
      yield { type: 'text', content: 'partial ' }
      yield { type: 'error', error: 'boom' }
      throw new Error('boom')
    })
    const deps = buildDeps({ chat: chatMock.fn, send })

    await expect(streamChat({ documentId: 'doc-1', question: 'q' }, deps)).rejects.toThrow('boom')

    const sentTypes = (send as unknown as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0].type
    )
    expect(sentTypes).toContain('CHAT_STREAM_ERROR')
    const sent = (send as unknown as ReturnType<typeof vi.fn>).mock.calls
    const errCall = sent.find((c: { 0: { type: string } }) => c[0].type === 'CHAT_STREAM_ERROR')
    expect(errCall[0].error).toBe('boom')

    // The partial assistant message is still saved.
    const stored = await chatRepository.get(errCall[0].historyId)
    const assistant = stored?.messages.find((m) => m.role === 'assistant')
    expect(assistant?.content).toBe('partial ')
    expect(assistant?.error).toBe('boom')
  })

  it('converts AbortError into AbortedStreamError', async () => {
    const chatMock = makeChatMock(async function* () {
      // The signal will be aborted before we even iterate.
      yield { type: 'text', content: 'will not get here' }
      throw new DOMException('aborted', 'AbortError')
    })
    const deps = buildDeps({ chat: chatMock.fn })
    await expect(streamChat({ documentId: 'doc-1', question: 'q' }, deps)).rejects.toBeInstanceOf(
      AbortedStreamError
    )
  })
})

describe('AbortRegistry', () => {
  it('create() returns a fresh signal and abort() cancels it', () => {
    const reg = new AbortRegistry()
    const sig = reg.create('h1')
    expect(sig.aborted).toBe(false)
    expect(reg.abort('h1')).toBe(true)
    expect(sig.aborted).toBe(true)
    expect(reg.abort('h1')).toBe(false) // already removed
  })

  it('create() replaces an existing controller (cancelling the previous one)', () => {
    const reg = new AbortRegistry()
    const sig1 = reg.create('h1')
    const sig2 = reg.create('h1')
    expect(sig1.aborted).toBe(true)
    expect(sig2.aborted).toBe(false)
  })

  it('release() drops the controller reference without aborting', () => {
    const reg = new AbortRegistry()
    const sig = reg.create('h1')
    reg.release('h1')
    expect(sig.aborted).toBe(false)
    expect(reg.abort('h1')).toBe(false)
  })
})
