# M3 Provider 与 LLM 客户端（Provider & LLM Client）详细设计

> **版本**：v1.1
> **对应 PRD**：v3.2 第二章「模块 2：Cherry 风格多模型工作区」、第三章技术选型
> **设计原则**：Provider 层是对 LLM 接口的抽象，与 UI 和提取逻辑解耦；支持自定义 base URL 和模型名；SSE 流式解析统一处理；内置故障转移与断线重连。

---

## Coverage Status

> 基于 `/reference/nextai-translator` 源码分析 — 该项目是 proposal M3 最接近的参考实现。

| 需求项 | 覆盖状态 | 参考实现 | 备注 |
|--------|---------|---------|------|
| Provider 抽象层（统一接口屏蔽差异） | **已覆盖** | nextai-translator | `engines/interfaces.ts` 定义 `IEngine`，`AbstractEngine` → `AbstractOpenAI` 两层抽象，14 Provider 工厂模式 |
| 自定义 baseUrl / model | **已覆盖** | nextai-translator | `apiURL` / `apiURLPath` / `apiModel` 三层可配 |
| SSE 流式处理 + eventsource-parser | **已覆盖** | nextai-translator | `fetchSSE()` + `eventsource-parser`，替代不稳定原生 EventSource |
| best-effort-json-parser 增量解析 | **已覆盖** | nextai-translator | 流式场景下解析不完整 JSON 响应 |
| 流式文本去重 | **已覆盖** | nextai-translator | `QuoteProcessor`：UUID 标记 + 字符级状态机消重 |
| 多 Provider 配置持久化 | **已覆盖** | nextai-translator | `utils.ts` 中 `ISettings` 含各 Provider 独立 apiKey/apiURL/apiModel |
| 明文 API Key 存储 | **已覆盖** | nextai-translator | `apiKeys` 字段存于 `chrome.storage` |
| 并发请求 / 独立重试中止 | **未覆盖** | — | nextai 为单模型单次调用，无并发管理 |
| 性能指标采集（TTFT / Tokens/s） | **未覆盖** | — | 无耗时追踪 |
| SSE 断线自动重连 | **未覆盖** | — | 无重连机制 |
| 多 Provider 故障转移 | **未覆盖** | — | 无主备模型链 |

**综合评估**：Provider 层是最大复用资产。14 引擎架构（抽象基类 + Provider 工厂）可直接迁移。并发调度、指标采集、断线重连、故障转移为增量需求。

**优先级建议**：P0 — Provider 层是整个系统的基石，且已有大量可直接复用的现成代码。

---

## 1. 设计目标

- 提供统一的 Provider 抽象，屏蔽 14+ 个 Provider 的接口差异（OpenAI-compatible / Anthropic / Ollama 等协议）。
- 支持用户自定义 base URL 与模型名。
- 统一 SSE 流式输出解析：`eventsource-parser` 替代原生 EventSource，解决中文多字节截断问题；`best-effort-json-parser` 处理流式增量 JSON。
- 支持并发请求、独立重试/中止、性能指标采集（TTFT / Tokens/s / 消耗量预估）。
- SSE 断线自动重连：指数退避策略，携带断点 event_id 续传。
- 多 Provider 故障转移：主备模型链自动切换。
- API Key 明文存储在 `chrome.storage.local`（用户已确认），设计中附加风险提示。

---

## 2. 职责边界

| 职责 | 属于本模块 | 不属于本模块 |
|---|---|---|
| Provider 配置与抽象 | ✅ |  |
| SSE 请求与解析 | ✅ |  |
| best-effort-json-parser 增量解析 | ✅ |  |
| 流控、重试、Abort | ✅ |  |
| SSE 断线自动重连 | ✅ |  |
| 多 Provider 故障转移 | ✅ |  |
| Token 与费用估算 | ✅ |  |
| API Key 持久化存储 |  | M7 |
| 消息 UI 渲染 |  | M4 |
| 上下文提取 |  | M2 |

---

## 3. 核心数据结构

### 3.1 Provider 配置

