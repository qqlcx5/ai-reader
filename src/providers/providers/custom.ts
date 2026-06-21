/**
 * Custom / OpenAI-compatible Provider
 *
 * For self-hosted or third-party proxies that expose an OpenAI-compatible
 * chat completions endpoint (e.g. LiteLLM, one-api, Ollama, vLLM).
 * Extends OpenAIProvider with the user-configured base URL.
 */

import { OpenAIProvider } from './openai';

export class CustomOpenAIProvider extends OpenAIProvider {
  protected defaultBaseUrl(): string {
    // Custom providers MUST have a user-configured baseUrl
    return '';
  }

  protected buildUrl(): string {
    // Custom endpoints usually append /chat/completions themselves
    const url = this.config.baseUrl || '';
    // If URL already ends with /chat/completions, use as-is
    if (url.endsWith('/chat/completions')) {
      return url;
    }
    // If URL ends with /v1, append /chat/completions
    if (url.endsWith('/v1') || url.endsWith('/v1/')) {
      return `${url.replace(/\/$/, '')}/chat/completions`;
    }
    // Otherwise assume user provided the full endpoint
    return url;
  }
}
