# 底座：项目框架搭建 (P0)

> **模块名称**: foundation  
> **优先级**: P0（MVP 前置依赖）  
> **依赖关系**: 无（所有模块的前置依赖）  
> **目标**: 搭建完整的 WXT + Vue 3 + TypeScript 浏览器插件项目骨架，提供开发、构建、调试的完整闭环

---

## 子任务

### WXT 项目初始化
- [ ] 安装 WXT CLI 并创建项目 `npm create wxt@latest SuperBrain -- --template vue-ts`
- [ ] 配置 `wxt.config.ts`：设置 manifest 版本、入口点、输出目录
- [ ] 配置 `package.json`：脚本命令（dev / build / lint / test / typecheck）

### 目录结构创建
- [ ] 创建 `entrypoints/` 子目录：`background.ts`、`content.ts`、`sidepanel/`（含 `index.html` + `main.ts`）、`options/`
- [ ] 创建 `core/` 目录：提取核心（extraction）、Markdown 生成（markdown）、元数据解析（metadata）
- [ ] 创建 `db/` 目录：IndexedDB 初始化、schema 定义、repository 接口
- [ ] 创建 `workers/` 目录：搜索 Worker、同步 Worker
- [ ] 创建 `shared/` 目录：domain types、消息类型定义、工具函数

### Manifest 配置
- [ ] 配置权限：`activeTab`、`scripting`、`storage`、`sidePanel`
- [ ] 配置 `host_permissions` 为 `optional_host_permissions: ["<all_urls>"]`（对齐 detail.md §11.2.4）
- [ ] 配置 `side_panel` 默认路径指向 `sidepanel/index.html`
- [ ] 配置 `action.default_title` 和图标资源
- [ ] 声明 `content_scripts` matches 策略

### 样式系统搭建
- [ ] 安装 UnoCSS：`@unocss/preset-uno`、`@unocss/preset-icons`
- [ ] 配置 `uno.config.ts`：颜色 tokens 对齐 detail.md §6.2（`--bg: #f6f6f4`、`--card: rgba(255,255,255,0.78)` 等）
- [ ] 配置尺寸 tokens：`--popup-width: 400px`、`--popup-height: 660px`（对齐 detail.md §6.1）
- [ ] 配置圆角 tokens：`--radius-card: 20px`、`--radius-button: 16px`、`--radius-shell: 32px`
- [ ] 安装 Reka UI 组件库
- [ ] 创建 `shared/styles/base.css`：全局 Reset、滚动条隐藏 `.no-scrollbar`

### 全局类型定义
- [ ] 定义 `SavedArticle` 接口（对齐 detail.md §3.5）：id / title / url / siteName / author / publishedAt / excerpt / markdown / contentHtml / contentText / faviconUrl / image / readingTime / createdAt / updatedAt
- [ ] 定义 `PageMetadata` 接口（对齐 detail.md §3.2）：title / url / siteName / author / publishedAt / description / faviconUrl / lang
- [ ] 定义 `ExtractResult` 接口（对齐 detail.md §3.3）
- [ ] 定义 `AppSettings` 接口（对齐 detail.md §3.10）：autoSave / showToast / includeFrontmatter / readerStyle
- [ ] 定义 `ToastState` 接口（对齐 detail.md §3.11）：type / title / description / duration
- [ ] 定义 `CaptureStep` 联合类型（对齐 detail.md §3.3）：`"idle" | "extracting" | "markdown" | "saving" | "success" | "error"`
- [ ] 定义 `AppErrorCode` 联合类型（对齐 detail.md §8.1）：9 种错误码

### 状态管理
- [ ] 安装 Pinia：`pinia` + `@pinia/plugin-debounce`
- [ ] 创建 `stores/popup.ts`：`activeView`、`activeArticleId`、`toast`、`modal` 状态
- [ ] 创建 `stores/capture.ts`：`page`、`draft`、`captureStep`、`error` 状态
- [ ] 创建 `stores/library.ts`：文章列表、搜索关键词、过滤器状态
- [ ] 创建 `stores/settings.ts`：设置读写，持久化到 `chrome.storage.sync`
- [ ] 实现 `chrome.storage.local` 序列化器（Pinia 持久化插件）

### 跨上下文通信封装
- [ ] 创建 `shared/messaging.ts`：统一消息类型定义（`MessageAction` 联合类型，对齐 detail.md §11.1.4）
- [ ] 实现 `sendMessageToBackground(action, payload?)` 封装
- [ ] 实现 `sendMessageToContentScript(tabId, action, payload?)` 封装
- [ ] 实现 Background 消息路由：根据 `action.type` 分发到对应 handler
- [ ] 在 Background 中维护 `ExtractProgress` 状态（对齐 detail.md §2.3 Popup 生命周期）

### 图标资源
- [ ] 生成 16x16 / 32x32 / 48x48 / 128x128 尺寸的扩展图标
- [ ] 配置 `wxt.config.ts` 中 `manifest.icons` 引用
- [ ] 配置 Lucide Icons 集成（通过 UnoCSS icons preset）

### 开发工具配置
- [ ] 配置 Vitest：`vitest.config.ts`，测试文件匹配 `**/*.test.ts`
- [ ] 配置 ESLint：`eslint.config.mjs`，TypeScript + Vue 规则
- [ ] 配置 Prettier：`.prettierrc`，统一格式化风格
- [ ] 配置 `tsconfig.json`：`paths` 别名（`@/` → `src/`）

### 构建与打包验证
- [ ] 执行 `npm run dev` 验证开发模式：WXT dev server 启动成功
- [ ] 执行 `npm run build` 验证生产构建：输出 `dist/` 目录，manifest.json 正确
- [ ] 在 Chrome `chrome://extensions` 中加载未打包扩展，验证 popup 可正常打开
- [ ] 验证 Content Script 注入成功（打开任意页面后 Background console 确认）
- [ ] 验证 Side Panel 可正常打开

---

## 验收标准

- [x] WXT 项目 `npm run dev` 和 `npm run build` 均无错误
- [x] Chrome 扩展可加载并正常打开 Popup 和 Side Panel
- [x] Content Script 可在普通网页中注入并响应 ping 消息
- [x] 全局 TypeScript 类型定义完整且无编译错误
- [x] UnoCSS 样式 tokens 在 Popup 中正确渲染
- [x] Pinia stores 可正常读写，设置持久化到 `chrome.storage.sync`

## 依赖模块

- 无

## 关联文件

- `detail.md` §2 架构分层、§5 组件设计目录结构、§6 样式设计规范、§7 浏览器插件约束
- `detail.md` §11.2.4 权限建议、§11.3.7 构建配置建议
- `design.html` 全局 UI 原型
