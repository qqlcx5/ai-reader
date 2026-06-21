# M3 Provider 与 LLM 客户端 — 开发笔记

> **作者**：主 Agent（协调收尾）
> **日期**：2026-06-21
> **状态**：模块已完成，验收通过

## 实际完成情况

### ✅ 全部实现并测试通过
- 核心代码：`modules/provider/{types,base,factory,sse-parser,retry,metrics,abort-registry,index}.ts`
- 4 个 Provider 实现：`modules/provider/providers/{openai,anthropic,gemini,custom}.ts`
- 单元测试：`modules/provider/__tests__/{provider,metrics,retry}.test.ts`（37 个测试全通过）
- Settings 集成：`stores/settings.store.ts` 已实现 ProviderConfig 增删改、导出（剔除 apiKey）、明文警告 computed
- 验证命令：
  - `pnpm test` → 81/81 通过
  - `pnpm compile` → 0 错误
  - `pnpm build` → 成功生成 `.output/chrome-mv3/`

### ⚠️ 与任务清单的偏差

1. **`__tests__/mock-server.ts` 未独立创建**
   - 任务清单要求"创建 `modules/provider/__tests__/mock-server.ts` 用于测试 SSE"
   - 实际：测试用 **inline mock**（直接在 `provider.test.ts` 中构造 `ProviderConfig` 和 `StreamEvent` 验证 `buildBody` / `parseStreamChunk`），未跑真实 HTTP fetch + SSE
   - 影响：覆盖 `parseStreamChunk` 单元逻辑，但**未覆盖端到端 fetch + SSE 流式 + 重试 + AbortSignal 真实流程**
   - 建议：M3 完成判定保留此偏差。如需端到端测试，可作为二期补完（需要写一个 mock HTTP server 跑 `eventsource-parser` 真实解析）

2. **Options UI 中"API Key 明文存储风险提示"**
   - `stores/settings.store.ts` 已暴露 `apiKeyWarning` computed 供 UI 消费
   - 但 UI 组件尚未消费此 computed → **属于 M1 入口与布局范围**
   - 状态：依赖 M1 实现，状态已就绪

3. **Popup / Side Panel / Options 间配置同步**
   - 依赖 WXT 入口层把 `useSettingsStore()` 挂到三个 entry
   - **属于 M1 范围**
   - 状态：依赖 M1 实现，settings store 已就绪

### 🐛 已修复的 TS 兼容性问题

- `eventsource-parser` v3.x 不再导出旧名 `ParsedEvent`，改用 `EventSourceMessage`
- 修复方式：把 `import { createParser, type EventSourceMessage as ParsedEvent } from 'eventsource-parser'`
  拆为两行：
  ```ts
  import { createParser } from 'eventsource-parser';
  import type { EventSourceMessage as ParsedEvent } from 'eventsource-parser';
  ```
  避免 `type` 修饰符与 `as` 重命名在同一 import 子句中的 TS 解析问题
- 涉及文件：`modules/provider/providers/openai.ts`、`modules/provider/providers/anthropic.ts`

## 跨模块契约

M3 暴露给 M4（多模型工作区）的接口：
- `createProvider(config: ProviderConfig): BaseProvider`
- `BaseProvider.chatStream(request, onEvent): Promise<RequestMetrics>`
- 事件类型：`StreamEvent` 五种变体（start / delta / usage / error / done）
- 全局 Abort：`AbortRegistry.triggerAbortAll()`，配合 M1 的 `Esc` 快捷键

## 已知风险

- API Key 明文存储（用户已确认）：`apiKeyWarning` computed 已就绪，等待 M1 UI 展示
- 真实 LLM API 端到端测试未跑：依赖用户/环境提供 API Key + mock HTTP server
