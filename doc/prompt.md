# PageMind — VibeCoding Master Prompt

> 本文件是 VibeCoding 自主编码的起始 Prompt。主 Agent 读取后按模块调度子 Agent 完成全部实现和测试，全程无人工参与。

---

## 一、项目概述

**PageMind** 是一个 Chrome Extension (MV3)，用于从任意网页提取正文、生成 Markdown、保存到本地 IndexedDB，并提供文章库浏览和阅读器功能。

- **UI 形态**：SidePanel（点击扩展图标打开侧边栏，非 Popup）
- **产品名**：PageMind
- **设计风格**：Linear 信息密度 + Apple 浅色玻璃感、圆角、柔和反馈

---

## 二、技术栈（已安装，禁止更改版本主号）

| 技术 | 版本 | 用途 |
|---|---|---|
| WXT | 0.20.x | Extension 框架（manifest、HMR、多浏览器构建） |
| Vue 3 | 3.5.x | UI 框架（Composition API + `<script setup>`） |
| Pinia | 3.0.x | 状态管理 |
| UnoCSS | 66.x | 原子化 CSS（utility-first） |
| Dexie | 4.4.x | IndexedDB 封装 |
| defuddle | 0.19.x | 网页正文提取 + Markdown 生成 |
| DOMPurify | 3.x | HTML 安全清理（XSS 防护） |
| marked | — | Markdown → HTML 渲染（ReaderView，需安装） |
| dayjs | 1.11.x | 日期格式化 |
| highlight.js | 11.x | 代码高亮（ReaderView） |

**package.json 中已有但本轮不使用的依赖**（忽略）：`@lucide/vue`, `eventsource-parser`, `lz-string`, `minisearch`, `pinia-plugin-persistedstate`, `reka-ui`

---

## 三、项目结构（目标）

```
entrypoints/
  background.ts              # Service Worker（消息路由）
  content.ts                 # Content Script（轻量：ping + 元数据 + defuddle 提取）
  sidepanel/
    index.html               # SidePanel HTML 入口
    main.ts                  # Vue createApp + Pinia + UnoCSS
    App.vue                  # 根组件（视图路由 + 全局状态）
    style.css                # 全局 reset + font + scrollbar

components/
  layout/
    TopBar.vue               # 顶部栏（品牌 + Local 状态 + 设置按钮）
    BottomNav.vue            # 底部导航（采集 / 文章库 / 阅读）
  common/
    ArticleItem.vue           # 文章列表项（已有）
    Favicon.vue               # 站点首字母图标（已有）
    SectionHead.vue           # 区域标题 + action link（已有）
    SourceInfo.vue            # favicon + siteName + url（已有）
    Toast.vue                 # Toast 通知（需重构为 composable 驱动）
    ConfirmModal.vue          # 删除确认弹窗（需接入真实删除）
    MarkdownRenderer.vue      # 【新增】Markdown 渲染组件（marked + DOMPurify）
  views/
    CaptureView.vue           # 采集页（当前页检测 + 提取 Pipeline + 最近保存）
    LibraryView.vue           # 文章库（搜索 + 列表 + 删除）
    ReaderView.vue            # 阅读器（元数据网格 + Markdown 渲染）
    SettingsView.vue          # 设置（开关 + 恢复默认）

composables/
  useToast.ts                # Toast 全局 composable

stores/
  article.store.ts           # Pinia 文章 store
  settings.store.ts          # Pinia 设置 store

db/
  index.ts                   # Dexie 实例（PageMindDB）
  article.repository.ts      # 文章 CRUD
  settings.repository.ts     # chrome.storage.sync 设置读写

domain/
  types.ts                   # Article, ExtractResult, PageMetadata, AppSettings, AppError, etc.
  index.ts                   # barrel export

messaging/
  types.ts                   # MessageAction 联合类型定义
  client.ts                  # Popup 端 Promise 化 sendMessage 封装

utils/
  shadow-dom.ts              # Shadow DOM 扁平化
  metadata-extractor.ts      # 页面元数据提取（og:*, JSON-LD, meta）
  markdown-renderer.ts       # marked + DOMPurify 渲染函数
  clipboard.ts               # 剪贴板复制（含回退策略）
```

