# M3 Provider 与 LLM 客户端 — Vibe Coding 任务清单

> **目标**：实现统一的 Provider 抽象，支持自定义 base URL 和模型名，提供 SSE 流式请求。
> **输入**：`doc/1.md` 技术选型 / 模块 2、`doc/design-03-provider-client.md`
> **建议执行顺序**：在 M7 settings stub 之后即可开始；M4 依赖此模块。

---

## 1. 依赖安装与基础类型

- [ ] 安装 `eventsource-parser`
- [ ] 创建 `modules/provider/` 目录
- [ ] 定义 `ProviderConfig`、`ProviderType`、`ChatMessage`、`ChatRequest`、`StreamEvent`、`RequestMetrics` 类型
- [ ] 在 `types.ts` 中明确 `baseUrl` 和 `model` 为可编辑字段
- [ ] 创建 `modules/provider/__tests__/mock-server.ts` 用于测试 SSE

---

## 2. BaseProvider 抽象类

- [ ] 实现 `modules/provider/base.ts`
- [ ] 定义抽象方法：`chatStream`、`defaultBaseUrl`、`buildHeaders`、`buildBody`、`parseStreamChunk`
- [ ] 实现 `get baseUrl()`：优先使用 `config.baseUrl`，否则使用官方默认地址
- [ ] 提供 `apiKey` 非空校验，缺失时抛出 `MISSING_API_KEY`

---

## 3. Provider 工厂

- [ ] 实现 `modules/provider/factory.ts`
- [ ] 根据 `type` 创建对应 Provider 实例
- [ ] 支持 `openai`、`anthropic`、`gemini`、`custom` 四种类型
- [ ] `custom` 类型强制校验 `baseUrl` 和 `model` 非空

---

## 4. OpenAI Provider

- [ ] 实现 `modules/provider/providers/openai.ts`
- [ ] 默认 baseUrl：`https://api.openai.com/v1`
- [ ] 实现 `buildBody`（`model` 使用 `config.model`）
- [ ] 实现 `parseStreamChunk` 解析 `delta.content`
- [ ] 用 mock server 测试 SSE 流式输出
- [ ] 支持 `AbortSignal` 终止请求

---

## 5. Anthropic Provider

- [ ] 实现 `modules/provider/providers/anthropic.ts`
- [ ] 默认 baseUrl：`https://api.anthropic.com/v1`
- [ ] 适配 Anthropic Messages API 的请求体与 SSE 事件格式
- [ ] 用 mock server 测试 SSE 流式输出
- [ ] 支持 `AbortSignal` 终止请求

---

## 6. Gemini Provider

- [ ] 实现 `modules/provider/providers/gemini.ts`
- [ ] 默认 baseUrl：`https://generativelanguage.googleapis.com/v1beta`
- [ ] 适配 Gemini 流式生成 API（可能需要 SSE 封装）
- [ ] 用 mock server 或真实 API key 测试
- [ ] 支持 `AbortSignal` 终止请求

---

## 7. Custom Provider

- [ ] 实现 `modules/provider/providers/custom.ts`
- [ ] 兼容 OpenAI 格式，允许任意自定义 baseUrl 和 model
- [ ] 支持额外请求头 `config.headers` 覆盖
- [ ] 支持额外参数 `config.parameters` 覆盖
- [ ] 测试连接本地代理或兼容 API

---

## 8. SSE 解析与流控

- [ ] 实现 `modules/provider/sse-parser.ts` 包装 `eventsource-parser`
- [ ] 处理多字节字符截断，中文乱码防护
- [ ] 实现统一的 `StreamEvent` 分发：`start` / `delta` / `usage` / `error` / `done`
- [ ] 实现请求级重试：超时 1 次、429 退避最多 3 次、5xx 指数退避最多 3 次
- [ ] 提供全局 abort 注册表：M1/M4 可触发 `ABORT_ALL_REQUESTS`

---

## 9. 指标与费用估算

- [ ] 实现 `modules/provider/metrics.ts`
- [ ] 计算 `startTime` / `firstTokenTime` / `endTime` / `totalLatency`
- [ ] 计算 `tokensPerSecond`（优先使用返回的 usage，否则按字符估算）
- [ ] 维护价格表，计算 `estimatedCost`
- [ ] 在 mock 测试中验证指标计算正确性

---

## 10. 安全提示与配置

- [ ] 在 Options UI 中添加 API Key 明文存储风险提示
- [ ] 实现 `ProviderConfig` 的导入/导出（不含 API Key 导出）
- [ ] 在 `settings` 中保存 `ProviderConfig[]`（按用户要求明文）
- [ ] 验证配置在 Popup / Side Panel / Options 间同步

---

## 验收标准

1. 使用 mock SSE server，4 种 Provider 均能正确输出流式文本并触发 `done`。
2. 自定义 Provider 连接本地代理或 OpenAI 兼容端点成功。
3. AbortSignal 触发后 fetch 立即终止，不再接收后续 chunk。
4. 指标计算中 TTFT、Latency、Tokens/s 与费用估算不为空或 NaN。

---

## 依赖提醒

- **阻塞项**：M7 需提供 `ProviderConfig` 读取与明文存储接口。
- **后续接入**：M4 将并发调用 `createProvider` 与 `chatStream`。
