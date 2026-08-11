import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'
import type { ConversationEntity, ChatMessage } from '../types/chat'
import type { ModelConfig } from '../types/model'
import type { AppSettings } from '../types/settings'

// ── Mock ChatRepository ────────────────────────────────
const chatDb = new Map<string, ConversationEntity>()

vi.mock('../db/repositories/chat.repository', () => ({
  ChatRepository: {
    findById: vi.fn(async (id: string) => chatDb.get(id)),
    findAll: vi.fn(async () => Array.from(chatDb.values())),
    findByDocumentId: vi.fn(async (documentId: string) =>
      Array.from(chatDb.values()).filter((c) => c.documentId === documentId),
    ),
    save: vi.fn(async (conv: ConversationEntity) => {
      chatDb.set(conv.id, { ...conv })
      return { ...conv }
    }),
    delete: vi.fn(async (id: string) => {
      chatDb.delete(id)
    }),
  },
}))

// ── Mock ModelRepository (real modelStore uses this) ────
const modelDb = new Map<string, ModelConfig>()

vi.mock('../db/repositories/model.repository', () => ({
  ModelRepository: {
    findAll: vi.fn(async () => Array.from(modelDb.values())),
    findById: vi.fn(async (id: string) => modelDb.get(id)),
    save: vi.fn(async (model: ModelConfig) => {
      modelDb.set(model.id, { ...model })
      return { ...model }
    }),
    delete: vi.fn(async (id: string) => {
      modelDb.delete(id)
    }),
  },
}))

// ── Mock SettingsRepository ─────────────────────────────
vi.mock('../db/repositories/settings.repository', () => ({
  SettingsRepository: {
    get: vi.fn(async () => undefined),
    save: vi.fn(async (_s: AppSettings) => {}),
  },
}))

// ── Mock AI Factory ────────────────────────────────────
const mockStreamChat = vi.fn()
vi.mock('../services/ai/factory', () => ({
  createProvider: vi.fn(() => ({
    chat: vi.fn(),
    streamChat: mockStreamChat,
    testConnection: vi.fn(),
  })),
}))

// ── Mock PromptBuilder (class to allow `new`) ──────────
const mockBuild = vi.fn()
vi.mock('../services/prompt/builder', () => ({
  PromptBuilder: class {
    build = mockBuild
  },
}))

// ── Mock truncate ──────────────────────────────────────
vi.mock('../services/prompt/truncate', () => ({
  truncateContext: vi.fn((text: string) => text),
}))

import { useChatStore } from './chat.store'
import { useModelStore } from './model.store'
import { useDocumentStore } from './document.store'

