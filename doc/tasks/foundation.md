# 底座：Chrome Extension MV3 框架搭建 (Foundation)

## 目标
搭建 WXT + Vue 3 + TypeScript 的 Chrome Extension MV3 项目骨架，配置 manifest、权限、构建流程。

## 最小可执行任务

### 1. 项目初始化
- [ ] 安装 WXT：`npm create wxt@latest`（选择 Vue + TypeScript，参考 `obsidian-clipper` 的构建系统）
- [ ] 安装依赖：`vue`, `typescript`, `vite`（参考 `obsidian-clipper` 的 `package.json`）
- [ ] 配置 `wxt.config.ts`（参考 `manifest.chrome.json` 的权限配置）：
  - `modules: ['@wxt-dev/module-vue']`
  - `manifest.permissions: ['sidePanel', 'storage', 'activeTab']`
  - `manifest.side_panel.default_path`
- [ ] 验证构建：`npm run build` 生成 dist/（参考 `obsidian-clipper` 的构建脚本）

### 2. 目录结构初始化
- [ ] 创建 `entrypoints/background.ts`（Service Worker，参考 `obsidian-clipper` 的 `background.ts`）
- [ ] 创建 `entrypoints/content.ts`（Content Script，参考 `obsidian-clipper` 的 `content.ts`）
- [ ] 创建 `entrypoints/sidepanel/`（Side Panel，参考 `obsidian-clipper` 的 `side-panel.html`）
  - `index.html`, `main.ts`, `App.vue`
  - `pages/ChatPage.vue`, `pages/SearchPage.vue`, `pages/TimelinePage.vue`
- [ ] 创建 `entrypoints/options/`（Options 页面，参考 `obsidian-clipper` 的 `settings.html`）
  - `index.html`, `main.ts`, `App.vue`
  - `ModelSettings.vue`, `WebDAVSettings.vue`, `PromptSettings.vue`
- [ ] 创建 `components/`（共享组件，参考 `obsidian-clipper` 的组件结构）
- [ ] 创建 `core/`, `db/`, `workers/`, `shared/` 目录（参考 `obsidian-clipper` 的 `src/` 目录结构）

### 3. 样式系统搭建
- [ ] 安装 `UnoCSS` 并配置 `uno.config.ts`（参考 `obsidian-clipper` 的 SCSS 样式系统）
- [ ] 安装 `Reka UI`（无样式 UI 原语，参考 `obsidian-clipper` 的 UI 组件）
- [ ] 配置基础样式变量（颜色、间距、字体，参考 `styles/_variables.scss`）
- [ ] 创建 `styles/` 目录（SCSS，参考 `obsidian-clipper` 的 `styles/` 目录）
- [ ] 暗色/亮色模式支持（可选，参考 `styles/_reader-themes.scss`）

### 4. 状态管理
- [ ] 安装 `pinia` 和 `pinia-plugin-persistedstate`（参考 `obsidian-clipper` 的 `storage-utils.ts` 状态管理）
- [ ] 配置 `chrome.storage.local` 序列化器（参考 `storage-utils.ts` 的 `setLocalStorage` / `getLocalStorage`）
- [ ] 创建 Store（参考 `storage-utils.ts` 的 `generalSettings` 模式）：
  - `useDocumentStore`（当前文档、文档列表）
  - `useChatStore`（对话状态、消息列表）
  - `useSearchStore`（搜索结果、索引状态）
  - `useSyncStore`（同步状态、配置）
  - `useSettingsStore`（模型配置、WebDAV 配置）

### 5. 跨上下文通信封装
- [ ] 创建 `shared/messaging/messages.ts`（参考 `obsidian-clipper` 的 `types/types.ts` 接口定义风格）
  - 定义所有消息类型（`CAPTURE_PAGE`, `START_CHAT`, `SEARCH_QUERY`, `SYNC_UPLOAD`, `SYNC_DOWNLOAD`）
- [ ] 创建 `shared/messaging/runtime-client.ts`（参考 `obsidian-clipper` 的 `browser-polyfill.ts`）
  - 封装 `chrome.runtime.sendMessage` 和 `chrome.runtime.onMessage`
  - Promise 化 API（参考 `browser-polyfill.ts` 的封装方式）
  - 错误处理（超时、连接断开，参考 `background.ts` 的错误处理）

### 6. 图标与资源
- [ ] 准备图标：`icon-16.png`, `icon-48.png`, `icon-128.png`（参考 `obsidian-clipper` 的 `icons/` 目录）
- [ ] 配置 manifest 图标路径（参考 `manifest.chrome.json` 的 `icons` 字段）
- [ ] 悬浮按钮图标（SVG 或 PNG，参考 `icons/icons.ts` 的图标系统）

### 7. 开发工具配置
- [ ] 安装 `vitest` + `jsdom` 配置测试环境（参考 `obsidian-clipper` 的 `*.test.ts` 文件）
- [ ] 安装 `eslint` + `prettier` 配置代码规范（参考 `obsidian-clipper` 的代码风格）
- [ ] 配置 TypeScript 严格模式（参考 `obsidian-clipper` 的 `tsconfig.json`）
- [ ] 配置路径别名（`@/core/*`, `@/db/*`, `@/shared/*`，参考 `vite.config.ts`）

### 8. 构建与打包
- [ ] 配置 Chrome Web Store 打包脚本（参考 `obsidian-clipper` 的构建脚本）
- [ ] 生成 `.zip` 文件（manifest v3，参考 `manifest.chrome.json`）
- [ ] 验证 manifest 字段完整性（参考 `manifest.chrome.json` 的字段）

---

## 验收标准
- [ ] `npm run dev` 热更新正常（参考 `obsidian-clipper` 的开发模式）
- [ ] `npm run build` 无错误，生成可加载的扩展包（参考 `obsidian-clipper` 的构建流程）
- [ ] Side Panel 可正常打开（参考 `side-panel.html`）
- [ ] Content Script 在任意页面注入按钮（参考 `content.ts` 的按钮注入）
- [ ] Background Service Worker 正常唤醒（参考 `background.ts` 的生命周期）
- [ ] 跨上下文消息通信正常（参考 `browser-polyfill.ts`）

## 依赖模块
- 所有其他模块（基础框架，参考 `obsidian-clipper` 的 `src/` 目录结构）