```ts
// modules/provider/types.ts
export type ProviderType =
  | 'openai' | 'chatgpt' | 'azure-openai' | 'gemini' | 'claude'
  | 'deepseek' | 'minimax' | 'moonshot' | 'ollama' | 'groq'
  | 'kimi' | 'chatglm' | 'cohere' | 'cerebras' | 'perplexity' | 'xai'
  | 'custom';

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  /** 用户自定义 API Base URL；为空时使用官方默认地址 */
  baseUrl?: string;
  /** 用户自定义模型名 */
  model: string;
  /** API Key（运行时从 M7 读取） */
  apiKey?: string;
  /** 是否启用 */
  enabled: boolean;
  /** 额外请求头 */
  headers?: Record<string, string>;
  /** 温度等参数覆盖 */
  parameters?: Record<string, unknown>;
}
```

### 3.2 统一请求消息格式

```ts
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  providerId: string;
  /** 本次请求的 system prompt */
  systemPrompt?: string;
  /** 历史消息 + 当前用户消息 */
  messages: ChatMessage[];
  /** 温度、top_p 等 */
  parameters?: Record<string, unknown>;
  /** 关联的 AbortController signal */
  signal?: AbortSignal;
}
```

### 3.3 统一流式响应事件

```ts
export type StreamEvent =
  | { type: 'start'; timestamp: number }
  | { type: 'delta'; content: string }
  | { type: 'usage'; promptTokens: number; completionTokens: number }
  | { type: 'error'; code: string; message: string; statusCode?: number }
  | { type: 'done'; finishReason: string };
```

### 3.4 性能指标

```ts
export interface RequestMetrics {
  providerId: string;
  model: string;
  startTime: number;
  firstTokenTime: number | null; // TTFT
  endTime: number | null;
  totalLatency: number | null;
  tokensPerSecond: number | null;
  estimatedCost: number | null; // 基于价格表估算
}
```

### 3.5 故障转移配置

```ts
export interface FailoverConfig {
  enabled: boolean;
  /** 主模型超时阈值（ms），默认 30000 */
  timeoutMs: number;
  /** 备用 Provider ID 列表，按优先级排序 */
  fallbackProviderIds: string[];
}
```

---

## 4. Provider 抽象

### 4.1 接口定义

```ts
// modules/provider/base.ts
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
}
```

### 4.2 Provider 协议分组

PRD 要求不少于 14 个 Provider，按协议兼容性分为三组：

| 协议组 | Provider | 基类 |
|--------|----------|------|
| OpenAI-compatible | OpenAI / ChatGPT / Azure OpenAI / DeepSeek / MiniMax / Moonshot / Groq / Kimi / ChatGLM / Cohere / Cerebras / Perplexity / xAI / custom | `OpenAICompatibleProvider` |
| Anthropic | Claude | `AnthropicProvider` |
| Google AI | Gemini | `GeminiProvider` |
| 本地 | Ollama | `OllamaProvider`（继承 OpenAI-compatible） |

### 4.3 Provider 工厂

```ts
// modules/provider/factory.ts
export function createProvider(config: ProviderConfig): BaseProvider {
  switch (config.type) {
    // OpenAI-compatible 组
    case 'openai':
    case 'chatgpt':
    case 'azure-openai':
    case 'deepseek':
    case 'minimax':
    case 'moonshot':
    case 'groq':
    case 'kimi':
    case 'chatglm':
    case 'cohere':
    case 'cerebras':
    case 'perplexity':
    case 'xai':
    case 'custom':
      return new OpenAICompatibleProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'gemini':
      return new GeminiProvider(config);
    case 'ollama':
      return new OllamaProvider(config);
    default:
      throw new Error(`Unknown provider type: ${config.type}`);
  }
}
```

---

## 5. SSE 流式处理

### 5.1 解析器选型

- **eventsource-parser**：统一解析 SSE chunk，替代原生 `EventSource`，彻底解决多字节字符（中文）在网络 Chunks 截断时产生的乱码与格式断裂问题。nextai-translator 生产环境验证。
- **best-effort-json-parser**：流式场景下解析不完整 JSON 响应（如增量 tool_calls、usage 字段）。nextai-translator 生产环境验证。

### 5.2 流程

