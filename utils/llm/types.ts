export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface StreamError {
  type: 'rate_limit' | 'auth' | 'network' | 'unknown';
  message: string;
  retryAfter?: number;
  status?: number;
}

export interface StreamRequest {
  prompt: string;
  signal: AbortSignal;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (err: StreamError) => void;
}

export interface LLMProvider {
  id: string;
  name: string;
  stream(config: ProviderConfig, req: StreamRequest): Promise<void>;
}

export interface ProviderSettings {
  providers: Record<string, ProviderConfig>;
  enabledProviders: string[];
}
