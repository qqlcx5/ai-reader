# 处理层：沉浸式侧边栏对话 (P0)

> **模块名称**: chat-with-doc  
> **优先级**: P0（AI 消化核心体验）  
> **依赖关系**: 依赖 foundation.md、model-management.md（需要已配置的 LLM）、perception.md（需要已提取的文章正文作为上下文）  
> **目标**: 实现基于当前文章正文的 AI 消化对话功能，支持多模型调度、流式生成、Chat 历史持久化

---

## 子任务

### Chat UI 搭建
- [ ] 创建 `views/ChatView.vue`：AI 消化 Tab 的视图容器
- [ ] 实现多模型调度器下拉框（对齐 design.html Tab 2 §2.1）：
  - 模型选择（DeepSeek Chat / Claude 3.5 Sonnet / GPT-4o / Ollama Local）
  - 工作流选择（TL;DR 摘要 / 核心知识榨汁机 / 提炼 Action Items / 生成分类 Tags）
- [ ] 实现流式响应视窗（对齐 design.html §2.2）：
  - 缺省状态占位（图标 + 提示文字）
  - 动态生成区域（Markdown 渲染）
  - 流式打字机效果光标动画 `.cursor-blink`
  - AI 状态指示器（空闲 / 正在生成 / 完成）
- [ ] 实现连续追问输入框（对齐 design.html §2.3）：
  - 文本输入框 + 发送按钮
  - 「清除上下文」按钮
  - 对话历史滚动展示（用户消息右对齐蓝色气泡，AI 消息左对齐灰色气泡）
- [ ] 实现操作功能键区（对齐 design.html §2.4）：
  - 「一键运行 AI 分析」按钮（主按钮，渐变色）
  - 「停止生成」按钮（流式输出中显示）
  - 「复制总结」按钮

### SSE 流式通信
- [ ] 创建 `core/chat/sse-client.ts`
- [ ] 实现 `streamChatCompletion(baseUrl, apiKey, model, messages): AsyncGenerator<string>`
- [ ] 解析 OpenAI 兼容格式 SSE 响应（`data: {"choices":[{"delta":{"content":"..."}}]}`）
- [ ] 集成 `eventsource-parser` 库解析 SSE 事件流
- [ ] 实现 `fetch` + `ReadableStream` 处理（MV3 Service Worker 兼容）
- [ ] 实现错误重试：网络断开/超时 → 自动重连（最多 3 次）
- [ ] 实现「停止生成」功能：abort `AbortController`

### 工作流 Prompt 模板
- [ ] 创建 `core/chat/workflow-prompts.ts`：4 种工作流的 System Prompt 模板
- [ ] TL;DR 摘要 Prompt：生成结构化摘要（核心观点 + 关键结论）
- [ ] 核心知识榨汁机 Prompt：提取 3-5 个核心知识点 + CODE 模型分析
- [ ] 提炼 Action Items Prompt：生成可执行的行动建议列表
- [ ] 生成分类 Tags Prompt：根据文章内容生成 3-7 个分类标签
- [ ] 每个 Prompt 模板支持 `{title}`, `{markdown}` 变量注入

### 流式消息渲染
- [ ] 创建 `components/StreamingMessage.vue`：流式输出气泡
- [ ] 实现打字机效果：逐字符追加渲染，支持 Markdown 实时解析
- [ ] 实现自动滚动：内容溢出时自动滚动到底部
- [ ] 实现光标动画：生成中 `.cursor-blink`，完成后移除
- [ ] 实现 Markdown 渲染器复用：`marked` + `DOMPurify` + `highlight.js`（代码块语法高亮）

### Chat 历史持久化
- [ ] 创建 `db/chat.repository.ts`：IndexedDB 中 `chatHistories` store
- [ ] 定义 `ChatSession` 接口：id / articleId / providerId / modelName / messages[] / createdAt / updatedAt
- [ ] 定义 `ChatMessage` 接口：role (user/assistant/system) / content / timestamp
- [ ] 实现 `saveSession(session: ChatSession): Promise<void>`
- [ ] 实现 `getSessionByArticle(articleId: string): Promise<ChatSession | undefined>`
- [ ] 实现 `listSessions(): Promise<ChatSession[]>`
- [ ] 实现 `deleteSession(id: string): Promise<void>`
- [ ] Popup 打开文章时自动加载对应的 Chat 历史

### Chat 上下文管理
- [ ] 创建 `composables/useChat.ts`：管理对话状态
- [ ] 实现 `startAnalysis(articleId, workflow)`：构建 messages 并发送流式请求
- [ ] 实现 `sendMessage(articleId, content)`：追加用户消息并获取 AI 回复
- [ ] 实现 `clearContext()`：清除当前对话，重置为初始状态
- [ ] 实现上下文窗口管理：Token 估算 + 超限裁剪（保留最近 N 轮）
- [ ] 实现文章正文作为 System Message 注入（截断至 8000 tokens）

### 错误处理
- [ ] API Key 未配置 → UI 提示「请先在设置中配置 LLM API Key」
- [ ] API 请求超时 → 显示错误，可重试
- [ ] 网络断开 → 显示连接错误，自动重试 3 次
- [ ] 模型返回错误 → 显示 API 错误信息
- [ ] 流式中断 → 保留已生成内容，显示中断提示

---

## 验收标准

- [x] 4 种工作流均可正常生成 AI 分析结果
- [x] 流式生成有打字机效果，停止按钮可中断
- [x] 连续追问上下文保留，清除后可重置
- [x] Chat 历史关闭 Popup 重新打开后仍存在
- [x] 未配置 API Key 时给出明确引导
- [x] Markdown 渲染支持代码块语法高亮

## 依赖模块

- `foundation.md` — 状态管理、消息通信
- `model-management.md` — LLM 配置读取（baseUrl + apiKey）
- `perception.md` — 文章正文作为对话上下文

## 关联文件

- `detail.md` SSE 流式通信、Chat 历史持久化
- `design.html` Tab 2 AI 消化 UI 原型
