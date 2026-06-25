# 处理层：沉浸式侧边栏对话 (Chat with Doc)

## 目标
用户在侧边栏中对当前网页内容提问，AI 基于整篇 Markdown 文本回答，支持流式输出和 Markdown 渲染。

## 最小可执行任务

### 1. Chat 页面 UI 搭建
- [ ] 创建 `entrypoints/sidepanel/pages/ChatPage.vue`
- [ ] 布局：顶部文档摘要区 + 中部消息列表 + 底部输入框
- [ ] 文档摘要区：标题、URL、字数、元数据折叠展示
- [ ] 消息列表：用户消息（右）/ AI 消息（左）气泡
- [ ] 输入框：多行 textarea + 发送按钮（支持 Enter 发送，Shift+Enter 换行）

### 2. Prompt 构建器
- [ ] 实现 `core/chat/prompt-builder.ts`
- [ ] 组装消息数组：`[systemPrompt, {role: 'user', content: docMarkdown + question}]`
- [ ] 系统提示词优先级：模型专属 > 全局默认 > 内置默认
- [ ] 上下文截断策略（超长文档时保留前 N tokens）

### 3. SSE 流式通信
- [ ] Background 实现 `startChatStream(documentId, question, modelId)`
- [ ] 调用 `fetch()` 发起 SSE 请求（`Accept: text/event-stream`）
- [ ] 使用 `eventsource-parser` 解析 SSE chunks
- [ ] 通过 `chrome.runtime.sendMessage` / `chrome.runtime.connect` 长连接转发 delta 到 Side Panel
- [ ] 处理连接断开、超时（30s）、错误码

### 4. 流式消息渲染
- [ ] 创建 `StreamMessage.vue` 组件
- [ ] 实时追加 delta content 到消息气泡
- [ ] 支持 Markdown 实时渲染（`MarkdownRenderer.vue`）
- [ ] 代码块高亮（`highlight.js`）
- [ ] 数学公式支持（可选：KaTeX）
- [ ] 流式打字机效果（平滑滚动）

### 5. Markdown 渲染器
- [ ] 创建 `MarkdownRenderer.vue`
- [ ] 使用 `DOMPurify` 净化 HTML（防 XSS）
- [ ] 代码块语法高亮（`highlight.js`，自动检测语言）
- [ ] 链接可点击（新开标签页）
- [ ] 图片懒加载
- [ ] 表格样式

### 6. Chat 历史管理
- [ ] 定义 `ChatHistory` 接口（`core/chat/chat.types.ts`）
  - `id`, `documentId`, `modelId`, `model`, `messages[]`, `createdAt`, `updatedAt`
- [ ] 实现 `chatRepository.ts`（Dexie `chatHistories` 表）
- [ ] 流式完成后保存完整对话记录
- [ ] Chat 页面加载时读取历史消息列表
- [ ] 支持清空当前对话历史

### 7. 对话状态管理
- [ ] 使用 Pinia 管理当前对话状态
- [ ] 状态：idle / loading / streaming / error
- [ ] 中断/停止生成按钮（AbortController）
- [ ] 重试失败消息

---

## 验收标准
- [ ] 输入问题后 1 秒内开始流式输出（网络正常）
- [ ] 中文 SSE 无乱码、无截断
- [ ] Markdown 渲染正确（代码块、列表、链接、表格）
- [ ] 对话历史持久化，刷新页面后可恢复
- [ ] 支持中断生成，中断后 UI 状态正确

## 依赖模块
- `core/models/openai-compat.adapter.ts`（SSE 请求）
- `core/documents/document.service.ts`（读取文档内容）
- `db/dexie.ts`（chatHistories 表）
- `workers/search.worker.ts`（可选：RAG 扩展）
