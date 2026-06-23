# M2 智能正文提取引擎 — Vibe Coding 任务清单 (v1)

> **目标**：实现三级降级提取算法、无截断上下文直通、结构化元数据采集、高亮选区与浮动工具栏，并通过 Shadow DOM 隔离注入式 UI。
> **输入**：`doc/proposal_v1.md` §2.1
> **依赖**：M8（存储层，用于持久化高亮数据）

---

## 1. 三级降级提取算法

- [x] 安装依赖：`@mozilla/readability`、`turndown`、`defuddle`
- [x] 实现 `lib/extraction/readability-engine.ts`
  - 接收 `document` 对象，调用 `@mozilla/readability` 提取正文
  - 结果经 `turndown` 转为 Markdown，返回 `{ markdown, wordCount, confidence }`
  - 置信度判断：返回内容 < 200 字 or 内容为空时 `confidence = 'low'`
- [x] 实现 `lib/extraction/defuddle-engine.ts`
  - 使用 `defuddle` 的 `createMarkdownContent` 一步完成 DOM → Markdown 转换
  - 设置 8 秒超时（`Promise.race` + `AbortSignal`），超时后 reject
- [x] 实现 `lib/extraction/fallback-engine.ts`
  - 清洗 `<script>` / `<style>` / `<noscript>` 节点
  - 直取 `document.body.innerText` 并简单格式化（去多余空行）
- [x] 实现 `lib/extraction/extraction-orchestrator.ts`
  - 按优先级串行 / 降级：Readability → Defuddle → Fallback
  - 返回统一结果类型 `ExtractionResult { markdown, engine, wordCount, metadata }`
- [x] 单元测试：mock `document`，覆盖三条降级路径，验证超时 8s 触发降级

---

## 2. 无截断上下文直通（No Truncation）

- [x] 确认 `ExtractionResult.markdown` 不做任何长度截断
- [x] 在 Context 注入层严禁 `substring` / `slice` 等截断操作（代码 review checklist）
- [x] 向 M4 Chat 模块暴露完整 `rawText`，由 LLM API 自行处理 Token 超限
- [ ] 提取状态条展示 `No Truncation` 绿色 badge（对接 M1 `ExtractionStatusBar`）

---

## 3. 结构化元数据提取

- [x] 实现 `lib/extraction/metadata-extractor.ts`
  - 预置变量：`title` / `author` / `description` / `published` / `site` / `domain` / `favicon` / `image` / `words`
  - Meta 变量：解析 `<meta>` 标签提取 Open Graph 数据（`og:title` / `og:description` / `og:image`）
  - Schema.org：解析页面内 `<script type="application/ld+json">` JSON-LD，提取 `@Article` / `@Recipe` / `@Product` 等
- [x] 元数据输出为 `PageMetadata` 接口类型，存入 M8 副表 `Messages.metadata`
- [x] 单元测试：解析含 JSON-LD 的 HTML fixture，验证字段正确提取

---

## 4. 上下文静默锚定机制

- [x] 在 Content Script 中监听 `chrome.tabs.onActivated` / `chrome.tabs.onUpdated`
- [x] Tab 切换时：保持上一次提取的 `ExtractionResult` 作为当前对话上下文，不自动刷新
- [x] 触发轻量 Toast 提示："上下文已锚定至 [页面标题]，点击刷新可更新"
- [ ] 实现【⟳ 刷新提取当前 Tab】按钮回调：重新执行提取流程并更新状态栏

---

## 5. 高亮选区提取

- [x] 安装 / 集成 Dexie.js（对接 M8 `Highlights` 表）
- [x] 实现 `lib/extraction/highlighter.ts`
  - 监听页面 `mouseup` 事件，获取当前 `Selection`
  - 通过 `Range` API 记录选区 CSS selector + 文本内容 + 样式类型
  - 支持三种提取模式：① 嵌入 `==highlight==` 完整正文；② 仅提取高亮列表；③ 忽略高亮
- [x] 高亮样式预设（CSS class 切换）：`mark`（高亮背景色）/ `underline`（点状）/ `blur` / `wave` / `bold` / `italic`
- [x] 高亮数据写入 M8 `Highlights` 表，关联 `pageId`（`Conversation.id`）
- [x] 页面重新打开时：从 Dexie 按 `pageId` 查询并恢复高亮显示（重新注入 DOM 样式）
- [x] 实现高亮数据按域名分组导出为 `.json` 文件

---

## 6. 浮动工具栏（Shadow DOM 隔离）

- [x] 在 Content Script 中注册 `mouseup` 事件
- [x] 检测到有效选区（`selection.toString().trim().length > 0`）时挂载浮动工具栏
- [x] 使用 **Shadow DOM** 创建工具栏容器（`attachShadow({ mode: 'open' })`），避免宿主 CSS 污染
- [x] 工具栏内 4 个操作按钮：**解释 / 总结 / 翻译 / 提问**（触发对应预置 Prompt）
- [x] 工具栏定位：`position: fixed`，基于 `Range.getBoundingClientRect()` 计算位置，边缘检测自动翻转
- [x] 点击页面空白处自动消失（监听 `document.click` 并比较事件 target）
- [x] 工具栏内部样式完全自包含（inlined CSS，不依赖宿主页面任何样式）

---

## 7. 右键菜单集成

- [x] 在 `background.ts` 中注册 `chrome.contextMenus.create`：
  - 菜单项：解释 / 总结 / 翻译 / 朗读 / 搜索（共 5 项）
  - `contexts: ['selection']`：仅在有选区时显示
- [x] 监听 `chrome.contextMenus.onClicked`，将选中文本 + 操作类型发送给 Side Panel
- [ ] Side Panel 接收消息后，在输入框预填对应 Prompt 并自动提交

---

## 8. 框选模式（Manual Selection Fallback）

- [x] 当 `ExtractionResult.confidence === 'low'` 时，向用户展示框选模式提示横幅
- [x] 实现 `lib/extraction/area-selector.ts`：
  - 注入半透明覆盖层，鼠标拖拽绘制选区矩形（`mousedown` → `mousemove` → `mouseup`）
  - 通过 `document.elementsFromPoint()` 获取矩形区域内的 DOM 元素列表
  - 提取这些元素的 `innerText`，合并为纯文本 / Markdown
- [ ] 框选完成后替换当前 `ExtractionResult.markdown`，更新状态栏

---

## 验收标准

1. 访问主流新闻网页（如 36kr.com），`Readability` 提取成功，耗时 < 100ms，无截断。
2. 访问 SPA 或提取失败的页面，自动降级到 `defuddle`，8s 超时后再降级到 `fallback`。
3. 高亮文字后数据写入 `Highlights` 表，刷新页面后高亮颜色自动恢复。
4. 浮动工具栏通过 Shadow DOM 渲染，与宿主页面样式完全隔离（DevTools 中查看 Shadow Root）。
5. 右键菜单"总结"点击后，Side Panel 输入框自动填充总结 Prompt。
