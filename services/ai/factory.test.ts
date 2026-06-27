import { describe, it, expect } from 'vitest'
import { createProvider } from './factory'
import type { ModelConfig } from '@/types/model'

function makeConfig(provider: ModelConfig['provider']): ModelConfig {
  return {
    id: 'test',
    name: 'Test',
    provider,
    modelId: 'test-model',
    enabled: true,
    isDefault: false,
    contextWindow: 4096,
    temperature: 0.7,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('createProvider', () => {
  it('should return OpenAICompatibleProvider for openai-compatible', () => {
    const provider = createProvider(makeConfig('openai-compatible'))
    expect(provider).toBeDefined()
    expect(typeof provider.chat).toBe('function')
    expect(typeof provider.streamChat).toBe('function')
    expect(typeof provider.testConnection).toBe('function')
  })

  it('should return AnthropicProvider for anthropic', () => {
    const provider = createProvider(makeConfig('anthropic'))
    expect(provider).toBeDefined()
    expect(typeof provider.chat).toBe('function')
    expect(typeof provider.streamChat).toBe('function')
    expect(typeof provider.testConnection).toBe('function')
  })

  it('should return OllamaProvider for ollama', () => {
    const provider = createProvider(makeConfig('ollama'))
    expect(provider).toBeDefined()
    expect(typeof provider.chat).toBe('function')
    expect(typeof provider.streamChat).toBe('function')
    expect(typeof provider.testConnection).toBe('function')
  })

  it('should return the same instance (singleton) for same provider type', () => {
    const a = createProvider(makeConfig('anthropic'))
    const b = createProvider({ ...makeConfig('anthropic'), id: 'another-model', modelId: 'claude-opus' })
    expect(a).toBe(b)
  })

  it('should return different instances for different providers', () => {
    const anthropic = createProvider(makeConfig('anthropic'))
    const ollama = createProvider(makeConfig('ollama'))
    expect(anthropic).not.toBe(ollama)
  })

  it('should throw for unknown provider', () => {
    expect(() => createProvider({ ...makeConfig('ollama'), provider: 'unknown' as never })).toThrow(/Unknown provider/)
  })

  it('should maintain singletons across multiple calls with interleaved providers', () => {
    const oai1 = createProvider(makeConfig('openai-compatible'))
    const ant1 = createProvider(makeConfig('anthropic'))
    const oll1 = createProvider(makeConfig('ollama'))

    const oai2 = createProvider(makeConfig('openai-compatible'))
    const ant2 = createProvider(makeConfig('anthropic'))
    const oll2 = createProvider(makeConfig('ollama'))

    expect(oai1).toBe(oai2)
    expect(ant1).toBe(ant2)
    expect(oll1).toBe(oll2)
  })
})
