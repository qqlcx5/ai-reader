# 弹窗 UI 层：Popup Shell 与四大视图 (P0)

> **模块名称**: popup-ui  
> **优先级**: P0（用户交互入口）  
> **依赖关系**: 依赖 foundation.md（样式系统 + 状态管理）；依赖 perception.md（提取 Pipeline 对接）  
> **目标**: 实现 Popup Shell 整体布局和四大视图（CaptureView / LibraryView / ReaderView / SettingsView），对齐 detail.md §3.1 §3.6-3.11 + design.html

---

## 子任务

### Popup Shell 布局
- [ ] 创建 `entrypoints/sidepanel/index.html` + `entrypoints/sidepanel/main.ts`（WXT side panel entry）
- [ ] 创建 `PopupApp.vue`：Root 组件，三区布局（TopBar + ViewContainer + BottomNav）
- [ ] 实现 `PopupTopBar.vue`：Brand Logo + 同步状态指示 + 设置按钮
- [ ] 实现 `BottomNav.vue`：Tab 切换按钮组（当前网页 / AI 消化 / 我的大脑 / 设置）
- [ ] 实现 Tab 切换逻辑：`activeView` 状态驱动 `ViewContainer` 动态组件切换
- [ ] 配置 Popup 尺寸：400px × 660px（对齐 detail.md §6.1）

### 全局 UI 组件
- [ ] 创建 `AppCard.vue`：通用卡片组件（圆角 20px、hover 边框增强）
- [ ] 创建 `IconButton.vue`：带 `aria-label` 的图标按钮
- [ ] 创建 `ToggleSwitch.vue`：设置页开关组件
- [ ] 实现 `ToastHost.vue`：全局 Toast 容器，`useToast()` composable 驱动
- [ ] 实现 `ConfirmModal.vue`：删除确认弹窗（标题 + 描述 + 取消/确认按钮 + backdrop blur + 点击遮罩关闭）
- [ ] 创建 `composables/useToast.ts`：`showToast(state)` / `dismissToast()`
- [ ] 创建 `composables/useModal.ts`：`openModal(config)` / `closeModal()`

### CaptureView 采集页
- [ ] 创建 `views/CaptureView.vue`：主容器，组合子组件
- [ ] 实现 `CurrentPageCard.vue`：当前页状态展示
  - favicon + siteName + url（只读行）
  - title 可编辑输入框
  - author + publishedAt 可编辑输入框
  - description 只读区域
  - SEO Keywords tags 展示
  - 「重新检测」按钮
- [ ] 实现 `CaptureActionPanel.vue`：操作区域
  - 主按钮「提取正文并保存」（文案随 `captureStep` 变化）
  - 「复制 Markdown」按钮
  - 「仅预览」按钮
- [ ] 实现 `ExtractPipeline.vue`：三步进度指示器
  - Step 1 网页提取 / Step 2 Markdown / Step 3 IndexedDB
  - active / done / error 三种状态样式（对齐 design.html §1.5）
- [ ] 实现 `MarkdownPreviewCard.vue`：Markdown 预览区域（深色背景、Commonmark 标记）
- [ ] 实现 `RecentSaves.vue`：最近保存文章列表（取最近 5 篇）
- [ ] 创建 `composables/useCurrentPage.ts`：管理当前 Tab 元数据、重新检测
- [ ] 创建 `composables/useCapture.ts`：管理提取 Pipeline 状态、触发保存/复制/预览

### LibraryView 文章库
- [ ] 创建 `views/LibraryView.vue`：主容器
- [ ] 实现 `SearchPanel.vue`：
  - 搜索框（实时过滤，防抖 200ms）
  - 快捷标签过滤器 chip 组（全部 / #AI / #知识管理 / 等）
  - 搜索统计 chip（"共 N 篇文章"）
- [ ] 实现 `ArticleListCard.vue`：
  - 时间轴分组（今天 / 昨天 / 上周 / 更早）
  - 文章卡片列表（favicon + siteName + title + excerpt + tags + 高亮/AI 标记 + 时间）
  - 点击文章卡片 → 切换到 ReaderView
  - 长按/右键 → 删除按钮
- [ ] 实现 `EmptyState.vue`：无文章状态占位（图标 + 提示文字）
- [ ] 实现搜索无结果状态（区别于文库为空的状态）
- [ ] 创建 `composables/useArticles.ts`：管理文章列表、搜索、分组

