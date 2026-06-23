# M3 多模型 Provider 客户端 — Vibe Coding 任务清单 (v1)

> **目标**：实现 `IEngine` 抽象接口与 15 个 Provider 适配器，支持 SSE 流式解析、多 Provider 故障转移、指数退避重连、错误码分层处理，API Key 仅存本地、绝不过服务器。
> **输入**：`doc/proposal_v1.md` §2.2
> **依赖**：M8（存储层，用于读取 API Key 与 Provider 配置）

---

## 1. IEngine 抽象接口

- [x] 定义 `lib/providers/types.ts`：
  ```typescript
  interface IEngine {
    id: string
    name: string
    buildHeaders(apiKey: string): Record<string, string>
    buildBody(messages: Message[], model: string, stream: boolean): unknown
    getBaseUrl(customBaseUrl?: string): string
    parseSSEChunk(chunk: string): string | null  // 返回增量文本
  }
  interface ChatStreamOptions {
    messages: Message[]
    model: string
    apiKey: string
    customBaseUrl?: string
    signal: AbortSignal
    onDelta: (text: string) => void
    onMetrics: (m: RequestMetrics) => void
    onError: (err: ProviderError) => void
  }
  interface RequestMetrics { ttft: number; tps: number; totalTokens: number; cost: number; cached: boolean }
  interface ProviderError { code: number; message: string; provider: string }
  ```
- [x] 实现 `lib/providers/base-engine.ts`：
  - `chatStream(options: ChatStreamOptions)` 方法，处理 SSE 连接、流式解析、重试、超时
  - 使用 `eventsource-parser` 解析 SSE，避免中文字符截断乱码
  - 使用 `best-effort-json-parser` 处理不完整 JSON 增量
  - 记录 `TTFT`（首个 delta 时间）、`TPS`（总 token / 总耗时）

---

## 2. OpenAI-compatible 适配器基类

- [x] 实现 `lib/providers/openai-compatible.ts`（继承 `BaseEngine`）
  - `buildHeaders`: `Authorization: Bearer ${apiKey}` + `Content-Type: application/json`
  - `buildBody`: `{ model, messages, stream: true }`
  - `parseSSEChunk`: 提取 `data.choices[0].delta.content`
  - `getBaseUrl`: 支持 `customBaseUrl` 覆盖
- [x] 基于此实现以下 Provider 子类（仅 override `getBaseUrl` + `id` + `name`）：
  - [x] `OpenAIEngine`（`https://api.openai.com/v1`）
  - [x] `DeepSeekEngine`（`https://api.deepseek.com/v1`）
  - [x] `MiniMaxEngine`
  - [x] `MoonshotEngine`（`https://api.moonshot.cn/v1`）
  - [x] `GroqEngine`（`https://api.groq.com/openai/v1`）
  - [x] `CerebrasEngine`
  - [x] `PerplexityEngine`（`https://api.perplexity.ai`）
  - [x] `xAIEngine`（`https://api.x.ai/v1`）
  - [x] `AzureOpenAIEngine`（动态 endpoint，需额外 `api-version` Header）
  - [x] `LMStudioEngine`（默认 `http://localhost:1234/v1`）
  - [x] `OllamaEngine`（`http://localhost:11434/api/chat`，Ollama REST API 格式）

---

## 3. 非兼容 Provider 适配器

- [x] 实现 `lib/providers/anthropic-engine.ts`
  - Header：`x-api-key` + `anthropic-version: 2023-06-01`
  - Body：`{ model, max_tokens, messages, stream: true }`
  - SSE 解析：`event: content_block_delta` → `delta.text`
- [x] 实现 `lib/providers/gemini-engine.ts`
  - 使用 Google AI API（`generativelanguage.googleapis.com`）
  - Body 格式：`{ contents: [{ parts: [{ text }] }] }`
  - SSE 解析：`candidates[0].content.parts[0].text`
- [x] 实现 `lib/providers/cohere-engine.ts`
  - Header：`Authorization: Bearer ${apiKey}`
  - Body：Cohere `/v1/chat` 格式
  - SSE 解析：`event-type: text-generation` → `text`
