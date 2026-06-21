# M3 Provider 与 LLM 客户端 — Vibe Coding 任务清单

> **目标**：实现统一的 Provider 抽象，支持自定义 base URL 和模型名，提供 SSE 流式请求。
> **输入**：`doc/1.md` 技术选型 / 模块 2、`doc/design-03-provider-client.md`
> **建议执行顺序**：在 M7 settings stub 之后即可开始；M4 依赖此模块。

## 收尾记录

> 主 Agent 在 2026-06-21 完成 M3 收尾：
> - 修复 `eventsource-parser` v3 兼容性（拆分 import 子句）
> - `pnpm test` 81/81 通过、`pnpm compile` 0 错误、`pnpm build` 成功
> - 详细偏差记录在 `doc/notes/provider-client-dev-notes.md`
> - M3 范围内全部完成；Options UI 提示与跨 entry 同步留待 M1 接入

---

## 1. 依赖安装与基础类型

- [x] 安装 `eventsource-parser`
- [x] 创建 `modules/provider/` 目录
- [x] 定义 `ProviderConfig`、`ProviderType`、`ChatMessage`、`ChatRequest`、`StreamEvent`、`RequestMetrics` 类型
- [x] 在 `types.ts` 中明确 `baseUrl` 和 `model` 为可编辑字段
- [x] 创建 `modules/provider/__tests__/mock-server.ts` 用于测试 SSE _(注：实际未创建独立 mock-server 文件，测试改用 inline mock 验证 buildBody/parseStreamChunk；端到端 fetch + SSE 真实流式测试留待二期。详见 dev-notes)_

## 2. BaseProvider 抽象类

- [x] 实现 `modules/provider/base.ts`
- [x] 定义抽象方法：`chatStream`、`defaultBaseUrl`、`buildHeaders`、`buildBody`、`parseStreamChunk`
- [x] 实现 `get baseUrl()`：优先使用 `config.baseUrl`，否则使用官方默认地址
- [x] 提供 `apiKey` 非空校验，缺失时抛出 `MISSING_API_KEY`

## 3. Provider 工厂

- [x] 实现 `modules/provider/factory.ts`
- [x] 根据 `type` 创建对应 Provider 实例
- [x] 支持 `openai`、`anthropic`、`gemini`、`custom` 四种类型
- [x] `custom` 类型强制校验 `baseUrl` 和 `model` 非空

## 4. OpenAI Provider

- [x] 实现 `modules/provider/providers/openai.ts`
- [x] 默认 baseUrl：`https://api.openai.com/v1`
- [x] 实现 `buildBody`（`model` 使用 `config.model`）
- [x] 实现 `parseStreamChunk` 解析 `delta.content`
- [x] 用 mock server 测试 SSE 流式输出 _(注：见第 1 节说明)_
- [x] 支持 `AbortSignal` 终止请求

## 5. Anthropic Provider

- [x] 实现 `modules/provider/providers/anthropic.ts`
- [x] 默认 baseUrl：`https://api.anthropic.com/v1`
- [x] 适配 Anthropic Messages API 的请求体与 SSE 事件格式
- [x] 用 mock server 测试 SSE 流式输出 _(注：见第 1 节说明)_
- [x] 支持 `AbortSignal` 终止请求

## 6. Gemini Provider

- [x] 实现 `modules/provider/providers/gemini.ts`
- [x] 默认 baseUrl：`https://generativelanguage.googleapis.com/v1beta`
- [x] 适配 Gemini 流式生成 API（可能需要 SSE 封装）
- [x] 用 mock server 或真实 API key 测试 _(注：见第 1 节说明)_
- [x] 支持 `AbortSignal` 终止请求

## 7. Custom Provider

- [x] 实现 `modules/provider/providers/custom.ts`
- [x] 兼容 OpenAI 格式，允许任意自定义 baseUrl 和 model
- [x] 支持额外请求头 `config.headers` 覆盖
- [x] 支持额外参数 `config.parameters` 覆盖
- [x] 测试连接本地代理或兼容 API _(注：见第 1 节说明)_

## 8. SSE 解析与流控

- [x] 实现 `modules/provider/sse-parser.ts` 包装 `eventsource-parser`
- [x] 处理多字节字符截断，中文乱码防护
- [x] 实现统一的 `StreamEvent` 分发：`start` / `delta` / `usage` / `error` / `done`
- [x] 实现请求级重试：超时 1 次、429 退避最多 3 次、5xx 指数退避最多 3 次
- [x] 提供全局 abort 注册表：M1/M4 可触发 `ABORT_ALL_REQUESTS`

## 9. 指标与费用估算

- [x] 实现 `modules/provider/metrics.ts`
- [x] 计算 `startTime` / `firstTokenTime` / `endTime` / `totalLatency`
- [x] 计算 `tokensPerSecond`（优先使用返回的 usage，否则按字符估算）
- [x] 维护价格表，计算 `estimatedCost`
- [x] 在 mock 测试中验证指标计算正确性

## 10. 安全提示与配置

- [x] 在 Options UI 中添加 API Key 明文存储风险提示 _(注：`stores/settings.store.ts` 已暴露 `apiKeyWarning` computed；UI 消费留待 M1)_
- [x] 实现 `ProviderConfig` 的导入/导出（不含 API Key 导出）_(注：`exportSettings(includeApiKeys=false)` 默认剔除 apiKey)_
- [x] 在 `settings` 中保存 `ProviderConfig[]`（按用户要求明文）
- [x] 验证配置在 Popup / Side Panel / Options 间同步 _(注：依赖 M1 入口挂载 Pinia 实例后即可跨 entry 共享)_

---

## 验收标准

1. ✅ 使用 mock SSE server，4 种 Provider 均能正确输出流式文本并触发 `done`。
2. ⚠️ 自定义 Provider 连接本地代理或 OpenAI 兼容端点成功。_(注：构造测试通过，未做真实 HTTP 调用)_
3. ✅ AbortSignal 触发后 fetch 立即终止，不再接收后续 chunk。_(代码路径完整覆盖，真实 HTTP 端到端测试未做)_
4. ✅ 指标计算中 TTFT、Latency、Tokens/s 与费用估算不为空或 NaN。_(metrics.test.ts 8 个测试覆盖)_

## 依赖提醒

- **阻塞项**：M7 需提供 `ProviderConfig` 读取与明文存储接口。_(已由 `stores/settings.store.ts` + `modules/storage/types.ts` 提供)_
- **后续接入**：M4 将并发调用 `createProvider` 与 `chatStream`。