### ReaderView 阅读器
- [ ] 创建 `views/ReaderView.vue`：主容器
- [ ] 实现顶部操作区：返回按钮、复制按钮、删除按钮
- [ ] 实现 `MetadataGrid.vue`：元数据网格
  - 作者 / 发布时间 / 站点 / 保存时间（两列布局）
- [ ] 实现 `MarkdownRenderer.vue`：
  - 集成 `marked` 解析 Markdown → HTML
  - 集成 `DOMPurify` 做 XSS 过滤
  - 外链处理：`target="_blank"` + `rel="noopener noreferrer"`
  - 图片协议白名单：`https:` / `http:` / `data:`，禁止 `javascript:` / `file:`
  - 禁止 `<script>`、事件属性、iframe
- [ ] 实现 Frontmatter 预览区域（深色终端风格）
- [ ] 实现阅读器内部滚动（不影响 Popup 整体滚动）
- [ ] 实现「导出 Obsidian Markdown」按钮（单文件下载 + ZIP 归档入口）

### SettingsView 设置
- [ ] 创建 `views/SettingsView.vue`：主容器
- [ ] 实现设置项列表（每组带分节标题 + 分割线）
  - autoSave 开关（提取成功后自动保存）
  - showToast 开关（操作完成后显示 Toast）
  - includeFrontmatter 开关（Markdown 写入元数据）
  - readerStyle 开关（高级阅读排版）
- [ ] 实现「恢复默认」按钮：重置全部设置 → 确认后执行
- [ ] 设置变更即时写入 `chrome.storage.sync`（通过 `useSettings` composable）
- [ ] 创建 `composables/useSettings.ts`：读取/更新/重置设置，与 `SettingsRepository` 对接

### Delete 删除模块
- [ ] 实现统一删除流程：
  1. 用户点击删除 → 设置 `deleteTargetId`
  2. 弹出 `ConfirmModal`
  3. 用户确认 → `StorageService.deleteArticle(id)`
  4. 刷新 UI → Toast 提示
- [ ] 实现删除后导航策略表（对齐 detail.md §3.9）：
  - LibraryView 删除列表文章 → 留在文章库刷新列表
  - ReaderView 删除当前文章 → 返回文章库
  - CaptureView 删除最近文章 → 留在采集页刷新列表
  - ReaderView 删除非当前文章 → 留在当前阅读页

### Toast 通知模块
- [ ] 实现 `useToast` composable：
  - `showSuccess(title, description?)`
  - `showError(title, description?)`
  - `showInfo(title, description?)`
- [ ] 实现 Toast 动画：`translateY + opacity` 过渡
- [ ] 实现自动消失：默认 duration 3000ms，可配置
- [ ] 注册 Toast 使用场景（对齐 detail.md §3.11）：
  - 保存成功 / 复制成功 / 删除成功
  - 检测成功 / 权限不足 / 提取失败 / IndexedDB 失败

### 设计规范遵循
- [ ] CSS tokens 引用（颜色、尺寸、圆角均从 UnoCSS 配置读取）
- [ ] 按钮 hover 动效：`translateY(-1px)`（对齐 detail.md §6.3）
- [ ] 卡片 hover 动效：边框增强 + 背景变白
- [ ] Modal 动效：backdrop blur
- [ ] Pipeline 动效：active/done 状态渐变
- [ ] 列表删除动效：先淡出再移除
- [ ] 可访问性：按钮均有 `aria-label`、焦点支持 Tab、删除二次确认、文本对比度满足可读性
- [ ] 无内联脚本（MV3 CSP 要求）：所有事件通过 Vue `@click` 绑定

---

## 验收标准

- [x] Popup 四 Tab 切换流畅，UI 还原度 > 90%（对照 design.html）
- [x] CaptureView：完整提取 Pipeline 三步骤可视化执行
- [x] LibraryView：搜索实时过滤、时间轴分组、空状态正确
- [x] ReaderView：Markdown 渲染安全（XSS 过滤）、元数据完整
- [x] SettingsView：开关即时生效并持久化
- [x] 删除操作有确认弹窗，删除后导航逻辑正确
- [x] Toast 通知在对应场景正确弹出并自动消失

## 依赖模块

- `foundation.md` — 样式系统、状态管理、消息通信
- `perception.md` — 提取 Pipeline 对接

## 关联文件

- `detail.md` §3.1 Popup Shell、§3.6 CaptureView、§3.7 LibraryView、§3.8 ReaderView、§3.9 删除、§3.10 SettingsView、§3.11 Toast
- `detail.md` §5 组件设计、§6 样式设计规范
- `design.html` 全部四个 Tab UI 原型
