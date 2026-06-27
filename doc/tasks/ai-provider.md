# AI Provider 适配层 (ai-provider)

- [ ] AIProvider 统一接口定义：`src/services/ai/types.ts` 定义 `AIProvider` interface，含 `chat(input: ChatInput): Promise<ChatOutput>` / `streamChat(input: ChatInput, callbacks: StreamCallbacks): Promise<void>` / `testConnection(config: ModelConfig): Promise<TestConnectionResult>`
- [ ] OpenAICompatibleProvider 实现：`src/services/ai/openai-compatible.ts`，`chat` 方法 POST `{baseUrl}/chat/completions`，`streamChat` 方法设置 `stream: true` 并用 `eventsource-parser` 解析 SSE delta
- [ ] AnthropicProvider 实现：`src/services/ai/anthropic.ts`，适配 Messages API（POST `{baseUrl}/v1/messages`），Header `x-api-key: {apiKey}`，`anthropic-version: 2023-06-01`；`streamChat` 解析 SSE `content_block_delta` 事件
- [ ] OllamaProvider 实现：`src/services/ai/ollama.ts`，`chat` 方法 POST `{baseUrl}/api/chat`，`streamChat` 设置 `stream: true` 解析 NDJSON；`testConnection` 调用 `/api/tags`
- [ ] Prompt Builder：`src/services/prompt/builder.ts` 实现 `buildPrompt(input: BuildPromptInput): BuiltPrompt`，组装 systemPrompt + page_context + history + userInput
- [ ] systemPrompt 解析规则：`resolveSystemPrompt(model, settings)` → `model.systemPrompt?.trim() || settings.globalSystemPrompt?.trim() || undefined`，返回 undefined 时各 Provider 不发送 system role/字段
- [ ] page_context 格式生成：`src/services/prompt/context.ts`，根据 settings 生成 `<page_context>` XML 块或 Markdown 块，按 `includeTitleInPrompt / includeUrlInPrompt / includeCapturedAtInPrompt` 开关决定包含哪些元数据
- [ ] 上下文截断：`src/services/prompt/truncate.ts`，按 `maxContextTokens` 裁剪 markdown 内容（保留开头部分），取 `model.contextWindow` 和 `settings.context.maxContextTokens` 较小值；优先保留 title/url 等元数据
- [ ] 历史消息裁剪：按 `settings.context.maxHistoryMessages` 保留最近 N 条对话历史（`conversation.messages.slice(-N)`），历史消息只取 role + content
- [ ] Provider 工厂：`src/services/ai/factory.ts`，`getProvider(providerType: ModelConfig['provider']): AIProvider`，根据 provider 字段返回对应实例
