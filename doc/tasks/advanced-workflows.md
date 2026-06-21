# M5 高阶 AI 工作流 — Vibe Coding 任务清单

> **目标**：实现 Roundtable 圆桌讨论与 Relay Chain 模型接力链两种高阶工作流。
> **输入**：`doc/1.md` 模块 3、`doc/design-05-workflows.md`
> **建议执行顺序**：M3、M4 完成后开始。

---

## 1. 数据模型与模板

- [x] 定义 `WorkflowNodeSpec`、`WorkflowRuntimeNode`、`WorkflowSession`、`WorkflowTemplate` 类型（`lib/workflow/types.ts`）
- [x] `WorkflowNode` 与 `WorkflowTemplateRecord` 也定义在 `modules/storage/types.ts`
- [x] 在 M7 中增加 `workflowTemplates` 表（`modules/storage/db.ts`）；`workflowSessions` 复用 `conversations` 表（`mode = 'roundtable' | 'relay'`）
- [x] 实现模板保存/读取/删除接口（`lib/workflow/template.repo.ts`）
- [x] 创建 2 个默认模板：Roundtable 辩论、Relay Chain 审校（硬编码在 `lib/workflow/defaults.ts`）
- [x] 验证模板持久化

---

## 2. Roundtable 圆桌讨论

- [x] 实现 `lib/workflow/roundtable.ts`
- [x] 对每个节点注入不同 `systemPrompt` 角色
- [x] 并发调用多个 Provider（复用 M3 `chatStream`）
- [x] 将同一问题的多角色结果存入 `runtimeNode.output`
- [x] 实现结果按角色并排展示 UI（`WorkflowResults.vue` / `RoundtableView.vue`）
- [x] 用 mock Provider 测试 3 角色并发（`lib/workflow/__tests__/`）

---

## 3. Relay Chain 接力链

- [x] 实现 `lib/workflow/relay.ts`
- [x] 实现节点拓扑排序 `topologicalSort()`
- [x] 检测循环依赖并抛出错误
- [x] 串行执行节点，上游输出拼接为下游输入
- [x] 支持一个节点依赖多个上游输出
- [x] 用 mock Provider 测试 3 节点串行链路

---

## 4. 节点编辑器

- [x] 实现 `components/workflow/NodeEditor.vue`
- [x] 选择 Provider、填写模型、编写角色 prompt
- [x] Relay Chain 中可选择上游节点
- [x] 表单校验：Provider 非空、prompt 非空、无循环依赖
- [x] 验证保存后模板可重新加载编辑

---

## 5. 工作流启动器与执行器

- [x] 实现 `components/workflow/WorkflowTemplateList.vue`（替代 WorkflowLauncher.vue）
- [x] 实现 `components/workflow/WorkflowTemplateEditor.vue`（新建/编辑模板）
- [x] 实现 `components/workflow/WorkflowResults.vue`（替代 WorkflowRunner.vue）
- [x] 选择模板 → 输入初始问题 → 执行（`WorkflowResults.vue` 中触发）
- [x] 实时显示每个节点的 `status` 与输出
- [x] 支持中止整个工作流

---

## 6. 结果保存与复用

- [ ] 工作流完成后，将结果转换为 `Conversation`（mode 标记为 `roundtable` 或 `relay`）
- [ ] 保存到 M7，可在历史记录中查看
- [ ] 复用 M4 的 `MessageList`/`ModelCard` 展示工作流结果
- [ ] 验证历史记录中可区分普通聊天与工作流会话

---

## 验收标准

1. Roundtable 3 角色对同一问题返回不同视角的回复，且互不影响。
2. Relay Chain 3 节点串行执行，下游节点输入包含上游输出。
3. 循环依赖模板在保存时被拒绝，并给出明确错误提示。
4. 工作流结果可在历史记录中查看，并复用 M4 UI 渲染。

---

## 依赖提醒

- **阻塞项**：M3（Provider 调用）、M4（会话模型与 UI 组件）、M7（Workflow 存储）。
- **后续接入**：可在 M4 的侧边栏中增加「工作流」Tab 作为入口。
