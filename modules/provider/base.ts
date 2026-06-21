/**
 * M3 Provider & LLM Client — BaseProvider abstract class
 */
import type { ProviderConfig, ChatRequest, StreamEvent, RequestMetrics } from './types';
import { ProviderError, MISSING_API_KEY } from './types';

export abstract class BaseProvider {
  constructor(public config: ProviderConfig) {}

  abstract chatStream(
    request: ChatRequest,
    onEvent: (event: StreamEvent) => void
  ): Promise<RequestMetrics>;

  protected get baseUrl(): string {
    return this.config.baseUrl || this.defaultBaseUrl();
  }

  protected abstract defaultBaseUrl(): string;
  protected abstract buildHeaders(apiKey: string): Record<string, string>;
  protected abstract buildBody(request: ChatRequest): unknown;
  protected abstract parseStreamChunk(
    chunk: string,
    controller: { emit: (e: StreamEvent) => void }
  ): void;

  protected validateApiKey(): string {
    const key = this.config.apiKey?.trim();
    if (!key) {
      throw new ProviderError(MISSING_API_KEY, 'API Key is not configured for this provider');
    }
    return key;
  }
}
