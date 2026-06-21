/**
 * M3 Provider & LLM Client — Factory
 */
import { BaseProvider } from './base';
import type { ProviderConfig } from './types';
import { OpenAIProvider } from './providers/openai';
import { AnthropicProvider } from './providers/anthropic';
import { GeminiProvider } from './providers/gemini';
import { CustomOpenAIProvider } from './providers/custom';
import { ProviderError } from './types';

export function createProvider(config: ProviderConfig): BaseProvider {
  switch (config.type) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'gemini':
      return new GeminiProvider(config);
    case 'custom':
      return new CustomOpenAIProvider(config);
    default:
      throw new ProviderError('UNKNOWN_PROVIDER', `Unknown provider type: ${(config as ProviderConfig).type}`);
  }
}
