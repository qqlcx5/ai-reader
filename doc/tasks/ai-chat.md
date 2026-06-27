# AI 对话 (ai-chat)

- [ ] ChatPanel 消息列表：`src/components/workspace/ChatPanel.vue`，使用 `v-for` 渲染 `chatStore.currentConversation.messages`，底部固定输入区，消息区 `overflow-y-auto` 自动滚动到底部
- [ ] ChatMessage 气泡样式：`src/components/workspace/ChatMessage.vue`，用户消息右对齐蓝色气泡（`ml-auto bg-blue-500 text-white`），AI 消息左对齐白色卡片（`mr-auto bg-white border`），显示 role 标识和时间戳
- [ ] ModelSelect 组件：`src/components/workspace/ModelSelect.vue`，下拉列表仅显示 `modelStore.enabledModels`，默认选中 `isDefault` 模型，底部提示"切换后仅对新消息生效"
- [ ] 当前上下文挂载状态标识：ChatPanel 顶部或输入区上方显示横幅"已挂载页面上下文：{document.title}" 或 "未挂载上下文"，根据 `documentStore.currentDocument` 是否存在切换
- [ ] 发送消息 — Enter 发送 / Shift+Enter 换行：`ChatInput.vue` 中 `<textarea>` 绑定 `@keydown.enter`，仅当 `!event.shiftKey` 时调用 `chatStore.sendMessage()`
- [ ] 发送前校验（`chatStore.sendMessage` 入口）：检查 ① `modelStore.currentModel` 存在且 `enabled` ② `modelStore.currentModel.baseUrl` / `apiKey` 满足 provider 要求 ③ `documentStore.currentDocument` 存在 ④ `input` 非空 ⑤ 无进行中请求（`isStreaming === false`）
- [ ] 流式输出 SSE：`src/services/ai/` 下使用 `eventsource-parser` 解析 SSE 流，`onToken` 回调中逐字追加到当前 assistant message 的 `content` 字段，触发响应式更新
- [ ] 停止生成：`AbortController.abort()` 取消 fetch，将当前 assistant message `status` 标记为 `'aborted'`，保留已生成内容，`isStreaming` 恢复 false
- [ ] 重新生成：覆盖当前 assistant message，用同一条用户消息重新发起流式请求，`status` 从 `'pending'` 开始重新走 streaming 流程
- [ ] 失败处理：`onError` 回调中将当前 assistant message `status` 设为 `'failed'`，`error` 字段填入错误信息，渲染红色错误卡片（`ErrorCard.vue`），含错误原因文本
- [ ] 对话保存到 IndexedDB：每次消息发送和接收完成后，通过 `ConversationRepository` 写入 IndexedDB，字段：`conversationId / documentId / modelId / messages / createdAt / updatedAt`
- [ ] 消息记录 modelId：每条 `ChatMessage` 存储 `modelId` 字段，标记生成该消息时使用的模型
- [ ] 上下文注入：调用 `PromptBuilder.build()` 组装 `systemPrompt + page_context + history + userInput`，systemPrompt 来源为 `model.systemPrompt || settings.globalSystemPrompt`，为空则不传 system role