```ts
// modules/provider/openai-compatible.ts
async chatStream(request, onEvent) {
  onEvent({ type: 'start', timestamp: Date.now() });

  const response = await fetch(`${this.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: this.buildHeaders(this.config.apiKey!),
    body: JSON.stringify(this.buildBody(request)),
    signal: request.signal,
  });

  // 状态码分层处理
  if (!response.ok) {
    this.handleStatusCode(response.status, onEvent);
    return;
  }

  const parser = createParser((event) => {
    if (event.type === 'event') {
      this.parseStreamChunk(event.data, { emit: onEvent });
    }
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.feed(decoder.decode(value, { stream: true }));
  }

  onEvent({ type: 'done', finishReason: 'stop' });
}
```

### 5.3 Abort 机制

- 每个 `chatStream` 调用接收外部 `AbortSignal`。
- `Escape` 全局快捷键触发时，M1 广播 `ABORT_ALL_REQUESTS`。
- Provider 内部维护正在运行的 `AbortController` 列表，收到广播后全部 `abort()`。

---

## 6. 自定义 base URL 与模型名

- `ProviderConfig.baseUrl` 和 `model` 必填可编辑。
- 默认 Provider 提供官方 base URL：
  - OpenAI-compatible：`https://api.openai.com/v1`
  - Anthropic：`https://api.anthropic.com/v1`
  - Gemini：`https://generativelanguage.googleapis.com/v1beta`
  - Ollama：`http://localhost:11434/v1`
- `custom` 类型强制要求填写 baseUrl 和 model。
- 借鉴 obsidian-clipper 的 `providers.json` 预设方案（含 `apiKeyUrl`、`modelsList`、`popularModels` 等元数据），用户无需手动查找文档即可完成配置。

---

## 7. 分层错误处理

借鉴 nextai-translator 的 `onStatusCode` 回调，按 HTTP 状态码分层处理：

| 状态码 | 含义 | 处理策略 |
|--------|------|----------|
| 401 / 403 | 认证失败 | 返回 `MISSING_API_KEY` 错误，引导用户检查 API Key |
| 429 | Rate Limit | 读取 Retry-After 头，展示冷却时间（借鉴 obsidian-clipper `RATE_LIMIT_RESET_TIME = 60000ms`），延迟后自动重试，最多 3 次 |
| 5xx | 服务端错误 | 指数退避重试 1 次，仍失败则展示错误信息 |
| 其他 4xx | 请求错误 | 返回错误详情，不自动重试 |

---

## 8. SSE 断线自动重连

借鉴 Cherry Studio 的 WebSocket 自动重连机制：

- SSE 连接意外断开时，采用指数退避策略（初始 1s，最大 30s，上限 5 次）自动重连。
- 重连时携带上次接收的最后 `event_id`，服务端可从断点续传。
- 用户无感知切换，Side Panel 仅显示轻量重连指示器。

```ts
// modules/provider/reconnect.ts
export async function withReconnect(
  streamFn: (lastEventId?: string) => Promise<void>,
  onReconnecting: (attempt: number) => void,
  maxAttempts = 5
): Promise<void> {
  let attempt = 0;
  let lastEventId: string | undefined;

  while (attempt < maxAttempts) {
    try {
      await streamFn(lastEventId);
      return; // 正常结束
    } catch (e) {
      attempt++;
      if (attempt >= maxAttempts) throw e;
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
      onReconnecting(attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
```

---

## 9. 多 Provider 故障转移

借鉴 Read Frog 的主备模型链机制：

- 用户可在设置中配置主备模型链（如主模型 OpenAI GPT-4o → 备用 Anthropic Claude → 兜底 DeepSeek）。
- 主模型请求失败或超时（可配置超时阈值，默认 30s）后，自动按优先级切换到备用模型重试。
- 切换全程对用户透明，仅在最终成功或全部失败时提示所用模型。

```ts
// modules/provider/failover.ts
export async function withFailover(
  configs: ProviderConfig[],
  requestFactory: (config: ProviderConfig) => ChatRequest,
  onEvent: (event: StreamEvent) => void
): Promise<{ config: ProviderConfig; metrics: RequestMetrics }> {
  for (const config of configs) {
    try {
      const provider = createProvider(config);
      const metrics = await provider.chatStream(requestFactory(config), onEvent);
      return { config, metrics };
    } catch (e) {
      // 继续尝试下一个
      continue;
    }
  }
  throw new Error('All providers failed');
}
```

