export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface StreamRequest {
  prompt: string;
  signal: AbortSignal;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
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
