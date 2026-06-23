# M4 页面对话工作区 — Vibe Coding 任务清单 (v1)

> **目标**：实现 Page-Isolated Chat 核心体验：URL 绑定会话、Context 自动注入、Arena 多模型并发对比、流式渲染、对话管理与快捷指令。
> **输入**：`doc/proposal_v1.md` §2.3、§3.5、§3.6
> **依赖**：M2（提取引擎）、M3（Provider 客户端）、M8（存储层）

---

## 1. URL 绑定与会话隔离

- [x] 实现 `lib/chat/url-key.ts`
  - `normalizeUrl(url: string): string`：去除查询参数与 hash 后的净 URL
  - `hashUrl(url: string): Promise<string>`：`SHA-256(normalizeUrl)` → hex string，作为 `Conversation.id`
- [ ] Content Script 在 Side Panel 打开时获取当前 Tab URL，计算 `pageId`
- [x] `stores/conversation.store.ts`：
  - `loadOrCreate(pageId)` → 从 M8 `Conversations` 主表读取，不存在则创建新记录
  - `currentPageId` 响应式状态
- [ ] 切换 Tab 时不自动切换对话（静默锚定，对接 M2 §4）

---

## 2. 自动 Context 注入

- [x] 实现 `lib/chat/context-builder.ts`
  - `buildSystemPrompt(extraction: ExtractionResult, metadata: PageMetadata): string`
  - 注入顺序：`[系统角色指令] → [页面元数据摘要 Markdown] → [正文全文]`
  - 元数据摘要格式：`Title / Author / Published / URL / WordCount / Engine`
- [ ] 每次 `chatStream` 调用前将 system prompt 注入 messages 首位
- [x] 不对正文做任何截断（对接 M2 §2 No Truncation 约束）

---

## 3. 多模型并发对比（Arena Mode）

- [x] 实现 `lib/chat/arena-scheduler.ts`
  - 接收已勾选 Provider 列表（1～4 个）
  - 为每个 Provider 创建独立 `AbortController`
  - 并发调用 `M3.IEngine.chatStream()`，互不阻塞
  - 向每个 Provider 分发独立的 `onDelta` / `onMetrics` / `onError` 回调
- [x] `stores/arena.store.ts`：管理每个 Provider 的流式状态（streaming / done / error / metrics）
- [x] 支持全局 `ABORT_ALL`：一次性 abort 所有 Provider 的 `AbortController`

---

## 4. 消息流视图（Chat View）

- [x] 实现 `components/chat/MessageList.vue`
  - 滚动区域（`overflow-y-auto`），新消息自动滚动到底部（`scrollIntoView`）
  - 第一条系统消息为"页面摘要卡片"，可点击展开查看完整提取正文
- [x] 实现 `components/chat/UserBubble.vue`
  - 白色背景 + `border-obsidian-border` + `rounded-2xl rounded-tr-sm`
  - 最大宽度 78%，右对齐，`text-xs`
  - hover 时出现删除操作按钮（`opacity-0 group-hover:opacity-100`）
  - 双击进入编辑模式（`contenteditable`），保存后截断后续消息并重新生成
- [x] 实现 `components/chat/ModelGrid.vue`
  - 默认单列 `grid-cols-1`，2 模型时 `md:grid-cols-2`，3～4 模型时 `grid-cols-2`
  - 渲染 `ModelCard` 列表

---

## 5. 模型卡片（ModelCard）

- [x] 实现 `components/chat/ModelCard.vue`
  - 卡片容器：白色背景 + `border-obsidian-border` + `rounded-2xl` + `shadow-sm`
  - Header：左侧厂商色点（primary / green / orange / red 按 Provider 映射）+ 模型名 `text-xs font-bold` + 状态 badge（streaming / done / error / cached）
  - Body：`MarkdownRenderer.vue`，`min-height: 140px`，`overflow-hidden`
  - Footer：`ModelCardFooter.vue`
- [x] 实现 `components/chat/StreamingText.vue`
  - 增量字符串追加（append to ref string），不对历史内容重渲染
  - 使用 `requestAnimationFrame` 节流，约 16ms 批量合并 delta，帧率目标 ≥ 45fps
  - 流式结束前显示 `.typing-cursor`（`▋ animate-pulse`），结束后移除
