import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { testConnection } from './test-connection.service'
import type { ModelConfig } from '@/types/model'

function makeModel(overrides: Partial<ModelConfig> = {}): ModelConfig {
  return {
    id: 'm1',
    name: 'Test',
    provider: 'openai-compatible',
    modelId: 'gpt-4o',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'sk-test',
    enabled: true,
    isDefault: false,
    contextWindow: 128000,
    temperature: 0.9,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('services/ai/test-connection.service', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should route openai-compatible provider', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200 }))

    const result = await testConnection(makeModel({ provider: 'openai-compatible' }))

    expect(result.success).toBe(true)
    expect(result.latency).toBeGreaterThanOrEqual(0)
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toContain('/chat/completions')
    expect(init!.method).toBe('POST')
    expect((init!.headers as any)['Authorization']).toBe('Bearer sk-test')
  })

  it('should route anthropic provider', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200 }))

    const result = await testConnection(makeModel({ provider: 'anthropic', baseUrl: 'https://api.anthropic.com' }))

    expect(result.success).toBe(true)
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toContain('/v1/messages')
    expect(init!.method).toBe('POST')
    expect((init!.headers as any)['x-api-key']).toBe('sk-test')
  })

  it('should route ollama provider', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200 }))

    const result = await testConnection(makeModel({ provider: 'ollama', baseUrl: 'http://localhost:11434' }))

    expect(result.success).toBe(true)
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toContain('/api/tags')
    expect(init!.method).toBe('GET')
  })

  it('should return failure on non-OK response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))

    const result = await testConnection(makeModel())

    expect(result.success).toBe(false)
    expect(result.error).toContain('401')
  })

  it('should handle network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

    const result = await testConnection(makeModel())

    expect(result.success).toBe(false)
    expect(result.error).toContain('Network error')
  })
})
