# messaging — 跨上下文消息通道

> 详细设计参考：doc/detail.md §2.2 (通信路径)
> 技术参考：obsidian-clipper background.ts 消息路由

技术栈：WXT messaging API (`@wxt-dev/module-vue`)、chrome.runtime.sendMessage

---

## 任务清单

### 1. 消息类型定义

- [x] 创建 `messaging/types.ts`，定义所有消息 action 联合类型
- [x] 定义 `EXTRACT_PAGE` —— 输入 `{ tabId: number }`，输出 `ExtractResult`
- [x] 定义 `GET_ACTIVE_TAB` —— 无输入，输出 `{ tabId: number; url: string; title: string }`
- [x] 定义 `PING` —— 无输入，输出 `boolean`
- [x] 定义 `COPY_MARKDOWN` —— 输入 `{ text: string }`，输出 `void`

### 2. Background 消息路由

- [x] 在 `entrypoints/background.ts` 中注册 `onMessage` 监听器
- [x] 实现 `GET_ACTIVE_TAB` handler：`chrome.tabs.query({ active: true, currentWindow: true })`
- [x] 实现 `EXTRACT_PAGE` handler：向指定 tabId 发送消息给 Content Script，等待响应后回传
- [x] 实现 `PING` handler：直接返回 `true`（测试消息通道是否通畅）
- [ ] 实现 `COPY_MARKDOWN` handler：通过 Offscreen Document 或 Clipboard API 复制

### 3. Popup 端封装

- [x] 创建 `messaging/client.ts`，封装 Promise 化的 `sendMessage()` 函数
- [x] 实现 `extractPage(tabId): Promise<ExtractResult>`
- [x] 实现 `getActiveTab(): Promise<{ tabId, url, title }>`
- [x] 实现 `copyMarkdown(text): Promise<void>`
- [x] 统一错误处理：消息超时（10 秒）、Content Script 未注入时自动重试

### 4. Background ↔ Content Script 通信

- [x] 确认 WXT 的 `defineBackground` + `defineContentScript` 是否自动处理消息注册
- [x] 如不支持，手动使用 `chrome.tabs.sendMessage(tabId, msg)` + `chrome.runtime.onMessage` 配对

### 5. 测试

- [ ] 编写消息通道集成测试：Popup → Background → Content Script → 返回结果
- [ ] 测试超时场景：Content Script 无响应时返回 AppError
- [ ] 测试 Content Script 未注入时的 fallback（触发 `scripting.executeScript` 注入后重试）

## 验收标准

- `getActiveTab()` 返回当前 tab 的 url 和 title
- `extractPage(tabId)` 触发 Content Script 提取并返回 ExtractResult
- 消息超时 10 秒后返回明确错误，不 hang
- Content Script 未注入时自动注入并重试
