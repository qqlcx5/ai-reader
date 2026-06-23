/**
 * M3 多模型 Provider 客户端 — 核心类型定义
 *
 * IEngine 抽象接口：所有 Provider 必须实现此接口。
 * BaseEngine 负责 SSE 流式解析、TTFT/TPS 指标、指数退避重连。
 * 每个 Provider 子类仅 override buildHeaders / buildBody / getBaseUrl 差异化方法。
 */

// ─────────────────────────────────────────────
// 基础消息类型
// ─────────────────────────────────────────────

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ─────────────────────────────────────────────
// 请求指标
// ─────────────────────────────────────────────

export interface RequestMetrics {
  /** Time To First Token (ms) */
  ttft: number;
  /** Tokens Per Second */
  tps: number;
  /** Total token count (prompt + completion) */
  totalTokens: number;
  /** Estimated USD cost based on pricing table */
  cost: number;
  /** Whether a cached response was served */
  cached: boolean;
  /** Prompt tokens count */
  promptTokens: number;
  /** Completion tokens count */
  completionTokens: number;
  /** Wall-clock latency from request start to final token (ms) */
  totalLatency: number;
}

// ─────────────────────────────────────────────
// 错误类型
// ─────────────────────────────────────────────

export interface ProviderError {
  /** HTTP status code or custom error code string */
  code: number | string;
  message: string;
  provider: string;
  /** Whether the error is retryable */
  retryable?: boolean;
  /** Raw HTTP status, if applicable */
  httpStatus?: number;
}

export class EngineError extends Error implements ProviderError {
  code: number | string;
  provider: string;
  retryable: boolean;
  httpStatus?: number;

  constructor(opts: ProviderError) {
    super(opts.message);
    this.name = 'EngineError';
    this.code = opts.code;
    this.provider = opts.provider;
    this.retryable = opts.retryable ?? false;
    this.httpStatus = opts.httpStatus;
  }
}

// ─────────────────────────────────────────────
// 流式请求选项
// ─────────────────────────────────────────────

export interface ChatStreamOptions {
  messages: Message[];
  model: string;
  apiKey: string;
  /** Override the provider's default base URL (proxy support) */
  customBaseUrl?: string;
  /** System prompt injected before conversation */
  systemPrompt?: string;
  /** Extra provider-specific parameters (temperature, top_p, etc.) */
  parameters?: Record<string, unknown>;
  signal: AbortSignal;
  /** Called for each incremental text delta */
  onDelta: (text: string) => void;
  /** Called once when request metrics are finalized */
  onMetrics: (m: RequestMetrics) => void;
  /** Called when a non-fatal / fatal error occurs */
  onError: (err: ProviderError) => void;
}

// ─────────────────────────────────────────────
// IEngine — Provider 适配器接口
// ─────────────────────────────────────────────

export interface IEngine {
  /** Unique provider identifier (e.g. "openai", "anthropic") */
  readonly id: string;
  /** Display name shown in UI */
  readonly name: string;
  /** Whether this provider requires an API key */
  readonly requiresApiKey: boolean;
  /** Whether the provider runs locally (no internet required) */
  readonly isLocal: boolean;
  /** Whether this provider is experimental */
  readonly experimental?: boolean;

  /**
   * Build HTTP headers for a request.
   * API Key MUST only appear here — never in logs or error objects.
   */
  buildHeaders(apiKey: string, extra?: Record<string, string>): Record<string, string>;

  /**
   * Build the JSON body for a chat/completions request.
   */
  buildBody(
    messages: Message[],
    model: string,
    stream: boolean,
    options?: ChatStreamOptions,
  ): unknown;

  /**
   * Resolve the base URL, respecting custom proxy overrides.
   */
  getBaseUrl(customBaseUrl?: string): string;

  /**
   * Parse a single SSE data payload and return the incremental text delta,
   * or null if the chunk carries no visible text (metadata, heartbeat, DONE).
   */
  parseSSEChunk(chunk: string): string | null;

  /**
   * Execute a full streaming chat request. Returns resolved metrics when stream ends.
   * Implementations MUST NOT catch AbortError — re-throw it so callers can detect cancellation.
   */
  chatStream(options: ChatStreamOptions): Promise<RequestMetrics>;
}

// ─────────────────────────────────────────────
// Engine 注册信息（用于 registry / UI 枚举）
// ─────────────────────────────────────────────

export interface EngineInfo {
  id: string;
  name: string;
  /** Icon URL or inline SVG data URI */
  icon?: string;
  isLocal: boolean;
  requiresApiKey: boolean;
  experimental?: boolean;
  /** Whether the user has configured an API key */
  isConfigured: boolean;
  /** Default model name suggestion */
  defaultModel?: string;
  /** Available model names */
  models?: string[];
}

// ─────────────────────────────────────────────
// Provider 配置（持久化在 chrome.storage.sync）
// ─────────────────────────────────────────────

export interface ProviderConfig {
  id: string;
  engineId: string;
  name: string;
  model: string;
  customBaseUrl?: string;
  enabled: boolean;
  parameters?: Record<string, unknown>;
  /** Ordered list of fallback provider IDs */
  failoverChain?: string[];
  /** Request timeout in milliseconds (default 30000) */
  timeoutMs?: number;
}

// ─────────────────────────────────────────────
// SSE 重连状态（仅在 BaseEngine 内部使用）
// ─────────────────────────────────────────────

export interface ReconnectState {
  attempt: number;
  lastEventId?: string;
  accumulatedText: string;
}

// ─────────────────────────────────────────────
// Error code constants
// ─────────────────────────────────────────────

export const ERR_MISSING_API_KEY = 'MISSING_API_KEY';
export const ERR_NETWORK = 'NETWORK_ERROR';
export const ERR_RATE_LIMIT = 'RATE_LIMIT';
export const ERR_AUTH = 'AUTH_ERROR';
export const ERR_SERVER = 'SERVER_ERROR';
export const ERR_PARSE = 'PARSE_ERROR';
export const ERR_ABORTED = 'ABORTED';
export const ERR_TIMEOUT = 'TIMEOUT';
export const ERR_UNKNOWN = 'UNKNOWN';
