---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: d270bcd3df6a2cd27c2792fa9a0b45ef_ffadb5ff6d8e11f18805525400d9a7a1
    ReservedCode1: rt1I1r37M/4pOs3isLmlbQa4EGRTdxjq2GVtVk1I//DinSCvUcva9BeXY1/ExaTcOpv/6FTfWL3vhS66ycxHEyii6Uz7M9DMO83AttqpbTJbA5LYKPVsDODv7mISZRJ9RC0C9nxWqp7jzz3P2SBWjrQkXIAvAntGzMkpeufZDl0mq9xBwCttVj2Fcdc=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: d270bcd3df6a2cd27c2792fa9a0b45ef_ffadb5ff6d8e11f18805525400d9a7a1
    ReservedCode2: rt1I1r37M/4pOs3isLmlbQa4EGRTdxjq2GVtVk1I//DinSCvUcva9BeXY1/ExaTcOpv/6FTfWL3vhS66ycxHEyii6Uz7M9DMO83AttqpbTJbA5LYKPVsDODv7mISZRJ9RC0C9nxWqp7jzz3P2SBWjrQkXIAvAntGzMkpeufZDl0mq9xBwCttVj2Fcdc=
---

# 模块 03：多 Provider 引擎

> 对应设计文档：design-03-provider-client.md

## 子任务清单

- [ ] 子任务 1：定义 `ProviderConfig` / `ChatRequest` / `ChatMessage` / `StreamEvent` / `RequestMetrics` / `FailoverConfig` 核心数据类型
- [ ] 子任务 2：实现 `BaseProvider` 抽象类：定义 `chatStream()` 统一接口、`buildHeaders()` / `buildBody()` / `parseStreamChunk()` / `defaultBaseUrl()` 四个抽象方法供子类覆盖
- [ ] 子任务 3：实现 `OpenAICompatibleProvider` 基类（覆盖 13 个 Provider：OpenAI/ChatGPT/Azure OpenAI/DeepSeek/MiniMax/Moonshot/Groq/Kimi/ChatGLM/Cohere/Cerebras/Perplexity/xAI + custom），构建 OpenAI-compatible 请求体与 SSE 解析
- [ ] 子任务 4：实现 `AnthropicProvider`（Claude），适配 Anthropic Messages API 协议格式
- [ ] 子任务 5：实现 `GeminiProvider`，适配 Google Generative Language API 协议格式
- [ ] 子任务 6：实现 `OllamaProvider`（继承 OpenAI-compatible 基类），默认 baseUrl `http://localhost:11434/v1`
- [ ] 子任务 7：实现 Provider 工厂 `factory.ts`，按 `ProviderType` 枚举分派到对应 Provider 类
- [ ] 子任务 8：集成 `eventsource-parser` 统一 SSE 流式解析：在 `chatStream()` 中使用 `createParser()` 替代原生 EventSource，解决中文多字节字符网络 Chunk 截断导致的乱码与格式断裂
- [ ] 子任务 9：集成 `best-effort-json-parser` 处理流式增量 JSON 响应（不完整 tool_calls、usage 字段等）
- [ ] 子任务 10：实现分层错误处理：401/403 引导检查 API Key；429 读取 Retry-After 头展示冷却时间，延迟后重试最多 3 次；5xx 指数退避重试 1 次；其他 4xx 返回错误详情不重试
- [ ] 子任务 11：实现 SSE 断线自动重连 `reconnect.ts`：指数退避策略（初始 1s → 最大 30s，上限 5 次），携带最后 event_id 从断点续传，Side Panel 显示轻量重连指示器
- [ ] 子任务 12：实现多 Provider 故障转移 `failover.ts`：用户配置主备模型链，主模型超时（默认 30s）或失败后自动按优先级切换，全程透明，仅最终成功或全部失败时提示所用模型
- [ ] 子任务 13：实现性能指标采集 `metrics.ts`：TTFT（首次 Token 时间）、总耗时、Tokens/s、消耗量预估（维护 Provider/模型价格表估算），通过 `StreamEvent` 实时推送
- [ ] 子任务 14：实现 Abort 机制：每个 `chatStream` 接收外部 `AbortSignal`，Provider 维护运行中 AbortController 列表；收到 `ABORT_ALL_REQUESTS` 广播后全部 `abort()`
- [ ] 子任务 15：API Key 明文存储于 `chrome.storage.local`（用户已确认），在 Options UI 中提示风险说明「密钥明文存储在本地浏览器，请勿在公共/共享设备使用」
- [ ] 子任务 16：编写各 Provider `buildBody`/`parseStreamChunk` 单元测试、SSE 中文截断拼接测试、best-effort-json-parser 不完整 JSON 测试、费用估算测试、故障转移优先级切换测试、断线重连模拟测试
*（内容由AI生成，仅供参考）*