---

## 10. 并发与指标

### 10.1 并发模型

- M4 根据用户勾选的 1~4 个 Provider，分别调用 `createProvider(config).chatStream()`。
- 每个 Provider 的请求独立运行，互不阻塞。
- Provider Client 本身不提供并发调度器，只提供单次调用能力；调度由 M4 负责。

### 10.2 费用估算

- 维护各 Provider/模型的价格表（按 1K tokens）。
- 若 Provider 响应包含 `usage`，使用实际值；否则按字符数粗略估算。
- 估算结果随 `usage` 事件更新。

---

## 11. API Key 安全（用户已确认明文存储）

- API Key 以**明文**保存在 `chrome.storage.local`（按用户要求）。
- 设计中需附加以下风险说明与缓解：
  - **风险**：任何拥有本机访问权限的程序或脚本都可读取扩展存储。
  - **缓解**：在 Options UI 中明确提示用户「密钥以明文存储在本地浏览器，请勿在公共/共享设备使用」。
  - **未来可升级**：M7 提供加密封装接口，二期可切换为加密存储而无需改动 Provider 调用方。

---

## 12. 组件与服务拆分

```
modules/provider/
├── index.ts              # 对外暴露 createProvider、chatStream、withFailover
├── types.ts              # 数据类型
├── base.ts               # BaseProvider 抽象类
├── factory.ts            # Provider 工厂
├── metrics.ts            # 指标与费用估算
├── sse-parser.ts         # eventsource-parser + best-effort-json-parser 包装
├── reconnect.ts          # SSE 断线自动重连
├── failover.ts           # 多 Provider 故障转移
├── providers/
│   ├── openai-compatible.ts  # OpenAI / DeepSeek / MiniMax / Moonshot / Groq / Kimi / ChatGLM / Cohere / Cerebras / Perplexity / xAI / custom
│   ├── anthropic.ts
│   ├── gemini.ts
│   └── ollama.ts
└── __tests__/
    ├── openai.mock.ts
    └── anthropic.mock.ts
```

---

## 13. 错误处理

| 错误场景 | 处理策略 |
|---|---|
| API Key 缺失 | 返回 `MISSING_API_KEY`，UI 提示用户配置 |
| 401 / 403 | 引导用户检查 API Key |
| 429 Rate Limit | 展示冷却时间，延迟后重试最多 3 次 |
| 5xx | 指数退避重试最多 3 次 |
| 超时（默认 60s） | 重试 1 次，仍失败则触发故障转移 |
| SSE 解析异常 | 记录日志，继续解析后续 chunk |
| SSE 断线 | 指数退避重连（1s → 30s，上限 5 次） |
| 全部 Provider 故障转移失败 | 返回最终错误，提示用户检查配置 |
| 用户 Abort | 立即终止 fetch，返回 `aborted` 状态 |

---

## 14. 测试策略

- **单元测试**：
  - 各 Provider 的 `buildBody` / `parseStreamChunk`。
  - SSE 解析器对中文截断 chunk 的拼接。
  - best-effort-json-parser 对不完整 JSON 的处理。
  - 费用估算函数。
  - 故障转移优先级切换。
- **集成测试**：
  - 使用真实 API key（沙盒环境）验证端到端流式输出。
  - 模拟 AbortSignal 验证请求终止。
  - 模拟网络断开验证断线重连。
- **Mock Server**：在测试中用 MSW / 本地 HTTP server 返回 SSE 流。

---

## 15. 依赖契约

| 依赖模块 | 契约 |
|---|---|
| M7 Storage & Data | 提供 `ProviderConfig[]` 与 API Key 读取；按用户要求明文存储 |
| M4 Chat Workspace | 传入 `ChatRequest`，消费 `StreamEvent` 与 `RequestMetrics` |
| M5 Advanced Workflows | 复用 Provider 抽象，注入不同 system prompt |
