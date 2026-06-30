import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenAICompatibleProvider } from './openai-compatible'

function mockModelConfig(overrides: Partial<import('@/types/model').ModelConfig> = {}) {
  return {
    id: 'test-model',
    name: 'Test Model',
    provider: 'openai-compatible' as const,
    modelId: 'gpt-4o',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'sk-test',
    enabled: true,
    isDefault: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('OpenAICompatibleProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('streamChat', () => {
    it('should request stream_options.include_usage and forward final-chunk usage via onUsage', async () => {
      const encoder = new TextEncoder()
      const chunks = [
        'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
        'data: {"choices":[],"usage":{"prompt_tokens":42,"completion_tokens":7,"total_tokens":49}}\n\n',
        'data: [DONE]\n\n',
      ]

      let chunkIndex = 0
      const mockReader = {
        read: vi.fn().mockImplementation(() => {
          if (chunkIndex >= chunks.length) return Promise.resolve({ done: true, value: undefined })
          const value = encoder.encode(chunks[chunkIndex++])
          return Promise.resolve({ done: false, value })
        }),
      }

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      })
      vi.stubGlobal('fetch', mockFetch)

      let usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined
      await OpenAICompatibleProvider.streamChat(
        { model: mockModelConfig(), messages: [{ role: 'user', content: 'Hi' }] },
        {
          onToken: () => {},
          onUsage: (u) => { usage = u },
          onDone: () => {},
          onError: () => {},
        },
      )

      // stream_options.include_usage was sent in the request body
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.stream_options).toEqual({ include_usage: true })

      // usage from the final (empty-choices) chunk was forwarded
      expect(usage).toBeDefined()
      expect(usage?.promptTokens).toBe(42)
      expect(usage?.completionTokens).toBe(7)
      expect(usage?.totalTokens).toBe(49)
    })
  })
})