// ── Helpers ────────────────────────────────────────────
function makeModel(overrides: Partial<ModelConfig> = {}): ModelConfig {
  return {
    id: 'm1',
    name: 'GPT-4',
    provider: 'openai-compatible',
    modelId: 'gpt-4',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'sk-test',
    enabled: true,
    isDefault: true,
    contextWindow: 128000,
    temperature: 0.9,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeConv(id: string, documentId: string): ConversationEntity {
  return {
    id,
    documentId,
    title: 'Test Conversation',
    messages: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function setupStreamSuccess(content: string) {
  mockBuild.mockImplementation((input: { context?: string; history?: Array<{ role: 'user' | 'assistant'; content: string }>; userInput: string; systemPrompt?: string }) => ({
    messages: [
      ...(input.history ?? []),
      ...([input.context, input.userInput].filter(Boolean).join('\n\n')
        ? [{ role: 'user', content: [input.context, input.userInput].filter(Boolean).join('\n\n') }]
        : []),
    ],
    system: input.systemPrompt,
  }))
  mockStreamChat.mockImplementation(
    async (
      _input: any,
      callbacks: { onToken: (t: string) => void; onDone: () => void; onError: (e: Error) => void },
    ) => {
      callbacks.onToken(content)
      callbacks.onDone()
    },
  )
}

async function seedModel(overrides: Partial<ModelConfig> = {}) {
  const model = makeModel(overrides)
  modelDb.set(model.id, model)
  const modelStore = useModelStore()
  await modelStore.loadModels()
  modelStore.selectModel(model.id)
  return model
}

// ── Tests ──────────────────────────────────────────────
describe('stores/chat.store', () => {
  let timeCursor = 1700000000000

  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    chatDb.clear()
    modelDb.clear()

    // Each Date.now() call returns 60s+ later than previous to avoid
    // the 60s rate limiter blocking tests that call sendMessage in sequence.
    vi.spyOn(Date, 'now').mockImplementation(() => {
      timeCursor += 60_001
      return timeCursor
    })
  })

  // 1. Default values
  it('should initialize with default values', () => {
    const store = useChatStore()
    expect(store.messages).toEqual([])
    expect(store.conversations).toEqual([])
    expect(store.currentConversationId).toBeNull()
    expect(store.currentDocumentId).toBeNull()
    expect(store.inputText).toBe('')
    expect(store.isStreaming).toBe(false)
    expect(store.isSending).toBe(false)
  })

  // 2. setInputText
  it('should set input text', () => {
    const store = useChatStore()
    store.setInputText('Hello AI')
    expect(store.inputText).toBe('Hello AI')
  })

  // 2b. setIncludeContext (toggle for "include page context when sending")
  it('should default includeContext to true', () => {
    const store = useChatStore()
    expect(store.includeContext).toBe(true)
  })

  it('setIncludeContext should update the includeContext flag', () => {
    const store = useChatStore()
    store.setIncludeContext(false)
    expect(store.includeContext).toBe(false)
    store.setIncludeContext(true)
    expect(store.includeContext).toBe(true)
  })

  // 3. sendMessage appends messages to list
  it('sendMessage should append user and assistant messages', async () => {
    await seedModel()
    setupStreamSuccess('Hello!')
    const store = useChatStore()
    await store.createConversation('doc-1')

    await store.sendMessage('Hi')

    expect(store.messages).toHaveLength(2)
    expect(store.messages[0].role).toBe('user')
    expect(store.messages[0].content).toBe('Hi')
    expect(store.messages[1].role).toBe('assistant')
    expect(store.messages[1].content).toBe('Hello!')
    expect(store.messages[1].status).toBe('success')
  })

  it('should send page context to the model on the first turn but keep the persisted user message clean (option 3)', async () => {
    await seedModel()
    setupStreamSuccess('Summary')
    const store = useChatStore()
    const documentStore = useDocumentStore()
    documentStore.setCurrentDocument({
      id: 'doc-1',
      title: 'Page',
      url: 'https://example.com',
      markdown: 'Page content',
      wordCount: 2,
      tokenCount: 2,
      contentHash: 'hash',
      extractionMethod: 'manual',
      source: 'library',
      capturedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    await store.createConversation('doc-1')

    await store.sendMessage('')

    // Context reaches the model this turn (re-attached from the bound doc)...
    expect(mockBuild).toHaveBeenCalledWith(expect.objectContaining({ userInput: '' }))
    const builtInput = mockBuild.mock.calls.at(-1)![0]
    expect(builtInput.context).toContain('Page content')
    // ...but the persisted user message stays clean (option 3: DB never
    // stores the page; the model re-sees it each turn from the document).
    expect(store.messages[0].content).toBe('')
  })

  // Regression: a mounted page MUST reach the model on the first turn even
  // when the user typed a question. Previously a buggy guard made
  // hasAttachablePageContext() return false whenever any message existed,
  // so only the bare question was sent.
  it('should attach page context to the model request on the first turn even with a non-empty question', async () => {
    await seedModel()
    setupStreamSuccess('Answer')
    const store = useChatStore()
    const documentStore = useDocumentStore()
    documentStore.setCurrentDocument({
      id: 'doc-1',
      title: 'Page',
      url: 'https://example.com',
      markdown: 'Page body',
      wordCount: 2,
      tokenCount: 2,
      contentHash: 'hash',
      extractionMethod: 'manual',
      source: 'library',
      capturedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    await store.createConversation('doc-1')

    await store.sendMessage('What is this about?')

    const builtInput = mockBuild.mock.calls.at(-1)![0]
    expect(builtInput.context).toContain('Page body')
    expect(builtInput.userInput).toBe('What is this about?')
    // Persisted user message stays clean (option 3): DB never stores the page.
    expect(store.messages[0].content).toBe('What is this about?')
  })

  // Option 3 payoff: the model sees the page on EVERY turn (re-attached from
  // the bound document), while the persisted user message stays clean.
  it('should re-attach page context on turn 2 from the bound document (option 3)', async () => {
    await seedModel()
    const store = useChatStore()
    const documentStore = useDocumentStore()
    documentStore.setCurrentDocument({
      id: 'doc-1',
      title: 'Page',
      url: 'https://example.com',
      markdown: 'Page body',
      wordCount: 2,
      tokenCount: 2,
      contentHash: 'hash',
      extractionMethod: 'manual',
      source: 'library',
      capturedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    await store.createConversation('doc-1')

    setupStreamSuccess('First answer')
    await store.sendMessage('Q1')
    setupStreamSuccess('Second answer')
    await store.sendMessage('Q2')

    // Turn 2: page is re-attached as context (not via history) — the bound
    // document is the single source of truth. User message in history stays
    // as the bare question.
    const secondBuilt = mockBuild.mock.calls.at(-1)![0]
    expect(secondBuilt.context).toContain('Page body')
    expect(secondBuilt.userInput).toBe('Q2')
    const historyUserMsg = secondBuilt.history?.find((h: { role: string; content: string }) => h.role === 'user')
    expect(historyUserMsg?.content).toBe('Q1')
  })

  // 4. sendMessage validation: no model selected
  it('sendMessage should fail when no model is selected', async () => {
    // No model seeded → models array empty → currentModel is null
    const store = useChatStore()
    await store.createConversation('doc-1')

    await expect(store.sendMessage('Hi')).rejects.toThrow('No model selected')
  })

  // 5. sendMessage validation: model disabled
  it('sendMessage should fail when model is disabled', async () => {
    await seedModel({ enabled: false })
    const store = useChatStore()
    await store.createConversation('doc-1')

    await expect(store.sendMessage('Hi')).rejects.toThrow('disabled')
  })

  // 6. sendMessage validation: missing API key (non-Ollama)
  it('sendMessage should fail when API key is missing for OpenAI provider', async () => {
    await seedModel({ apiKey: undefined })
    const store = useChatStore()
    await store.createConversation('doc-1')

    await expect(store.sendMessage('Hi')).rejects.toThrow('API key')
  })

  // 7. sendMessage validation: missing baseUrl
  it('sendMessage should fail when baseUrl is missing', async () => {
    await seedModel({ baseUrl: undefined })
    const store = useChatStore()
    await store.createConversation('doc-1')

    await expect(store.sendMessage('Hi')).rejects.toThrow('base URL')
  })

  // 8. sendMessage permits Ollama without API key
  it('sendMessage should allow Ollama without API key', async () => {
    await seedModel({ provider: 'ollama', apiKey: undefined, baseUrl: 'http://localhost:11434' })
    setupStreamSuccess('Ollama response')
    const store = useChatStore()
    await store.createConversation('doc-1')

    await store.sendMessage('Hi')

    expect(store.messages).toHaveLength(2)
    expect(store.messages[1].status).toBe('success')
  })

  // 9. stopGeneration preserves generated content
  it('stopGeneration should preserve generated content and mark aborted', async () => {
    await seedModel()
    mockBuild.mockReturnValue({
      messages: [{ role: 'user', content: 'test' }],
      system: undefined,
    })
    mockStreamChat.mockImplementation(
      async (
        _input: any,
        callbacks: { onToken: (t: string) => void; onDone: () => void; onError: (e: Error) => void },
      ) => {
        callbacks.onToken('Partial response')
        await new Promise((resolve) => setTimeout(resolve, 50))
      },
    )

    const store = useChatStore()
    await store.createConversation('doc-1')

    const sendPromise = store.sendMessage('Hi')
    await new Promise((resolve) => setTimeout(resolve, 10))
    store.stopGeneration()

    try {
      await sendPromise
    } catch {
      // Expected
    }

    const lastMsg = store.messages[store.messages.length - 1]
    expect(lastMsg.role).toBe('assistant')
    expect(lastMsg.status).toBe('aborted')
    expect(lastMsg.content).toContain('Partial response')
  })

  // 10. regenerate
  it('regenerate should remove last assistant message and resend', async () => {
    await seedModel()
    const store = useChatStore()
    await store.createConversation('doc-1')

    setupStreamSuccess('First response')
    await store.sendMessage('Question 1')
    expect(store.messages).toHaveLength(2)

    setupStreamSuccess('Regenerated response')
    await store.regenerate()

    expect(store.messages).toHaveLength(2)
    expect(store.messages[1].content).toBe('Regenerated response')
    expect(store.messages[0].content).toBe('Question 1')
  })

  it('regenerate should use the original assistant model', async () => {
    const original = await seedModel({ id: 'original', name: 'Original', modelId: 'original-model' })
    await useModelStore().addModel(makeModel({ id: 'current', name: 'Current', modelId: 'current-model' }))
    const modelStore = useModelStore()
    modelStore.selectModel('current')
    const store = useChatStore()
    await store.createConversation('doc-1')
    store.messages.push(
      { id: 'u1', role: 'user', content: 'Question', status: 'success', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'a1', role: 'assistant', content: 'Answer', modelId: original.modelId, modelConfigId: original.id, status: 'success', createdAt: '2026-01-01T00:00:01.000Z' },
    )
    setupStreamSuccess('Again')
    await store.regenerate('a1')

    expect(store.messages[1].modelConfigId).toBe(original.id)
    expect(mockStreamChat.mock.calls.at(-1)?.[0].model.id).toBe(original.id)
  })

  // #3 regression: an empty first question must still produce a non-blank
  // conversation title (falls back to the document title).
  it('should fall back to the document title when the first question is empty', async () => {
    await seedModel()
    setupStreamSuccess('Summary')
    const store = useChatStore()
    const documentStore = useDocumentStore()
    documentStore.setCurrentDocument({
      id: 'doc-1',
      title: 'My Page Title',
      url: 'https://example.com',
      markdown: 'body',
      wordCount: 1,
      tokenCount: 1,
      contentHash: 'h',
      extractionMethod: 'manual',
      source: 'library',
      capturedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    await store.createConversation('doc-1')

    await store.sendMessage('')

    const conv = chatDb.get(store.currentConversationId!)
    expect(conv?.title).toBe('My Page Title')
  })

  // #4 regression: regenerating the FIRST assistant turn must re-attach the
  // page context — otherwise the model regenerates without seeing the page.
  it('regenerate of the first turn should re-attach page context', async () => {
    await seedModel()
    const store = useChatStore()
    const documentStore = useDocumentStore()
    documentStore.setCurrentDocument({
      id: 'doc-1',
      title: 'Page',
      url: 'https://example.com',
      markdown: 'First-turn page body',
      wordCount: 3,
      tokenCount: 3,
      contentHash: 'h',
      extractionMethod: 'manual',
      source: 'library',
      capturedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    await store.createConversation('doc-1')

    setupStreamSuccess('First answer')
    await store.sendMessage('Summarize')

    // Second turn so history exists — proves regenerate targets the first turn.
    setupStreamSuccess('Second answer')
    await store.sendMessage('More?')

    // Regenerate the first assistant message.
    const firstAssistant = store.messages.find((m) => m.role === 'assistant')!
    setupStreamSuccess('Regenerated')
    await store.regenerate(firstAssistant.id)

    const builtInput = mockBuild.mock.calls.at(-1)![0]
    expect(builtInput.context).toContain('First-turn page body')
  })

  it('regenerate of a later turn should re-attach page context (option 3: every turn)', async () => {
    await seedModel()
    const store = useChatStore()
    const documentStore = useDocumentStore()
    documentStore.setCurrentDocument({
      id: 'doc-1',
      title: 'Page',
      url: 'https://example.com',
      markdown: 'Page body',
      wordCount: 2,
      tokenCount: 2,
      contentHash: 'h',
      extractionMethod: 'manual',
      source: 'library',
      capturedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    await store.createConversation('doc-1')

    setupStreamSuccess('First answer')
    await store.sendMessage('Q1')
    setupStreamSuccess('Second answer')
    await store.sendMessage('Q2')

    // Regenerate the second assistant message (a later turn).
    const assistants = store.messages.filter((m) => m.role === 'assistant')
    const secondAssistant = assistants[assistants.length - 1]
    setupStreamSuccess('Regenerated')
    await store.regenerate(secondAssistant.id)

    const builtInput = mockBuild.mock.calls.at(-1)![0]
    expect(builtInput.context).toContain('Page body')
  })

  // #2 regression: regenerating a multi-model round must re-run ALL models
  // of that round, not just the last bubble. Previously the no-arg path
  // popped a single assistant, silently dropping the other models' answers.
  it('regenerate (no arg) of a multi-model round should regenerate every model', async () => {
    const m1 = await seedModel({ id: 'm1', name: 'Model One', modelId: 'model-one' })
    const m2 = makeModel({ id: 'm2', name: 'Model Two', modelId: 'model-two' })
    modelDb.set(m2.id, m2)
    const modelStore = useModelStore()
    await modelStore.loadModels()
    modelStore.setSelectedModelIds([m1.id, m2.id])

    const store = useChatStore()
    await store.createConversation('doc-1')

    setupStreamSuccess('answer')
    await store.sendMessage('Q', [m1.id, m2.id])

    // Two assistants for the single user turn.
    expect(store.messages.filter((m) => m.role === 'assistant')).toHaveLength(2)

    setupStreamSuccess('regenerated')
    await store.regenerate()

    // Still two assistants after regenerate — none dropped.
    const assistants = store.messages.filter((m) => m.role === 'assistant')
    expect(assistants).toHaveLength(2)
    // Both were re-run: two distinct modelConfigIds, both regenerated content.
    const configIds = new Set(assistants.map((m) => m.modelConfigId))
    expect(configIds).toEqual(new Set([m1.id, m2.id]))
    expect(assistants.every((m) => m.content === 'regenerated')).toBe(true)
  })

  // 11. Streaming state
  it('should set streaming/sending states during sendMessage lifecycle', async () => {
    await seedModel()

    let capturedDuringStream: { isStreaming: boolean; isSending: boolean } | undefined

    mockBuild.mockReturnValue({
      messages: [{ role: 'user', content: 'test' }],
      system: undefined,
    })
    mockStreamChat.mockImplementation(
      async (
        _input: any,
        callbacks: { onToken: (t: string) => void; onDone: () => void; onError: (e: Error) => void },
      ) => {
        // Let the store's reactive watch (which sets isStreaming/isSending) flush.
        await nextTick()
        capturedDuringStream = {
          isStreaming: store.isStreaming,
          isSending: store.isSending,
        }
        callbacks.onToken('ok')
        callbacks.onDone()
      },
    )

    const store = useChatStore()
    await store.createConversation('doc-1')

    expect(store.isStreaming).toBe(false)
    expect(store.isSending).toBe(false)

    await store.sendMessage('Hi')

    expect(capturedDuringStream!.isStreaming).toBe(true)
    expect(capturedDuringStream!.isSending).toBe(true)
    expect(store.isStreaming).toBe(false)
    expect(store.isSending).toBe(false)
  })

  // 12. canSend computed
  describe('canSend', () => {
    it('should return false when input is empty', async () => {
      await seedModel()
      const store = useChatStore()
      store.setInputText('')
      expect(store.canSend).toBe(false)
    })

    it('should return true when input is non-empty and model is valid', async () => {
      await seedModel()
      const store = useChatStore()
      store.setInputText('Hello')
      expect(store.canSend).toBe(true)
    })

    it('should return false when no model is available', () => {
      // No model seeded
      const store = useChatStore()
      store.setInputText('Hello')
      expect(store.canSend).toBe(false)
    })

    it('should return false when model is disabled', async () => {
      await seedModel({ enabled: false })
      const store = useChatStore()
      store.setInputText('Hello')
      expect(store.canSend).toBe(false)
    })

    it('should return false when no baseUrl', async () => {
      await seedModel({ baseUrl: undefined })
      const store = useChatStore()
      store.setInputText('Hello')
      expect(store.canSend).toBe(false)
    })

    it('should return false when no API key for non-Ollama', async () => {
      await seedModel({ apiKey: undefined })
      const store = useChatStore()
      store.setInputText('Hello')
      expect(store.canSend).toBe(false)
    })

    it('should return true for Ollama without API key', async () => {
      await seedModel({ provider: 'ollama', apiKey: undefined, baseUrl: 'http://localhost:11434' })
      const store = useChatStore()
      store.setInputText('Hello')
      expect(store.canSend).toBe(true)
    })
  })

  // 13. createConversation
  it('createConversation should create and set as current', async () => {
    const store = useChatStore()
    const conv = await store.createConversation('doc-abc', 'My Chat')

    expect(conv.id).toBeTruthy()
    expect(conv.documentId).toBe('doc-abc')
    expect(conv.title).toBe('My Chat')
    expect(store.currentConversationId).toBe(conv.id)
    expect(store.currentDocumentId).toBe('doc-abc')
    expect(store.messages).toEqual([])
  })

  // 13b. createConversation defaults title to '新对话'
  it('createConversation should default title to 新对话', async () => {
    const store = useChatStore()
    const conv = await store.createConversation('doc-xyz')

    expect(conv.title).toBe('新对话')
  })

  // 13c. loadConversations loads all conversations for a document
  it('loadConversations should load and sort conversations for a document', async () => {
    const conv1 = makeConv('c1', 'doc-load')
    conv1.updatedAt = '2026-02-01T00:00:00.000Z'
    conv1.messages = [{ id: 'm1', role: 'user', content: 'Hi', status: 'success', createdAt: '2026-02-01T00:00:00.000Z' }]
    const conv2 = makeConv('c2', 'doc-load')
    conv2.updatedAt = '2026-03-01T00:00:00.000Z'
    conv2.messages = [{ id: 'm2', role: 'user', content: 'Hello', status: 'success', createdAt: '2026-03-01T00:00:00.000Z' }]
    const conv3 = makeConv('c3', 'doc-other')
    chatDb.set(conv1.id, conv1)
    chatDb.set(conv2.id, conv2)
    chatDb.set(conv3.id, conv3)

    const store = useChatStore()
    await store.loadConversations('doc-load')

    expect(store.conversations).toHaveLength(2)
    // Most recent first
    expect(store.conversations[0].id).toBe('c2')
    expect(store.conversations[1].id).toBe('c1')
    // Default to most recent conversation
    expect(store.currentConversationId).toBe('c2')
    expect(store.messages).toHaveLength(1)
    expect(store.currentDocumentId).toBe('doc-load')
  })

  // 13d. loadConversations with no history creates none
  it('loadConversations with no history should leave empty state', async () => {
    const store = useChatStore()
    await store.loadConversations('doc-empty')

    expect(store.conversations).toHaveLength(0)
    expect(store.currentConversationId).toBeNull()
    expect(store.messages).toEqual([])
    expect(store.currentDocumentId).toBe('doc-empty')
  })

  it('branchConversationAt should copy through the selected message into a new active conversation', async () => {
    const source = makeConv('source', 'doc-branch')
    source.title = 'Original'
    source.messages = [
      { id: 'u1', role: 'user', content: 'First', status: 'success', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'a1', role: 'assistant', content: 'Reply', status: 'success', createdAt: '2026-01-01T00:01:00.000Z' },
      { id: 'u2', role: 'user', content: 'Later', status: 'success', createdAt: '2026-01-01T00:02:00.000Z' },
    ]
    chatDb.set(source.id, source)

    const store = useChatStore()
    await store.loadConversations('doc-branch')
    const branch = await store.branchConversationAt('a1')

    expect(branch.id).not.toBe(source.id)
    expect(branch.title).toBe('Original 分支')
    expect(branch.messages.map((message) => message.id)).toEqual(['u1', 'a1'])
    expect(store.currentConversationId).toBe(branch.id)
    expect(store.messages.map((message) => message.id)).toEqual(['u1', 'a1'])
    expect(chatDb.get(source.id)?.messages).toHaveLength(3)
  })

  // 13e. switchConversation switches active conversation
  it('switchConversation should switch active conversation and load messages', async () => {
    const conv1 = makeConv('c1', 'doc-1')
    conv1.updatedAt = '2026-01-01T00:00:00.000Z'
    conv1.messages = [{ id: 'm1', role: 'user', content: 'Message in C1', status: 'success', createdAt: '2026-01-01T00:00:00.000Z' }]
    const conv2 = makeConv('c2', 'doc-1')
    conv2.updatedAt = '2026-02-01T00:00:00.000Z'
    conv2.messages = [{ id: 'm2', role: 'user', content: 'Message in C2', status: 'success', createdAt: '2026-02-01T00:00:00.000Z' }]
    chatDb.set(conv1.id, conv1)
    chatDb.set(conv2.id, conv2)

    const store = useChatStore()
    await store.loadConversations('doc-1')
    expect(store.currentConversationId).toBe('c2') // most recent

    await store.switchConversation('c1')
    expect(store.currentConversationId).toBe('c1')
    expect(store.messages[0].content).toBe('Message in C1')
  })

  // 13f. deleteConversation removes from list and switches to next
  it('deleteConversation should remove and switch to next conversation', async () => {
    const conv1 = makeConv('c1', 'doc-1')
    conv1.updatedAt = '2026-01-01T00:00:00.000Z'
    const conv2 = makeConv('c2', 'doc-1')
    conv2.updatedAt = '2026-02-01T00:00:00.000Z'
    chatDb.set(conv1.id, conv1)
    chatDb.set(conv2.id, conv2)

    const store = useChatStore()
    await store.loadConversations('doc-1')
    expect(store.conversations).toHaveLength(2)

    // Delete active (most recent = c2)
    await store.deleteConversation('c2')
    expect(store.conversations).toHaveLength(1)
    expect(store.conversations[0].id).toBe('c1')
    expect(store.currentConversationId).toBe('c1')
  })

  // 13g. deleteConversation clears state when last conversation deleted
  it('deleteConversation should clear state when last conversation deleted', async () => {
    const conv = makeConv('c1', 'doc-1')
    chatDb.set(conv.id, conv)

    const store = useChatStore()
    await store.loadConversations('doc-1')
    await store.deleteConversation('c1')

    expect(store.conversations).toHaveLength(0)
    expect(store.currentConversationId).toBeNull()
    expect(store.messages).toEqual([])
  })

  // 14. loadConversation
  it('loadConversation should load messages from DB', async () => {
    const conv = makeConv('conv-1', 'doc-1')
    conv.messages = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        status: 'success' as const,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]
    chatDb.set(conv.id, conv)

    const store = useChatStore()
    await store.loadConversation('conv-1')

    expect(store.currentConversationId).toBe('conv-1')
    expect(store.messages).toHaveLength(1)
    expect(store.messages[0].content).toBe('Hello')
  })

  // 15. deleteConversation
  it('deleteConversation should clear active conversation', async () => {
    const store = useChatStore()
    const conv = await store.createConversation('doc-1')

    await store.deleteConversation(conv.id)

    expect(store.currentConversationId).toBeNull()
    expect(store.messages).toEqual([])
  })

  // 16. Error status marking on stream error
  it('sendMessage should mark assistant as failed on stream error', async () => {
    await seedModel()
    mockBuild.mockReturnValue({
      messages: [{ role: 'user', content: 'test' }],
      system: undefined,
    })
    mockStreamChat.mockImplementation(
      async (
        _input: any,
        callbacks: { onToken: (t: string) => void; onDone: () => void; onError: (e: Error) => void },
      ) => {
        callbacks.onError(new Error('Network timeout'))
      },
    )

    const store = useChatStore()
    await store.createConversation('doc-1')

    await store.sendMessage('Hi')

    const lastMsg = store.messages[store.messages.length - 1]
    expect(lastMsg.status).toBe('failed')
    expect(lastMsg.error).toContain('Network timeout')
  })

  // 17. sendMessage should fail when already sending
  it('should enqueue steering messages and persist them with the conversation', async () => {
    const store = useChatStore()
    await store.createConversation('doc-queue')

    store.enqueueMessage('Next question', ['m1'])
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(store.steeringQueue).toHaveLength(1)
    expect(store.steeringQueue[0].content).toBe('Next question')
    expect(chatDb.get(store.currentConversationId!)?.steeringQueue?.[0].content).toBe('Next question')

    await store.removeQueuedMessage(store.steeringQueue[0].id)
    expect(store.steeringQueue).toHaveLength(0)
  })

  it('should preserve the old path when restoring to a message node', async () => {
    const conv = makeConv('restore-source', 'doc-restore')
    conv.messages = [
      { id: 'u1', role: 'user', content: 'First', status: 'success', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'a1', role: 'assistant', content: 'Answer', status: 'success', createdAt: '2026-01-01T00:01:00.000Z' },
      { id: 'u2', role: 'user', content: 'Later', status: 'success', createdAt: '2026-01-01T00:02:00.000Z' },
    ]
    chatDb.set(conv.id, conv)

    const store = useChatStore()
    await store.loadConversation(conv.id)
    await store.restoreConversationAt('a1')

    expect(store.messages.map((message) => message.id)).toEqual(['u1', 'a1'])
    expect(chatDb.get(conv.id)?.messages.map((message) => message.id)).toEqual(['u1', 'a1'])
    expect(store.conversations.some((item) => item.parentConversationId === conv.id)).toBe(true)
  })

  it('sendMessage should fail when another request is in progress', async () => {
    await seedModel()
    mockBuild.mockReturnValue({
      messages: [{ role: 'user', content: 'test' }],
      system: undefined,
    })
    // Never resolve on its own — simulate in-progress, manually resolve later
    let resolveFirst: (() => void) | null = null
    mockStreamChat.mockImplementation(
      async () => {
        await new Promise<void>((resolve) => { resolveFirst = resolve })
      },
    )

    const store = useChatStore()
    await store.createConversation('doc-1')

    // Start first send (won't finish)
    const p1 = store.sendMessage('First')
    // Wait for it to enter the streaming phase
    await new Promise((resolve) => setTimeout(resolve, 20))

    // Second should throw — guard prevents concurrent sends
    await expect(store.sendMessage('Second')).rejects.toThrow('already in progress')

    // Clean up: resolve the first send
    resolveFirst!()
    await p1
  })
})
