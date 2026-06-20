export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens?: number;
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

// === Advanced workflow types ===

export type WorkMode = 'parallel' | 'roundtable' | 'chain';

export interface RoleConfig {
  id: string;
  name: string;       // e.g., "红队挑刺专家"
  prompt: string;     // The role system prompt
  color: string;      // Left border color, e.g., '#ef4444'
  providerId: string; // Which provider to use
}

export interface ChainStepConfig {
  id: string;
  providerId: string;
  modelId: string;
  prompt: string;     // Task instruction for this step
}
