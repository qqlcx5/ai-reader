# M4 多模型工作区 — 2026-06-21 完成报告

## 总结
M4（多模型并发工作区）落地，MVP 全部 5 模块齐备（M7 + M2 + M3 + M1 + M4）。

## 关键交付
- **核心层**（`lib/workspace/`）：
  - `types.ts` — `Conversation / Message / ModelResponseStatus / RunRequest / RunResult` 等 9 个类型
  - `buildSystemPrompt.ts` — System Prompt 构造 + 上下文注入 + `buildHistoryMessages`
  - `scheduler.ts` — `runMultiModelChat` / `runSingleModel` / `diffModelResponses`（1~4 provider 并发，Promise.allSettled，独立 AbortController）
  - `index.ts` — 公共 API
- **UI 层**（`components/workspace/`，9 个 Vue 组件）：
  - `ChatWorkspace.vue` — 工作区主壳，负责状态机（pending → streaming → done / error / aborted）、用户输入触发、Abort 协调
  - `ModelGrid.vue` / `ModelCard.vue` / `ModelCardFooter.vue` — 1~4 模型卡片，含复制 / 重试 / 切换分支 / 费用 / 速度指标
  - `MessageList.vue` — RecycleScroller 虚拟滚动（itemSize=320）
  - `UserMessage.vue` / `StreamingText.vue` — 增量流式渲染 + markdown-it 解析
  - `InputComposer.vue` — 多行输入 + 发送 / 停止
  - `ModelSelector.vue` — Provider 多选下拉
- **SidePanelLayout 接入**：替换占位卡片，渲染 ChatWorkspace
- **测试**：92/92 通过（11 个新增）
- **依赖**：markdown-it 14.2.0

## 重要架构调整：modules/workspace/ → lib/workspace/
**问题**：WXT 0.20 的 `resolveInternalUserModules` 会自动扫描 `modules/*/index.ts` 并在 jiti 中加载，但 jiti 不支持 tsconfig 的 `@/...` 路径别名，导致 build 报 `Could not load @/modules/workspace`。

**方案**：把 M4 全部实现迁出 `modules/`，落到 `lib/workspace/`，仅留一个空 default-export stub 在 `modules/workspace/index.ts` 满足 WXT 的发现器。`modules/workspace/types.ts` 等文件清空。消费者导入路径统一改为 `@/lib/workspace`。

**测试侧调整**：vitest.config.ts 增加 `lib/**/*.{test,spec}.ts` 到 include，并 exclude `modules/workspace/**` 防止空测试文件被扫描到。

**根因记录**：WXT 自动发现 `modules/` 内子目录的 `index.ts` 是有意的（用于「user modules」注册），任何需要 tsconfig path 别名的代码都不应该放在那里。

## 踩坑与修复
1. `createParser(fn)` → `createParser({ onEvent: fn })`（eventsource-parser v3 API）
2. `RecycleScroller itemSize` 不接受函数（仅 number/object）
3. `scheduler.ts` 中 `buildHistoryMessages` 接受 user/assistant，不接受 system
4. `settings.providers[].defaultModel` 与 `provider.ProviderConfig.model` 类型不兼容 — 加 `toProviderConfig` 映射
5. `messages[0]?.content` 当 `role !== 'system'` 时为 `undefined`，需守卫
6. JSDoc 注释中 `modules/*/index.ts` 被 esbuild 视为未关闭的多行注释 — 改用 `//` 单行注释 + 移除 `/*` 字面

## 验证
- `pnpm vitest run` → 9 files / 92 tests pass
- `pnpm exec vue-tsc --noEmit` → exit 0
- `pnpm build` → 3 entrypoints（options / popup / sidepanel）+ background 生成，sidepanel 254KB（含 markdown-it），总产物 730KB

## 里程碑
✅ MVP 达成：M7 + M2 + M3 + M1 + M4

## 后续可选项
- M5 Roundtable / Relay Chain
- 实跑验证：在 Options 页面配置 Provider + API Key → 打开 Side Panel → 抓取页面 → 发送问题 → 看到多模型并发流式响应
- ProviderConfig 持久化落库（M7 settings 面板）
- ChatWorkspace 状态写入 M7（持久化对话历史 / 指标）
