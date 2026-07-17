import type { AIProvider } from './types'
import type { ModelConfig } from '@/types/model'
import { OpenAICompatibleProvider } from './openai-compatible'
import { AnthropicProvider } from './anthropic'
import { OllamaProvider } from './ollama'

export function createProvider(config: ModelConfig): AIProvider {
  switch (config.provider) {
    case 'openai-compatible':
      return OpenAICompatibleProvider
    case 'anthropic':
      return AnthropicProvider
    case 'ollama':
      return OllamaProvider
    default: {
      const _exhaustive: never = config.provider
      throw new Error(`Unknown provider: ${_exhaustive}`)
    }
  }
}
