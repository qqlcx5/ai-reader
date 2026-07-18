import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OllamaProvider } from './ollama'

function mockModelConfig(overrides: Partial<import('@/types/model').ModelConfig> = {}) {
  return {
    id: 'test-model',
    name: 'Test Model',
    provider: 'ollama' as const,
    modelId: 'llama3.2',
    baseUrl: 'http://localhost:11434',
    enabled: true,
    isDefault: false,
    contextWindow: 4096,
    temperature: 0.9,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('OllamaProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('chat', () => {
    it('should POST to /api/chat and return content', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            message: { role: 'assistant', content: 'Hello from Ollama' },
            eval_count: 5,
            prompt_eval_count: 10,
          }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await OllamaProvider.chat({
        model: mockModelConfig(),
        messages: [{ role: 'user', content: 'Hi' }],
      })

      expect(result.content).toBe('Hello from Ollama')
      expect(result.usage?.promptTokens).toBe(10)
      expect(result.usage?.completionTokens).toBe(5)

      const callUrl = mockFetch.mock.calls[0][0]
      expect(callUrl).toBe('http://localhost:11434/api/chat')
    })

    it('should send maxTokens as num_predict without overriding context size', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: { content: 'ok' } }),
      })
      vi.stubGlobal('fetch', mockFetch)

      await OllamaProvider.chat({
        model: mockModelConfig({ contextWindow: 4096, maxTokens: 1024 }),
        messages: [{ role: 'user', content: 'Hi' }],
      })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.options).toBeUndefined()
      expect(body.num_ctx).toBeUndefined()
      expect(body.num_predict).toBe(1024)
    })

    it('should include system prompt in messages array', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: { content: 'ok' } }),
      })
      vi.stubGlobal('fetch', mockFetch)

      await OllamaProvider.chat({
        model: mockModelConfig(),
        systemPrompt: 'You are a pirate.',
        messages: [{ role: 'user', content: 'Ahoy' }],
      })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      const sysMsg = body.messages.find((m: { role: string }) => m.role === 'system')
      expect(sysMsg).toBeDefined()
      expect(sysMsg.content).toBe('You are a pirate.')
    })

    it('should not inject legacy context separately', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: { content: 'ok' } }),
      })
      vi.stubGlobal('fetch', mockFetch)

      await OllamaProvider.chat({
        model: mockModelConfig(),
        context: '# Page Content',
        messages: [{ role: 'user', content: 'Summarize' }],
      })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.messages).toEqual([{ role: 'user', content: 'Summarize' }])
    })

    it('should throw on non-ok response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Error'),
      }))

      await expect(
        OllamaProvider.chat({
          model: mockModelConfig(),
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      ).rejects.toThrow(/Ollama error/)
    })
  })

  describe('streamChat', () => {
    it('should parse NDJSON lines and call onToken', async () => {
      const encoder = new TextEncoder()
      const lines = [
        '{"model":"llama3.2","created_at":"2026-01-01T00:00:00Z","message":{"role":"assistant","content":"Hello"},"done":false}\n',
        '{"model":"llama3.2","created_at":"2026-01-01T00:00:00Z","message":{"role":"assistant","content":" World"},"done":false}\n',
        '{"model":"llama3.2","created_at":"2026-01-01T00:00:00Z","message":{"role":"assistant","content":""},"done":true}\n',
      ]

      let lineIndex = 0
      const mockReader = {
        read: vi.fn().mockImplementation(() => {
          if (lineIndex >= lines.length) return Promise.resolve({ done: true, value: undefined })
          const value = encoder.encode(lines[lineIndex++])
          return Promise.resolve({ done: false, value })
        }),
      }

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      }))

      const tokens: string[] = []
      let doneCalled = false

      await OllamaProvider.streamChat(
        { model: mockModelConfig(), messages: [{ role: 'user', content: 'Hi' }] },
        {
          onToken: (t) => tokens.push(t),
          onDone: () => { doneCalled = true },
          onError: () => {},
        },
      )

      expect(tokens).toEqual(['Hello', ' World'])
      expect(doneCalled).toBe(true)
    })

    it('should parse usage from the done chunk and call onUsage', async () => {
      const encoder = new TextEncoder()
      const lines = [
        '{"model":"llama3.2","message":{"role":"assistant","content":"Hi"},"done":false}\n',
        '{"model":"llama3.2","message":{"role":"assistant","content":""},"done":true,"prompt_eval_count":42,"eval_count":7}\n',
      ]

      let lineIndex = 0
      const mockReader = {
        read: vi.fn().mockImplementation(() => {
          if (lineIndex >= lines.length) return Promise.resolve({ done: true, value: undefined })
          const value = encoder.encode(lines[lineIndex++])
          return Promise.resolve({ done: false, value })
        }),
      }

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      }))

      let usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined
      await OllamaProvider.streamChat(
        { model: mockModelConfig(), messages: [{ role: 'user', content: 'Hi' }] },
        {
          onToken: () => {},
          onUsage: (u) => { usage = u },
          onDone: () => {},
          onError: () => {},
        },
      )

      expect(usage).toBeDefined()
      expect(usage?.promptTokens).toBe(42)
      expect(usage?.completionTokens).toBe(7)
      expect(usage?.totalTokens).toBe(49)
    })

    it('should call onError on fetch failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')))

      let errorMsg = ''
      await OllamaProvider.streamChat(
        { model: mockModelConfig(), messages: [{ role: 'user', content: 'Hi' }] },
        {
          onToken: () => {},
          onDone: () => {},
          onError: (e) => { errorMsg = e.message },
        },
      )

      expect(errorMsg).toBe('Connection refused')
    })

    it('should call onError on non-ok response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error'),
      }))

      let errorMsg = ''
      await OllamaProvider.streamChat(
        { model: mockModelConfig(), messages: [{ role: 'user', content: 'Hi' }] },
        {
          onToken: () => {},
          onDone: () => {},
          onError: (e) => { errorMsg = e.message },
        },
      )

      expect(errorMsg).toContain('Ollama error')
    })
  })

  describe('testConnection', () => {
    it('should GET /api/tags and return success', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
      }))

      const result = await OllamaProvider.testConnection(mockModelConfig())

      expect(result.success).toBe(true)
      expect(result.latency).toBeGreaterThanOrEqual(0)

      const callUrl = (vi.mocked(fetch) as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      expect(callUrl).toContain('/api/tags')
    })

    it('should return failure on non-ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
      }))

      const result = await OllamaProvider.testConnection(mockModelConfig())

      expect(result.success).toBe(false)
      expect(result.error).toContain('404')
    })
  })
})
