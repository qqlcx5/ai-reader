/**
 * M3 Provider & LLM Client — Custom Provider (OpenAI-compatible)
 */
import { OpenAIProvider } from './openai';
import type { ProviderConfig } from '../types';
import { ProviderError } from '../types';

export class CustomOpenAIProvider extends OpenAIProvider {
  constructor(config: ProviderConfig) {
    super(config);
    if (!config.baseUrl) {
      throw new ProviderError('MISSING_BASE_URL', 'Custom provider requires a base URL');
    }
    if (!config.model) {
      throw new ProviderError('MISSING_MODEL', 'Custom provider requires a model name');
    }
  }

  protected defaultBaseUrl(): string {
    // Custom provider must have baseUrl set; this should never be called
    return this.config.baseUrl!;
  }

  protected buildHeaders(apiKey: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers,
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    return headers;
  }
}