---

## 四、参考代码（必须阅读后再实现）

以下文件是已验证的工程实现，子 Agent **必须先阅读对应参考文件**，然后基于其模式实现 PageMind 的对应模块。不要从零发明，要参考已有实现的 API 调用方式、错误处理模式和数据结构。

| PageMind 模块 | 参考文件（reference/obsidian-clipper/） | 参考要点 |
|---|---|---|
| content.ts 提取流程 | `src/content.ts` → `getPageContent` handler | defuddle 调用、Shadow DOM 处理、消息响应模式 |
| defuddle 调用 | `src/content.ts` | `new Defuddle(document, { url })`, `parseAsync()` + 超时回退 |
| Markdown 生成 | `src/content.ts` | `createMarkdownContent(content, url)` 调用方式 |
| Background 消息路由 | `src/background.ts` | `onMessage` listener、action dispatch、tab 操作 |
| Content Script 注入 | `src/background.ts` → `injectContentScript()` | ping 就绪检测、重试逻辑 |
| 元数据提取 | `src/utils/content-extractor.ts` | 提取结果结构、变量构建 |
| 存储模式 | `src/utils/storage-utils.ts` | chrome.storage API 使用方式 |
| 剪贴板复制 | `src/content.ts` → `copyMarkdownToClipboard` | Clipboard API + execCommand 回退 |

---

## 五、主 Agent 指令

你是主 Agent（Orchestrator）。你的职责：

### 5.1 启动流程

1. 读取 `doc/tasks/progress.md` 了解总体进度和里程碑
2. 按里程碑顺序，逐个模块调度子 Agent
3. 每个模块完成后，更新 `doc/tasks/progress.md` 中对应模块的 checkbox
4. 每个里程碑完成后，运行 `npm run compile`（vue-tsc）确认无类型错误

### 5.2 模块调度顺序

严格按以下顺序调度（前者是后者的依赖）：

```
Phase 1（基础层，无相互依赖，可并行）：
  1. domain        → doc/tasks/domain.md
  2. storage        → doc/tasks/storage.md

Phase 2（通信层，依赖 domain）：
  3. messaging      → doc/tasks/messaging.md

Phase 3（UI 壳，依赖 storage + messaging）：
  4. popup-shell    → doc/tasks/popup-shell.md

Phase 4（功能模块，依赖 popup-shell）：
  5. capture-view   → doc/tasks/capture-view.md
  6. library-view   → doc/tasks/library-view.md
  7. reader-view    → doc/tasks/reader-view.md
  8. delete         → doc/tasks/delete.md
  9. settings       → doc/tasks/settings.md
  10. toast         → doc/tasks/toast.md

Phase 5（Content Script，依赖 domain + messaging）：
  11. content-script → doc/tasks/content-script.md

Phase 6（集成验证）：
  12. 全链路测试
```

### 5.3 子 Agent 调度模板

每个模块，使用以下 prompt 模板调度子 Agent：

```
你是 PageMind 的实现子 Agent。

## 任务
实现 {module-name} 模块。

## 必读文件（按顺序）
1. doc/tasks/{module-name}.md — 本模块的任务清单和验收标准
2. doc/detail.md §{相关章节号} — 详细设计
3. {参考文件路径} — 已验证的参考实现（如有）

## 技术约束
- Vue 3 Composition API + `<script setup lang="ts">`
- UnoCSS utility-first（禁止手写 CSS class，除非 scoped style 中的 :deep()）
- Pinia store 管理全局状态
- 所有 async 操作统一 try/catch，错误转为 AppError
- 不引入新依赖（使用 package.json 中已有的）

## 要求
1. 阅读参考文件，理解其 API 调用模式和错误处理方式
2. 实现 doc/tasks/{module-name}.md 中的每一个 checkbox 任务
3. 每完成一个任务，勾选对应的 checkbox
4. 实现完成后运行 `npx vue-tsc --noEmit` 确认无类型错误
5. 如有测试要求，编写测试并运行 `npx vitest run`
6. 完成后报告：已完成的任务列表、遇到的问题、未完成的任务及原因

## 输出
完成后报告格式：
### 已完成
- [x] 任务1
- [x] 任务2
### 未完成（如有）
- [ ] 任务3 — 原因：xxx
### 类型检查
- vue-tsc: PASS / FAIL
### 测试
- vitest: PASS / FAIL
```