- [x] 实现 `lib/providers/chatgpt-web-engine.ts`（Web Session 模式）
  - 从 `chrome.cookies` 读取 ChatGPT session token
  - 调用 ChatGPT Web API（零 API 额度消耗）
  - 标注此 Provider 为实验性，需用户手动启用

---

## 4. API Key 安全存储

- [x] 实现 `lib/providers/key-store.ts`
  - `saveKey(providerId, apiKey)` → `chrome.storage.local.set`
  - `getKey(providerId)` → `chrome.storage.local.get`
  - `deleteKey(providerId)` → `chrome.storage.local.remove`
  - Provider 配置（Base URL / 模型列表）→ `chrome.storage.sync`
- [x] 确认 API Key 不出现在任何日志、错误上报、网络请求 Header 之外
- [ ] 设置页 API Key 输入框使用 `type="password"`，展示模拟圆点占位符（UI 层，待 M1 实现）

---

## 5. 网络代理配置

- [x] 在 Provider 配置中支持 `customBaseUrl` 字段（每个 Provider 独立）
- [x] 实现全局代理开关：`saveGlobalProxy` / `getGlobalProxy` + `resolveBaseUrl`（`key-store.ts`）
- [x] 代理 URL 仅修改目标地址，不修改请求体和 Header

---

## 6. SSE 断线自动重连

- [x] 在 `BaseEngine.chatStream` 中实现指数退避重连：
  - 初始等待 1s，每次翻倍，最大 30s，最多重试 5 次
  - 重连时携带上次接收的最后内容 offset（实现断点续渲染）
  - 重连期间通过 `onError({ code: 'RECONNECTING' })` 通知 UI 显示轻量重连指示器
- [x] 正常关闭（用户主动中止）不触发重连（检查 `signal.aborted`）

---

## 7. 多 Provider 故障转移链

- [x] 实现 `lib/providers/failover-chain.ts`
  - 用户可配置有序的 Provider 链（如 `['openai', 'anthropic', 'deepseek']`）
  - 当主模型失败或超时（默认 30s 可配置）时，自动切换到下一个重试
  - 切换透明：用户仅在最终成功或全部失败时看到 Toast
- [x] 错误码分层处理：
  - `401` / `403` → Toast "API Key 无效，请检查设置"，打开 Options 页
  - `429` → Toast 展示 Rate Limit 冷却时间（Rate Limit Reset 时间戳解析）
  - `5xx` → 自动重试 1 次，仍失败则展示错误详情

---

## 8. Provider 注册表与工厂

- [x] 实现 `lib/providers/registry.ts`：
  - 统一注册所有 Provider 实例
  - `getEngine(providerId: string): IEngine`
  - `listEngines(): EngineInfo[]`（含 id / name / icon / isLocal / isConfigured）
- [x] 实现 `lib/providers/pricing.ts`：存储各模型的每千 token 输入 / 输出价格，供 `RequestMetrics.cost` 估算

---

## 9. 单元测试

- [ ] 用 mock SSE server 测试 `BaseEngine` 流式解析（覆盖中文多字节截断场景）
- [ ] 测试 `AnthropicEngine` / `GeminiEngine` 的 SSE 格式解析正确
- [ ] 测试故障转移链：mock 主模型返回 `500`，验证自动切换到备用模型
- [ ] 测试指数退避：mock SSE 断线，验证重连等待时间序列 1s → 2s → 4s → 8s

---

## 验收标准

1. 配置 OpenAI API Key 后，发送消息可收到流式回复，TTFT < 2s（正常网络）。
2. Gemini / Anthropic / DeepSeek / Ollama 各自正常完成一次流式对话。
3. 关闭 API Key 后发送消息，Toast 显示"API Key 无效"并高亮 Options 入口。
4. 主模型故障转移：mock 主模型 500 错误，1s 内自动切换到备用模型并继续生成。
5. 单元测试全部通过，TypeScript 无编译错误。
