# M3 Provider 与 LLM 客户端（Provider & LLM Client）详细设计

> **版本**：v1.0
> **对应 PRD**：第二章「模块 2：Cherry 风格多模型工作区」、第三章技术选型
> **设计原则**：Provider 层是对 LLM 接口的抽象，与 UI 和提取逻辑解耦；支持自定义 base URL 和模型名；SSE 流式解析统一处理。

---

## 1. 设计目标

- 提供统一的 Provider 抽象，屏蔽 OpenAI、Anthropic、Gemini 等接口差异。
- 支持用户自定义 base URL 与模型名（用户已确认需求）。
- 统一 SSE 流式输出解析，解决中文多字节截断问题。
- 支持并发请求、独立重试/中止、性能指标采集。
- API Key 明文存储在 `chrome.storage.local`（用户已确认），设计中需附加风险提示。

---

## 2. 职责边界

| 职责 | 属于本模块 | 不属于本模块 |
|---|---|---|
| Provider 配置与抽象 | ✅ |  |
| SSE 请求与解析 | ✅ |  |
| 流控、重试、Abort | ✅ |  |
| Token 与费用估算 | ✅ |  |
| API Key 持久化存储 |  | M7 |
| 消息 UI 渲染 |  | M4 |
| 上下文提取 |  | M2 |

---

## 3. 核心数据结构

### 3.1 Provider 配置

```ts
// modules/provider/types.ts
export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'custom';

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
  | { type: 'error'; code: string; message: string }
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

### 4.2 Provider 工厂

```ts
// modules/provider/factory.ts
export function createProvider(config: ProviderConfig): BaseProvider {
  switch (config.type) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'gemini':
      return new GeminiProvider(config);
    case 'custom':
      return new CustomOpenAIProvider(config); // 兼容 OpenAI 格式
    default:
      throw new Error(`Unknown provider type: ${config.type}`);
  }
}
```

---

## 5. SSE 流式处理

### 5.1 解析器选型

- 使用 `eventsource-parser` 统一解析 SSE chunk，避免原生 `EventSource` 在中文截断时的乱码问题。

### 5.2 流程

```ts
// modules/provider/openai.ts
async chatStream(request, onEvent) {
  onEvent({ type: 'start', timestamp: Date.now() });

  const response = await fetch(`${this.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: this.buildHeaders(this.config.apiKey!),
    body: JSON.stringify(this.buildBody(request)),
    signal: request.signal,
  });

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
  - OpenAI：`https://api.openai.com/v1`
  - Anthropic：`https://api.anthropic.com/v1`
  - Gemini：`https://generativelanguage.googleapis.com/v1beta`
- `custom` 类型强制要求填写 baseUrl 和 model。

---

## 7. 并发与指标

### 7.1 并发模型

- M4 根据用户勾选的 1~4 个 Provider，分别调用 `createProvider(config).chatStream()`。
- 每个 Provider 的请求独立运行，互不阻塞。
- Provider Client 本身不提供并发调度器，只提供单次调用能力；调度由 M4 负责。

### 7.2 费用估算

- 维护各 Provider/模型的价格表（按 1K tokens）。
- 若 Provider 响应包含 `usage`，使用实际值；否则按字符数粗略估算。
- 估算结果随 `usage` 事件更新。

---

## 8. API Key 安全（用户已确认明文存储）

- API Key 以**明文**保存在 `chrome.storage.local`（按用户要求）。
- 设计中需附加以下风险说明与缓解：
  - **风险**：任何拥有本机访问权限的程序或脚本都可读取扩展存储。
  - **缓解**：在 Options UI 中明确提示用户「密钥以明文存储在本地浏览器，请勿在公共/共享设备使用」。
  - **未来可升级**：M7 提供加密封装接口，二期可切换为加密存储而无需改动 Provider 调用方。

---

## 9. 组件与服务拆分

```
modules/provider/
├── index.ts              # 对外暴露 createProvider、chatStream 工具函数
├── types.ts              # 数据类型
├── base.ts               # BaseProvider 抽象类
├── factory.ts            # Provider 工厂
├── metrics.ts            # 指标与费用估算
├── sse-parser.ts         # eventsource-parser 包装
├── providers/
│   ├── openai.ts
│   ├── anthropic.ts
│   ├── gemini.ts
│   └── custom.ts         # 兼容 OpenAI 格式的自定义 Provider
└── __tests__/
    ├── openai.mock.ts
    └── anthropic.mock.ts
```

---

## 10. 错误处理

| 错误场景 | 处理策略 |
|---|---|
| API Key 缺失 | 返回 `MISSING_API_KEY`，UI 提示用户配置 |
| 网络超时 | 默认 60s 超时，可重试 1 次 |
| 429 Rate Limit | 读取 Retry-After，延迟后重试；最多 3 次 |
| 5xx | 指数退避重试，最多 3 次 |
| SSE 解析异常 | 记录日志，继续解析后续 chunk |
| 用户 Abort | 立即终止 fetch，返回 `aborted` 状态 |

---

## 11. 测试策略

- **单元测试**：
  - 各 Provider 的 `buildBody` / `parseStreamChunk`。
  - SSE 解析器对中文截断 chunk 的拼接。
  - 费用估算函数。
- **集成测试**：
  - 使用真实 API key（沙盒环境）验证端到端流式输出。
  - 模拟 AbortSignal 验证请求终止。
- **Mock Server**：在测试中用 MSW / 本地 HTTP server 返回 SSE 流。

---

## 12. 依赖契约

| 依赖模块 | 契约 |
|---|---|
| M7 Storage & Data | 提供 `ProviderConfig[]` 与 API Key 读取；按用户要求明文存储 |
| M4 Chat Workspace | 传入 `ChatRequest`，消费 `StreamEvent` 与 `RequestMetrics` |
| M5 Advanced Workflows | 复用 Provider 抽象，注入不同 system prompt |