### 5.4 进度追踪

每个模块调度前和完成后，更新 `doc/tasks/progress.md`：

- 调度前：将模块状态从「⬜ 未开始」改为「🔄 进行中」
- 完成后：改为「✅ 已完成」
- 失败时：改为「❌ 失败」并记录原因

### 5.5 错误处理

- 子 Agent 报告类型检查失败 → 主 Agent 调度修复子 Agent（同一模块，prompt 中附带错误信息）
- 子 Agent 报告未完成任务 → 记录到 progress.md，继续下一个模块，Phase 6 统一处理
- 同一模块连续失败 3 次 → 跳过并记录，继续后续模块

### 5.6 Phase 6 集成验证

所有模块完成后：

1. 运行 `npm run compile` 确认全项目无类型错误
2. 运行 `npm run build` 确认构建成功
3. 检查 `dist/` 目录：manifest.json 中 permissions 是否正确
4. 检查 content script bundle 体积（应 < 50KB gzip）
5. 生成集成测试报告到 `doc/tasks/integration-report.md`

---

## 六、子 Agent 通用约定

所有子 Agent 必须遵守：

### 6.1 代码风格

```ts
// ✅ 正确
const articles = ref<Article[]>([])
const filtered = computed(() => articles.value.filter(...))

// ❌ 错误
let articles: Article[] = []  // 不用 let
```

- Vue 组件必须用 `<script setup lang="ts">`
- 导入路径用 `@/` 别名（`@/domain`, `@/stores/article.store`, `@/db/article.repository`）
- 不使用 `any` 类型（除非第三方 API 返回值确实无法确定类型）
- 错误处理统一使用 domain 中定义的 `AppError`

### 6.2 文件创建规范

- 新文件必须在目录存在时创建（先 `ls` 确认父目录）
- 修改现有文件前先 `Read` 完整内容
- 不删除现有功能代码，只替换或扩展

### 6.3 测试规范

- 测试文件放在同目录下，命名 `*.test.ts`
- 使用 Vitest（`import { describe, it, expect } from 'vitest'`）
- Mock 浏览器 API 用 `vi.fn()` 和 `vi.stubGlobal()`
- 每个测试独立，不依赖执行顺序

### 6.4 WXT 特定约定

- Content Script 用 `defineContentScript({ matches, main() {} })` 注册
- Background 用 `defineBackground(() => {})` 注册
- 使用 WXT 提供的 `browser` 全局对象（而非直接用 `chrome`），但 `chrome.sidePanel` 等 Chrome 专有 API 可直接用
- manifest 权限在 `wxt.config.ts` 的 `manifest` 字段中声明
- SidePanel 由 background.ts 中 `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` 控制

---

## 七、验收标准

全部完成后，项目应满足：

| 标准 | 验证方式 |
|---|---|
| `npm run compile` 无类型错误 | vue-tsc exit code 0 |
| `npm run build` 构建成功 | WXT build exit code 0 |
| SidePanel 打开后显示采集页 | 手动验证（或 e2e 测试） |
| 点击「提取正文并保存」3 秒内完成 | Content Script 真实提取 |
| 文章保存到 IndexedDB，刷新后仍在 | Dexie 读取验证 |
| 搜索标题/作者可过滤文章列表 | LibraryView 搜索测试 |
| Markdown 正确渲染（标题、列表、代码块） | ReaderView 渲染测试 |
| XSS payload 被 DOMPurify 清除 | 安全测试 |
| 设置切换后 chrome.storage.sync 中值已更新 | SettingsRepository 测试 |
| 删除文章后 IndexedDB 中记录已移除 | ArticleRepository 测试 |
| Content Script bundle < 50KB gzip | 构建产物体积检查 |

---

## 八、执行

开始执行。从 Phase 1 的 domain 和 storage 模块并行调度子 Agent。
