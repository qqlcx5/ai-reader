# capture-view — 采集页 (CaptureView)

> 详细设计参考：doc/detail.md §3.2 (当前页检测)、§3.3 (网页提取)、§3.6 (采集页模块)
> 现有代码：components/views/CaptureView.vue（已有 UI，pipeline 为模拟）

依赖：domain、messaging、storage

---

## 任务清单

### 1. 当前页检测接入

- [ ] 添加 `useCurrentPage` composable：Popup `onMounted` 时调用 `messaging.getActiveTab()` 获取 tab 信息
- [ ] 将返回的 `{ tabId, url, title }` 存入 `CaptureViewState.page`
- [ ] 页面检测完成后，显示真实的 title、url、siteName（从 URL 解析 hostname）
- [ ] 「重新检测」按钮：重新调用 `getActiveTab()` 并刷新页面信息

### 2. 不可提取页面处理

- [ ] 检测 URL 是否为 `chrome://`、`chrome-extension://`、`edge://` 等内置页面
- [ ] 内置页面：显示「浏览器内部页面无法读取」，禁用提取按钮
- [ ] 无正文页面：允许保存元数据，但提示正文为空

### 3. 提取 Pipeline 接入

- [ ] 替换 `runCapture()` 中的 setTimeout 模拟为真实调用链：
  1. `messaging.extractPage(tabId)` → 状态 extracting
  2. 接收结果 → 状态 markdown（Content Script 已完成 Markdown 生成）
  3. `articleStore.saveArticle()` → 状态 saving → success
- [ ] 实现提取结果 5 秒缓存（`draftExpiresAt`），「复制 Markdown」和「仅预览」优先使用缓存
- [ ] 提取失败时显示 AppError 的 `toUserMessage()`，pipeline 停在出错步骤

### 4. 复制 Markdown

- [ ] 实现复制功能：`navigator.clipboard.writeText(article.markdown)`
- [ ] 复制成功 → Toast「Markdown 已复制」
- [ ] 失败回退：`document.execCommand('copy')` 或 Toast 错误提示

### 5. 仅预览

- [ ] 点击「仅预览」：执行提取，结果存入 `CaptureViewState.draft`（不写入 IndexedDB）
- [ ] 切换到 ReaderView，显示预览文章
- [ ] 预览文章不出现在文章库列表

### 6. RecentSaves 列表

- [ ] 从 `articleStore.getRecentArticles(3)` 读取最近 3 篇
- [ ] 列表项点击 → `openReader(articleId)`
- [ ] 列表项删除 → 打开 ConfirmModal → `articleStore.deleteArticle(id)`
- [ ] 空状态显示「暂无保存文章」

### 7. Markdown Preview Card

- [ ] 显示当前页/已保存文章的 title、excerpt、markdown 预览行
- [ ] 「打开详情」点击 → 切换到 ReaderView

## 验收标准

- 打开 Popup 显示当前页面的真实 title 和 URL
- 点击「提取正文并保存」后 3 秒内完成全流程，文章出现在文章库
- chrome:// 页面显示不可提取状态
- 「复制 Markdown」成功复制到剪贴板
- 「仅预览」不写入 IndexedDB，关闭 Popup 后预览丢失
