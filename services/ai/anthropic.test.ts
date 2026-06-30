import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AnthropicProvider } from './anthropic'

function mockModelConfig(overrides: Partial<import('@/types/model').ModelConfig> = {}) {
  return {
    id: 'test-model',
    name: 'Test Model',
    provider: 'anthropic' as const,
    modelId: 'claude-sonnet-4-20250514',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKey: 'sk-ant-test',
    enabled: true,
    isDefault: false,
    contextWindow: 4096,
    temperature: 0.9,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('AnthropicProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('chat', () => {
    it('should POST to /messages endpoint and return content', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            content: [{ type: 'text', text: 'Hello from Claude' }],
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await AnthropicProvider.chat({
        model: mockModelConfig(),
        systemPrompt: 'You are helpful.',
        messages: [{ role: 'user', content: 'Hi' }],
      })

      expect(result.content).toBe('Hello from Claude')
      expect(result.usage?.promptTokens).toBe(10)
      expect(result.usage?.completionTokens).toBe(5)
      expect(result.usage?.totalTokens).toBe(15)

      const callUrl = mockFetch.mock.calls[0][0]
      expect(callUrl).toBe('https://api.anthropic.com/v1/messages')
    })

    it('should include system as top-level field, not in messages', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ content: [{ type: 'text', text: 'ok' }] }),
      })
      vi.stubGlobal('fetch', mockFetch)

      await AnthropicProvider.chat({
        model: mockModelConfig(),
        systemPrompt: 'You are a pirate.',
        messages: [{ role: 'user', content: 'Ahoy' }],
      })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      // Anthropic system is top-level, not in messages
      expect(body.system).toBe('You are a pirate.')
      // messages should not contain system role
      expect(body.messages.every((m: { role: string }) => m.role !== 'system')).toBe(true)
    })

    it('should not inject context directly as a user message (context handled upstream)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ content: [{ type: 'text', text: 'ok' }] }),
      })
      vi.stubGlobal('fetch', mockFetch)

      await AnthropicProvider.chat({
        model: mockModelConfig(),
        context: '# Page Content',
        messages: [{ role: 'user', content: 'Summarize' }],
      })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      const contextMsg = body.messages.find((m: { role: string; content: string }) => m.content === '# Page Content')
      expect(contextMsg).toBeUndefined()
    })

    it('should throw on non-ok response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: () => Promise.resolve('Unauthorized'),
      })
      vi.stubGlobal('fetch', mockFetch)

      await expect(
        AnthropicProvider.chat({
          model: mockModelConfig(),
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      ).rejects.toThrow(/Anthropic error/)
    })
  })

  describe('streamChat', () => {
    it('should parse content_block_delta events and call onToken', async () => {
      const encoder = new TextEncoder()
      const chunks = [
        'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\n',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" World"}}\n\n',
        'data: {"type":"message_stop"}\n\n',
      ]

      let chunkIndex = 0
      const mockReader = {
        read: vi.fn().mockImplementation(() => {
          if (chunkIndex >= chunks.length) return Promise.resolve({ done: true, value: undefined })
          const value = encoder.encode(chunks[chunkIndex++])
          return Promise.resolve({ done: false, value })
        }),
      }

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      }))

      const tokens: string[] = []
      let doneCalled = false

      await AnthropicProvider.streamChat(
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

    it('should parse usage from message_start + message_delta and call onUsage', async () => {
      const encoder = new TextEncoder()
      const chunks = [
        'data: {"type":"message_start","message":{"usage":{"input_tokens":42}}}\n\n',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi"}}\n\n',
        'data: {"type":"message_delta","delta":{},"usage":{"output_tokens":7}}\n\n',
        'data: {"type":"message_stop"}\n\n',
      ]

      let chunkIndex = 0
      const mockReader = {
        read: vi.fn().mockImplementation(() => {
          if (chunkIndex >= chunks.length) return Promise.resolve({ done: true, value: undefined })
          const value = encoder.encode(chunks[chunkIndex++])
          return Promise.resolve({ done: false, value })
        }),
      }

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      }))

      let usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined
      await AnthropicProvider.streamChat(
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
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

      let errorMsg = ''
      await AnthropicProvider.streamChat(
        { model: mockModelConfig(), messages: [{ role: 'user', content: 'Hi' }] },
        {
          onToken: () => {},
          onDone: () => {},
          onError: (e) => { errorMsg = e.message },
        },
      )

      expect(errorMsg).toBe('Network error')
    })

    it('should call onError on non-ok response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server error'),
      }))

      let errorMsg = ''
      await AnthropicProvider.streamChat(
        { model: mockModelConfig(), messages: [{ role: 'user', content: 'Hi' }] },
        {
          onToken: () => {},
          onDone: () => {},
          onError: (e) => { errorMsg = e.message },
        },
      )

      expect(errorMsg).toContain('Anthropic error: Internal Server Error Server error')
    })
  })

  describe('testConnection', () => {
    it('should return success with latency on 200', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
      }))

      const result = await AnthropicProvider.testConnection(mockModelConfig())

      expect(result.success).toBe(true)
      expect(result.latency).toBeGreaterThanOrEqual(0)
    })

    it('should return failure on non-ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Forbidden'),
      }))

      const result = await AnthropicProvider.testConnection(mockModelConfig())

      expect(result.success).toBe(false)
      expect(result.error).toContain('403')
    })

    it('should return failure on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')))

      const result = await AnthropicProvider.testConnection(mockModelConfig())

      expect(result.success).toBe(false)
      expect(result.error).toBe('Connection refused')
    })
  })
})
