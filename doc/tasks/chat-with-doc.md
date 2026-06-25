# 处理层：沉浸式侧边栏对话 (Chat with Doc)

## 目标
用户在侧边栏中对当前网页内容提问，AI 基于整篇 Markdown 文本回答，支持流式输出和 Markdown 渲染。

## 最小可执行任务

### 1. Chat 页面 UI 搭建
- [ ] 创建 `entrypoints/sidepanel/pages/ChatPage.vue`（参考 `side-panel.html` 和 `core/popup.ts` 的 UI 结构）
- [ ] 布局：顶部文档摘要区 + 中部消息列表 + 底部输入框（参考 `popup.ts` 的 `createElementWithClass` 布局模式）
- [ ] 文档摘要区：标题、URL、字数、元数据折叠展示（参考 `shared.ts` 的变量构建）
- [ ] 消息列表：用户消息（右）/ AI 消息（左）气泡（参考 `popup.ts` 的消息渲染）
- [ ] 输入框：多行 textarea + 发送按钮（支持 Enter 发送，Shift+Enter 换行，参考 `popup.ts` 的输入处理）

### 2. Prompt 构建器
- [ ] 实现 `core/chat/prompt-builder.ts`（参考 `interpreter.ts` 的 `sendToLLM` 的 prompt 构造逻辑）
- [ ] 组装消息数组：`[systemPrompt, {role: 'user', content: docMarkdown + question}]`（参考 `interpreter.ts` 的 `messages` 数组）
- [ ] 系统提示词优先级：模型专属 > 全局默认 > 内置默认（参考 `generalSettings` 的配置层级）
- [ ] 上下文截断策略（超长文档时保留前 N tokens，参考 `interpreter.ts` 的 `max_tokens` 限制）

### 3. SSE 流式通信
- [ ] Background 实现 `startChatStream(documentId, question, modelId)`（参考 `interpreter.ts` 的 `sendToLLM` 和 `background.ts` 的消息处理）
- [ ] 调用 `fetch()` 发起 SSE 请求（`Accept: text/event-stream`，参考 `interpreter.ts` 的流式处理）
- [ ] 使用 `eventsource-parser` 解析 SSE chunks（替代 `interpreter.ts` 的原生解析方式）
- [ ] 通过 `chrome.runtime.sendMessage` / `chrome.runtime.connect` 长连接转发 delta 到 Side Panel（参考 `background.ts` 的消息转发）
- [ ] ✅ **`chrome.runtime.connect` 长连接适合流式转发**（避免反复创建消息端口，参考 `background.ts` 的消息转发）
- [ ] ⚠️ **`onMessage` 监听器中 `return true` 保持通道开放**（参考 chrome-extensions 规则 #5）：
  ```ts
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    (async () => {
      // 异步处理流式 chunk
      sendResponse({ chunk: data });
    })();
    return true; // 关键！
  });
  ```
- [ ] 处理连接断开、超时（30s）、错误码（参考 `interpreter.ts` 的错误处理）

### 4. 流式消息渲染
- [ ] 创建 `StreamMessage.vue` 组件（参考 `popup.ts` 的消息渲染和 `renderer.ts`）
- [ ] 实时追加 delta content 到消息气泡（参考 `interpreter.ts` 的流式响应处理）
- [ ] 支持 Markdown 实时渲染（`MarkdownRenderer.vue`，参考 `utils/renderer.ts`）
- [ ] 代码块高亮（`highlight.js`，参考 `styles/reader/code-highlighting.scss`）
- [ ] 数学公式支持（可选：KaTeX，参考 `reader.ts` 的公式处理）
- [ ] 流式打字机效果（平滑滚动，参考 `popup.ts` 的 UI 更新模式）

### 5. Markdown 渲染器
- [ ] 创建 `MarkdownRenderer.vue`（参考 `utils/renderer.ts` 的渲染逻辑）
- [ ] 使用 `DOMPurify` 净化 HTML（防 XSS，参考 `content-extractor.ts` 的 HTML 处理）
- [ ] 代码块语法高亮（`highlight.js`，参考 `styles/reader/code-highlighting.scss`）
- [ ] 链接可点击（新开标签页，参考 `reader.ts` 的链接处理）
- [ ] 图片懒加载（参考 `reader.ts` 的图片处理）
- [ ] 表格样式（参考 `styles/reader/tables.scss`）

### 6. Chat 历史管理
- [ ] 定义 `ChatHistory` 接口（参考 `types.ts` 的数据结构风格）
  - `id`, `documentId`, `modelId`, `model`, `messages[]`, `createdAt`, `updatedAt`
- [ ] 实现 `chatRepository.ts`（Dexie `chatHistories` 表，参考 `storage-utils.ts` 的存储模式）
- [ ] 流式完成后保存完整对话记录（参考 `interpreter.ts` 的响应保存）
- [ ] Chat 页面加载时读取历史消息列表（参考 `popup.ts` 的初始化加载）
- [ ] 支持清空当前对话历史（参考 `storage-utils.ts` 的数据清理模式）

### 7. 对话状态管理
- [ ] ✅ **使用 `chrome.storage.session` 存储 Background 中的对话状态**（参考 chrome-extensions 规则 #7：SW 是 ephemeral，绝对不能使用全局变量）：
  ```ts
  // ❌ 错误：SW 终止后丢失
  // let isStreaming = false;

  // ✅ 正确：持久化在 chrome.storage.session（SW 重启后保留，浏览器关闭后清除）
  const { isStreaming = false } = await chrome.storage.session.get('isStreaming');
  await chrome.storage.session.set({ isStreaming: true });
  ```
- [ ] 状态：idle / loading / streaming / error（参考 `interpreter.ts` 的请求状态）
- [ ] 中断/停止生成按钮（AbortController，参考 `interpreter.ts` 的请求控制）
- [ ] 重试失败消息（参考 `interpreter.ts` 的错误重试逻辑）
- [ ] ⚠️ **`onMessage` 异步响应必须 `return true`**（参考 chrome-extensions 规则 #5）

---

## 验收标准
- [ ] 输入问题后 1 秒内开始流式输出（网络正常，参考 `interpreter.ts` 的流式响应）
- [ ] 中文 SSE 无乱码、无截断（使用 `eventsource-parser`，替代 `interpreter.ts` 的原生解析）
- [ ] Markdown 渲染正确（代码块、列表、链接、表格，参考 `renderer.ts`）
- [ ] 对话历史持久化，刷新页面后可恢复（参考 `storage-utils.ts` 的存储模式）
- [ ] 支持中断生成，中断后 UI 状态正确（参考 `interpreter.ts` 的 AbortController）

## 依赖模块
- `core/models/openai-compat.adapter.ts`（SSE 请求，参考 `interpreter.ts`）
- `core/documents/document.service.ts`（读取文档内容，参考 `content-extractor.ts`）
- `db/dexie.ts`（chatHistories 表，参考 `storage-utils.ts`）
- `workers/search.worker.ts`（可选：RAG 扩展，参考 `search.md`）