- [x] 实现 `components/chat/MarkdownRenderer.vue`
  - 使用 `markdown-it` 渲染，XSS 防护通过 html:false 选项实现
  - 对已完成消息缓存渲染 HTML（`computed` + 内容比较），避免重复 render

---

## 6. 模型卡片底栏（ModelCardFooter）

- [x] 实现 `components/chat/ModelCardFooter.vue`
  - 展示指标：`TTFT: Xms | TPS: X.X | 费用: $X.XXXX`
  - 等宽字体 `font-mono text-[10px] text-obsidian-muted`
  - 缓存命中时显示 `⚡ Cached`（`text-obsidian-green`）
- [x] 三个操作按钮：
  - 【以此继续】：分离单线对话（参见 §7）
  - 【中止】：`controller.abort()`，流式结束即消失
  - 【重试】：重新调用同一 Provider 的 `chatStream`

---

## 7. 对话管理操作

- [ ] **重试（Regenerate）**：
  - 重新发送最后一条 `role: 'user'` 消息
  - 支持在底部选择不同模型重试
  - 删除原 assistant 消息并写入新消息
- [x] **编辑用户消息**：
  - 双击 `UserBubble` → `contenteditable` 编辑模式
  - 保存（Enter / 保存按钮）：截断该消息之后的所有 `chatHistory`（M8 `messageRepo.truncateAfter(messageId)`）
  - 截断后自动触发重新生成（由父组件 `edit-message` 事件处理）
- [x] **删除单条消息**：
  - hover 消息时出现删除按钮
  - 触发 `delete-message` 事件，由父组件调用 `messageRepo.deleteMessage()` 持久化删除
- [ ] **单分支追问**：
  - 点击 `ModelCardFooter` 的【以此继续】
  - 创建新 `Conversation`（`parentId` 关联当前），仅保留选中模型的回复作为上下文
  - 新会话在当前 Side Panel 中打开

---

## 8. 底部输入区（InputBox）

- [x] 实现 `components/chat/InputComposer.vue`
  - 模型路由选择器（`ModelRouteChips.vue`）：`rounded-full` 药丸 chips，横向换行，复选框 + 模型名 + 厂商色点
  - 多行文本域：`rounded-xl`，min-h 56px，max-h 128px，`resize-y`，聚焦 `focus:ring-4 focus:ring-primary/10`
  - 发送按钮：`bg-obsidian-primary`，白色文字，`rounded-xl`，`shadow-sm`
  - 中断按钮（`⎋ Esc`）：流式进行时显示，触发 `ABORT_ALL`
- [x] 实现 `components/chat/QuickPromptBar.vue`
  - 底部 `text-[10px]` 文字按钮（带下划线）：总结摘要 / 解释关键概念 / 提取核心观点 / 翻译成中文 / 红队批判 / 脉络大纲
  - 点击后将对应 Prompt 填入输入框并自动提交（或仅填入，由用户确认）
  - 圆桌交锋 / 串联接力两个工作流快捷按钮（跳转到 M5）

---

## 9. 页面摘要卡片（首条系统消息）

- [x] 实现 `components/chat/PageSummaryCard.vue`
  - 固定为对话第一条消息，展示：favicon + 标题 + 字数 + 提取引擎 badge
  - 默认折叠，点击"展开查看提取正文"展开显示完整 Markdown 正文
  - 展开动画：`max-height` 从 0 → auto，150ms ease-out

---

## 验收标准

1. 打开网页 A 发送消息，切换到网页 B 再回到 A，对话记录完整保留，两页记录互不干扰。
2. 勾选 2 个模型同时发送：两个 `ModelCard` 同时流式输出，互不等待，TTFT 均可见。
3. 100K tokens 长回复生成过程中，Chrome DevTools Performance 帧率 ≥ 45fps。
4. 双击用户消息 → 编辑 → 保存 → 后续消息截断 → 自动重新生成，历史正确。
5. `⚡ Cached` 标注在 L3 缓存命中时正确显示。
