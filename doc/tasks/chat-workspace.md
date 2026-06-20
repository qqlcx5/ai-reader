# M4 多模型工作区 — Vibe Coding 任务清单

> **目标**：实现 Cherry 风格多模型并发对话工作区，支持流式渲染、指标底栏与分支追问。
> **输入**：`doc/1.md` 模块 2、`doc/design-04-workspace.md`
> **建议执行顺序**：M2、M3、M7 完成后开始；M5 依赖此模块。

---

## 1. 数据模型与 Store

- [ ] 在 M7 的 `types.ts` 中确认 `Conversation`、`Message`、`ModelResponse` 结构
- [ ] 创建 `stores/conversation.store.ts`
- [ ] 实现当前会话的创建、读取、追加消息
- [ ] 实现 `modelResponses` 的按 Provider 更新
- [ ] 实现历史会话列表的懒加载（只读主表）
- [ ] 在 Dexie 中写入测试数据，验证 store 读取正确

---

## 2. 多模型调度器

- [ ] 实现 `modules/workspace/scheduler.ts`
- [ ] 根据用户勾选的 1~4 个 Provider 并发发起 `chatStream`
- [ ] 每个 Provider 独立 `AbortController`
- [ ] 分发 `onDelta` / `onStatus` / `onMetrics` 回调
- [ ] 用 mock Provider 测试 4 模型并发，互不阻塞

---

## 3. 消息列表与虚拟滚动

- [ ] 安装 `vue-virtual-scroller`
- [ ] 实现 `components/workspace/MessageList.vue`
- [ ] 使用 `RecycleScroller` 绑定 `ConversationRecord` 列表
- [ ] 实现 `UserMessage.vue` 与 `ModelGrid.vue`
- [ ] 用 1000 条测试会话验证滚动流畅性

---

## 4. 模型卡片与增量渲染

- [ ] 实现 `components/workspace/ModelCard.vue`
- [ ] 实现 `StreamingText.vue`：增量追加文本，不对全量历史重渲染
- [ ] 使用 `requestAnimationFrame` 节流，目标滚动帧率 ≥ 45fps
- [ ] 缓存已完成消息的渲染 HTML
- [ ] 用 100K tokens 长文本测试生成过程中不卡顿

---

## 5. 数据透视底栏

- [ ] 实现 `components/workspace/ModelCardFooter.vue`
- [ ] 显示：耗时(ms) | TTFT | Tokens/s | 消耗量预估
- [ ] 从 M3 返回的 `RequestMetrics` 中取值
- [ ] 当流式结束时最终刷新一次指标

---

## 6. 输入区与模型选择器

- [ ] 实现 `components/workspace/InputComposer.vue`
- [ ] 实现 `components/workspace/ModelSelector.vue`
- [ ] 支持勾选 1~4 个 Provider
- [ ] 发送按钮触发 `scheduler.runMultiModelChat()`
- [ ] 在输入框中支持提示词模板快速插入（二期可扩展）

---

## 7. 单分支追问

- [ ] 在 `ModelCardFooter.vue` 添加「以此继续」按钮
- [ ] 实现分支会话创建：`createBranchConversation()`
- [ ] 新会话仅保留该模型上下文
- [ ] 在 M7 中记录 `parentId` 关系
- [ ] 验证分支对话历史上下文正确

---

## 8. 上下文注入

- [ ] 从 M7 读取 `currentContext`
- [ ] 将上下文构建为 system prompt 前缀
- [ ] 当用户发送消息时自动注入上下文
- [ ] 提供开关允许用户临时忽略上下文

---

## 验收标准

1. 勾选 2 个 mock Provider 并发请求，两个模型卡片同时流式输出，互不等待。
2. 100K tokens 长文本生成过程中，滚动帧率保持 ≥ 45fps（通过 Chrome DevTools Performance 验证）。
3. 点击「以此继续」后，新会话只包含选中模型的回复作为上下文。
4. 历史列表使用虚拟滚动，1000 条记录下 DOM 节点数稳定在 ~20 个。

---

## 依赖提醒

- **阻塞项**：M2（提取上下文）、M3（Provider 调用）、M7（Conversation/Message 存储）。
- **后续接入**：M5 将复用本模块的调度器与数据模型。
