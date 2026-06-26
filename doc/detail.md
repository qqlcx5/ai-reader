下面是基于当前设计稿整理出的「浏览器插件详细设计文档 v0.1」。我会把不确定边界单独列为「待确认问题」，避免自行假设。

**详细设计文档**

- 产品形态：浏览器插件 Popup 内的轻量阅读采集工具
- 视觉风格：Linear 的信息密度与克制边框 + Apple 的浅色玻璃感、圆角、柔和反馈
- 核心闭环：检测当前页 → defuddle 提取正文 → `createMarkdownContent()` 生成 Markdown → IndexedDB 保存 → 文章库展示 → 阅读详情 → 删除
- 设计原则：Popup 负责高频操作，不承载复杂管理；模块独立，方便后续开发、测试和替换

---

## 1. 功能范围

### 1.1 已包含功能

| 模块 | 说明 |
|---|---|
| 当前页检测 | 识别当前 Tab 的标题、URL、站点名、作者、发布时间 |
| 网页提取 | 使用 `defuddle` 从当前页面 DOM 中提取正文 |
| Markdown 生成 | 调用 `createMarkdownContent()` 生成 Markdown 内容 |
| 本地存储 | 使用 IndexedDB 保存文章、Markdown、元数据 |
| 文章库 | 展示已保存文章，支持搜索 |
| 阅读器 | 展示文章元数据与 Markdown 内容 |
| 删除 | 支持删除文章，并有确认弹窗 |
| 复制 | 支持复制 Markdown |
| 设置 | 支持本地开关配置 |
| 反馈 | Toast、流程状态、空状态、错误状态 |

### 1.2 暂不包含功能

| 功能 | 原因 |
|---|---|
| AI 总结 | 当前核心目标是稳定采集与阅读闭环 |
| 云同步 | 需要确认账号体系、同步策略、冲突处理 |
| 标签系统 | 可后续扩展，不影响核心数据模型 |
| 全文高级搜索 | 第一阶段可先做本地简单关键词过滤 |
| 多端同步 | 依赖同步方案，暂不纳入当前版本 |
| 原文高亮回链 | 需要额外内容脚本和 DOM 定位策略 |

---

## 2. 整体架构

### 2.1 架构分层

```text
Browser Extension
├── Popup UI
│   ├── 采集页
│   ├── 文章库页
│   ├── 阅读页
│   └── 设置页
│
├── Background Service Worker
│   ├── Tab 查询
│   ├── 消息转发
│   ├── 权限管理
│   └── 跨上下文协调
│
├── Content Script
│   ├── 读取页面 DOM
│   ├── 获取页面元数据
│   └── 调用 defuddle 或返回 DOM 给处理层
│
├── Markdown Service
│   ├── 标准化提取结果
│   ├── 调用 createMarkdownContent()
│   └── 输出 Markdown 字符串
│
├── Storage Service
│   ├── IndexedDB 初始化
│   ├── 文章 CRUD
│   ├── 设置读写
│   └── 搜索查询
│
└── Shared Domain
    ├── Article 类型
    ├── ExtractResult 类型
    ├── AppSettings 类型
    └── 错误码定义
```

### 2.2 通信路径

```text
Popup 点击「提取正文并保存」
  ↓
Popup 向 Background 发送 EXTRACT_PAGE 消息
  ↓
Background 获取当前 activeTab，向 Content Script 发送提取请求
  ↓
Content Script：flattenShadowDom() → defuddle 提取 → createMarkdownContent()
  ↓
返回 { markdown, metadata, ... }（仅文本数据，不含原始 DOM）
  ↓
Popup 接收结果，设置状态为 markdown → saving
  ↓
Popup 调用 ArticleRepository.saveArticle() 写入 IndexedDB
  ↓
Popup 更新 UI 状态
```

通信 API 选择：

| 场景 | API | 理由 |
|---|---|---|
| 提取、保存、删除等操作 | `chrome.runtime.sendMessage` | 请求-响应模式，简单可靠 |
| Popup 与 Background 持续同步 | `chrome.runtime.connect`（Port） | 仅在需要 Background 主动推送进度时使用 |

所有异步消息监听器返回 `true`，保持消息通道开启以便异步 `sendResponse`。

### 2.3 Popup 生命周期注意点

浏览器插件 Popup 是短生命周期页面：

- 用户点击插件图标时创建
- Popup 失焦可能被销毁
- 不适合执行长时间任务
- 不适合保存临时核心状态
- 关键数据必须落到 IndexedDB 或 Background 管理

因此：

- UI 状态可以放 Popup 内存
- 文章数据必须放 IndexedDB
- 设置数据持久化到 `chrome.storage.sync`
- 提取和 Markdown 生成在 Content Script 中完成（不受 Popup 生命周期影响）
- Popup 仅负责 IndexedDB 写入（< 100ms），关闭中断风险极低
- 提取过程中 Background 维护进度状态，Popup 重新打开时可恢复

---

## 3. 模块划分

## 3.1 Popup Shell 模块

### 职责

负责插件弹窗的整体布局、导航切换和全局 UI 状态。

### UI 组成

```text
PopupShell
├── TopBar
│   ├── Brand
│   ├── Local 状态
│   └── 设置按钮
├── ViewContainer
│   ├── CaptureView
│   ├── LibraryView
│   ├── ReaderView
│   └── SettingsView
├── BottomNav
│   ├── 采集
│   ├── 文章库
│   └── 阅读
├── Toast
└── ConfirmModal
```

### 状态

```ts
type PopupView = "capture" | "library" | "reader" | "settings";

interface PopupState {
  activeView: PopupView;
  activeArticleId?: string;
  toast?: ToastState;
  modal?: ModalState;
}
```

### 独立性要求

- 不直接处理 IndexedDB 逻辑
- 不直接处理 defuddle 逻辑
- 只调用业务服务层接口
- 子页面之间不直接相互调用，通过状态管理或事件回调通信

---

## 3.2 当前页检测模块

### 职责

检测当前激活 Tab 是否可阅读，并获取基础元数据。

### 输入

```ts
interface DetectCurrentPageInput {
  tabId: number;
  url: string;
}
```

### 输出

```ts
interface PageMetadata {
  title: string;
  url: string;
  siteName?: string;
  author?: string;
  publishedAt?: string;
  description?: string;
  faviconUrl?: string;
  lang?: string;
}
```

### 元数据来源优先级

| 字段 | 优先级 |
|---|---|
| title | `og:title` → `twitter:title` → `document.title` |
| siteName | `og:site_name` → hostname |
| author | `article:author` → `meta[name=author]` → JSON-LD |
| publishedAt | `article:published_time` → JSON-LD → 页面时间标签 |
| description | `og:description` → `meta[name=description]` |
| favicon | `link[rel*=icon]` → 默认站点首字母 |

### UI 映射

| 数据 | 设计稿位置 |
|---|---|
| title | 当前页卡片主标题 |
| url | 当前页卡片 URL 行 |
| siteName | favicon 右侧站点名 |
| author | 元信息 chip |
| publishedAt | 元信息 chip |
| readingTime | 元信息 chip，可由正文长度估算 |

### 错误状态

| 场景 | UI 反馈 |
|---|---|
| 当前页不可访问 | 显示「当前页面不支持提取」 |
| Chrome 内置页面 | 显示「浏览器内部页面无法读取」 |
| 权限不足 | 显示「需要当前站点访问权限」 |
| 没有正文 | 允许保存元数据，但提示正文为空 |

---

## 3.3 网页提取模块

### 职责

调用 `defuddle` 对当前网页进行正文提取。

### 输入

```ts
interface ExtractPageInput {
  tabId: number;
  url: string;
}
```

### 输出

```ts
interface ExtractResult {
  title: string;
  url: string;
  siteName?: string;
  author?: string;
  publishedAt?: string;
  excerpt?: string;
  contentHtml?: string;
  contentText?: string;
  image?: string;
  readingTime?: number;
}
```

### 推荐执行位置

```text
Content Script
```

原因：

- 可直接访问当前页面 DOM
- 适合执行正文提取
- 避免把完整 HTML 传输给 Popup
- defuddle 在 Content Script 中可正常运行（obsidian-clipper 已在生产环境验证）
- 依赖 `DOMParser` 等标准 Web API，无需特殊 polyfill
- `createMarkdownContent()` 是 defuddle 子模块，在 Content Script 中直接调用

### Content Script 提取流程

```text
1. flattenShadowDom(document)          // Shadow DOM 扁平化
   ↓
2. new Defuddle(document, { url })     // 初始化提取器
   ↓
3. parseAsync() 带 8s 超时             // 异步提取正文
   超时回退到 parse()（同步）
   ↓
4. createMarkdownContent(content, url) // 生成 Markdown
   ↓
5. 返回 { markdown, ...metadata }     // 仅文本数据返回
```

Shadow DOM 处理说明：现代前端框架（Web Components、Lit、Shoelace 等）大量使用 Shadow DOM，不扁平化会导致 Shadow DOM 内的正文被完全忽略。

### Content Script 注入策略

```ts
// background.ts — Ping-based 就绪检测
async function injectContentScript(tabId: number) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  for (let i = 0; i < 8; i++) {
    try {
      await chrome.tabs.sendMessage(tabId, { action: "ping" });
      return; // ready
    } catch {
      await new Promise(r => setTimeout(r, 50));
    }
  }
  throw new Error("Content script not ready");
}
```

```ts
// content.ts — Generation Counter 解决僵尸脚本
// 扩展更新后旧版 Content Script 可能仍在页面中存活
window.__pageMindGeneration = (window.__pageMindGeneration ?? 0) + 1;
const myGeneration = window.__pageMindGeneration;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (window.__pageMindGeneration !== myGeneration) return; // 旧脚本静默退出
  // ... handle message
  return true; // 保持 sendResponse 通道开启
});
```

### Content Script Bundle 策略

```text
├── content.ts（轻量）：消息监听、DOM 读取、元数据提取、Shadow DOM 处理
├── defuddle + markdown（按需加载）：仅在收到 extract 消息时动态 import
└── 总注入体积目标：< 50KB（gzip 后）
```

如果 webpack 打包后 defuddle 部分过大（> 80KB gzip），改为按需注入：使用 `chrome.scripting.executeScript` 仅在用户点击提取时注入提取脚本。

### 流程状态

设计稿中的三步 Pipeline：

```text
1. 网页提取
2. Markdown
3. IndexedDB
```

对应状态：

```ts
type CaptureStep = "idle" | "extracting" | "markdown" | "saving" | "success" | "error";
```

### UI 状态映射

| 状态 | 主按钮文案 | Step 状态 |
|---|---|---|
| idle | 提取正文并保存 | 全部未激活 |
| extracting | 正在提取正文... | Step 1 active |
| markdown | 正在生成 Markdown... | Step 1 done，Step 2 active |
| saving | 正在写入 IndexedDB... | Step 1/2 done，Step 3 active |
| success | 已保存，打开阅读器 | 全部 done |
| error | 重试提取 | 出错 step 标红或提示 |

---

## 3.4 Markdown 生成模块

### 职责

把提取结果转换为结构化 Markdown。

### 核心函数

```ts
// 在 Content Script 中调用，与 defuddle 提取同处一个上下文
import { createMarkdownContent } from 'defuddle/full';

function generateMarkdown(contentHtml: string, url: string): string;
```

### 输入

```ts
interface CreateMarkdownInput {
  title: string;
  url: string;
  siteName?: string;
  author?: string;
  publishedAt?: string;
  contentHtml?: string;
  contentText?: string;
  excerpt?: string;
}
```

### 输出

```ts
type MarkdownContent = string;
```

### 执行位置

在 Content Script 中完成，与提取步骤同处一个上下文。理由：

1. `defuddle` 已在 Content Script 中，`createMarkdownContent` 是其子模块，无需额外 bundle
2. 减少跨上下文传输的数据量（仅传 Markdown 字符串，不传原始 HTML）
3. Popup 只负责 UI 展示，不处理内容转换

### 推荐 Markdown 结构

```md
---
title: "文章标题"
url: "https://example.com/article"
site: "站点名"
author: "作者"
publishedAt: "2025-02-18"
savedAt: "2025-02-20T10:30:00.000Z"
---

# 文章标题

> 摘要内容

正文 Markdown...
```

### 边界处理

| 场景 | 处理 |
|---|---|
| 无作者 | frontmatter 中省略或设为空 |
| 无发布时间 | 使用 `undefined`，不伪造发布时间 |
| HTML 转 Markdown 失败 | 回退到纯文本 Markdown |
| 标题为空 | 使用 hostname 或「Untitled」 |
| 图片处理 | 第一阶段保留远程图片链接，不下载 |

---

## 3.5 存储模块

### 职责

本地保存文章、读取文章、删除文章、搜索文章、保存设置。

### 存储架构：混合方案

采用混合存储方案，分离设置数据与文章数据：

| 数据类型 | 存储位置 | 理由 |
|---|---|---|
| 设置（AppSettings） | `chrome.storage.sync` | 小体量、跨上下文可达、未来可扩展跨设备同步 |
| 文章（SavedArticle） | IndexedDB | 大容量、支持索引和全文搜索、单篇可达数 MB |

对比方案：

| 方案 | 优点 | 缺点 |
|---|---|---|
| 纯 chrome.storage.local | API 简单，MV3 所有上下文可达 | 单条限 5MB，总量限 10MB，不适合大量文章 |
| 纯 IndexedDB | 不限容量和大小 | Service Worker 无法直接访问（需 polyfill） |
| **混合方案（采用）** | 设置可同步，文章不限量 | 需维护两套存储 API |

### Database 设计

```text
chrome.storage.sync:
├── pagemind_settings: AppSettings
└── pagemind_version: string    // schema migration 版本号

IndexedDB: PageMindDB
Version: 1
└── Object Store: articles
```

### articles Store

主键：

```ts
id: string
```

建议索引：

| 索引 | 用途 |
|---|---|
| url | 判断重复保存 |
| createdAt | 最近保存排序 |
| updatedAt | 更新排序 |
| siteName | 站点过滤 |
| title | 简单搜索辅助 |

### Article 数据结构

```ts
interface SavedArticle {
  id: string;
  title: string;
  url: string;
  siteName?: string;
  author?: string;
  publishedAt?: string;
  excerpt?: string;
  markdown: string;
  contentHtml?: string;
  contentText?: string;
  faviconUrl?: string;
  image?: string;
  readingTime?: number;
  createdAt: string;
  updatedAt: string;
}
```

### Settings 存储（chrome.storage.sync）

```ts
interface AppSettings {
  autoSave: boolean;
  showToast: boolean;
  includeFrontmatter: boolean;
  readerStyle: boolean;
}
```

通过 `chrome.storage.sync` 读写，所有上下文（Popup、Background、Content Script）均可直接访问，无需 polyfill。

### Storage Service 接口

```ts
// 文章存储（IndexedDB）
interface ArticleRepository {
  saveArticle(article: SavedArticle): Promise<SavedArticle>;
  getArticle(id: string): Promise<SavedArticle | undefined>;
  getArticleByUrl(url: string): Promise<SavedArticle | undefined>;
  listArticles(): Promise<SavedArticle[]>;
  searchArticles(keyword: string): Promise<SavedArticle[]>;
  deleteArticle(id: string): Promise<void>;
}

// 设置存储（chrome.storage.sync）
interface SettingsRepository {
  getSettings(): Promise<AppSettings>;
  updateSettings(partial: Partial<AppSettings>): Promise<AppSettings>;
  resetSettings(): Promise<AppSettings>;
}
```

### 重复保存策略

同一 URL 再次保存时：覆盖原文章，保留原 `createdAt`，更新 `updatedAt` 和内容。

理由：用户保存同一网页通常是希望获取最新版本，而非保留历史快照。后续如需版本历史，可在 Article 中增加 `versions[]` 字段扩展。

---

## 3.6 采集页模块 CaptureView

### 职责

展示当前网页状态，并触发提取、复制、预览。

### UI 结构

```text
CaptureView
├── CurrentPageCard
│   ├── Current Page 标题
│   ├── 重新检测
│   ├── favicon
│   ├── siteName
│   ├── url
│   ├── title
│   ├── description
│   └── metadata chips
│
├── CaptureActionPanel
│   ├── 主按钮：提取正文并保存
│   ├── 复制 Markdown
│   ├── 仅预览
│   └── ExtractPipeline
│
├── MarkdownPreviewCard
│   ├── 标题
│   ├── 摘要
│   └── Markdown 预览行
│
└── RecentSaves
    ├── 最近文章列表
    └── 全部文章入口
```

### 事件

| 用户动作 | 行为 |
|---|---|
| 点击重新检测 | 重新读取当前 Tab 元数据 |
| 点击提取正文并保存 | 执行完整 capture pipeline |
| 点击复制 Markdown | 如果已有提取结果则复制；否则先提取或提示 |
| 点击仅预览 | 提取但不保存，进入 ReaderView |
| 点击打开详情 | 打开当前文章阅读页 |
| 点击最近文章 | 打开对应文章阅读页 |
| 点击删除 | 弹出删除确认框 |

### 状态

```ts
interface CaptureViewState {
  page?: PageMetadata;
  draft?: ExtractResult;
  captureStep: CaptureStep;
  error?: CaptureError;
}
```

---

## 3.7 文章库模块 LibraryView

### 职责

展示本地文章，支持搜索、打开、删除。

### UI 结构

```text
LibraryView
├── SearchPanel
│   ├── Library 标题
│   ├── 清空搜索
│   ├── 搜索框
│   └── stats chips
│
└── ArticleListCard
    ├── ArticleListItem[]
    └── EmptyState
```

### 搜索范围

第一阶段推荐：

```text
title
siteName
author
url
excerpt
markdown
```

### 搜索方式

第一阶段：

```ts
string.includes(keyword)
```

后续可升级：

- IndexedDB 索引优化
- MiniSearch / FlexSearch
- Web Worker 搜索
- 分词搜索

### ArticleListItem 数据

```ts
interface ArticleListItemModel {
  id: string;
  title: string;
  siteName?: string;
  siteLetter?: string;
  createdAt: string;
}
```

### 用户动作

| 动作 | 行为 |
|---|---|
| 输入搜索词 | 实时过滤本地文章 |
| 点击清空搜索 | 清空关键词，恢复全部 |
| 点击文章 | 进入 ReaderView |
| 点击删除 | 弹出 ConfirmModal |
| 搜索无结果 | 显示 EmptyState |

---

## 3.8 阅读器模块 ReaderView

### 职责

展示文章详情、元数据和 Markdown 内容。

### UI 结构

```text
ReaderView
└── ReaderCard
    ├── 顶部操作区
    │   ├── 返回文章库
    │   ├── 复制
    │   └── 删除
    ├── 来源信息
    │   ├── favicon
    │   ├── siteName
    │   └── url
    ├── 文章标题
    ├── MetadataGrid
    │   ├── 作者
    │   ├── 发布时间
    │   ├── 站点
    │   └── 保存时间
    └── MarkdownRenderer
```

### Markdown 渲染

建议不要直接 `innerHTML` 渲染未经处理内容。

推荐方案：

```text
Markdown string
  ↓
Markdown parser
  ↓
sanitize HTML
  ↓
render
```

候选库：

- `marked`
- `markdown-it`
- `micromark`
- `sanitize-html`
- `DOMPurify`

### 安全要求

| 风险 | 处理 |
|---|---|
| XSS | Markdown 渲染后必须 sanitize |
| 外链 | 默认 `target="_blank"`，增加 `rel="noopener noreferrer"` |
| 图片 | 限制协议为 `https:` / `http:` / `data:` 待确认 |
| 脚本 | 禁止 `<script>`、事件属性、iframe |

### 用户动作

| 动作 | 行为 |
|---|---|
| 返回文章库 | 切换到 LibraryView |
| 复制 | 复制当前文章 Markdown |
| 删除 | 弹出 ConfirmModal |
| 滚动阅读 | ReaderView 内部滚动，不影响整体 Popup |

---

## 3.9 删除模块

### 职责

统一处理文章删除确认和删除后的状态更新。

### UI 结构

```text
ConfirmModal
├── 标题：删除这篇文章？
├── 描述：删除后会从本地文章库移除
├── 取消按钮
└── 确认删除按钮
```

### 删除流程

```text
用户点击删除
  ↓
设置 deleteTargetId
  ↓
打开 ConfirmModal
  ↓
用户确认
  ↓
StorageService.deleteArticle(id)
  ↓
刷新文章库 / 最近文章 / 阅读页
  ↓
Toast 提示
```

### 删除后导航策略

| 当前页面 | 删除目标 | 删除后行为 |
|---|---|---|
| LibraryView | 列表文章 | 留在文章库，刷新列表 |
| ReaderView | 当前文章 | 返回文章库 |
| CaptureView | 最近文章 | 留在采集页，刷新最近列表 |
| ReaderView | 非当前文章 | 留在当前阅读页 |

---

## 3.10 设置模块 SettingsView

### 职责

管理本地偏好配置。

### 设置项

| 设置 | 默认值 | 说明 |
|---|---:|---|
| autoSave | true | 提取成功后自动保存到 IndexedDB |
| showToast | true | 操作完成后显示 Toast |
| includeFrontmatter | true | Markdown 顶部写入元数据 |
| readerStyle | true | 使用高级阅读排版 |

### 接口

```ts
interface SettingsRepository {
  getSettings(): Promise<AppSettings>;
  updateSettings(partial: Partial<AppSettings>): Promise<AppSettings>;
  resetSettings(): Promise<AppSettings>;
}
```

### UI 行为

| 动作 | 行为 |
|---|---|
| 点击开关 | 本地更新设置 |
| 点击恢复默认 | 全部设置回到默认值 |
| 设置保存成功 | Toast 提示 |
| 设置保存失败 | Toast 错误提示并恢复 UI 状态 |

---

## 3.11 Toast 模块

### 职责

提供轻量反馈，不打断用户操作。

### 数据结构

```ts
interface ToastState {
  type: "success" | "error" | "info";
  title: string;
  description?: string;
  duration?: number;
}
```

### 使用场景

| 场景 | Toast |
|---|---|
| 保存成功 | 已保存到本地文章库 |
| 复制成功 | Markdown 已复制 |
| 删除成功 | 文章已删除 |
| 检测成功 | 页面检测完成 |
| 权限不足 | 需要当前站点访问权限 |
| 提取失败 | 正文提取失败，请重试 |
| IndexedDB 失败 | 本地存储不可用 |

---

## 4. 数据流设计

### 4.1 保存文章完整流程

```text
用户点击「提取正文并保存」
  ↓
CaptureView 设置状态 extracting
  ↓
ExtensionService.getActiveTab()
  ↓
ContentScript.extractReadableContent(tabId)
  ↓
返回 ExtractResult
  ↓
CaptureView 设置状态 markdown
  ↓
MarkdownService.createMarkdownContent(result)
  ↓
生成 Markdown
  ↓
CaptureView 设置状态 saving
  ↓
ArticleRepository.saveArticle(article)
  ↓
IndexedDB 写入成功
  ↓
更新 activeArticleId
  ↓
刷新 RecentSaves / Library
  ↓
Toast success
```

### 4.2 仅预览流程

```text
用户点击「仅预览」
  ↓
检测是否已有 draft
  ↓
如果没有，执行 extract + markdown
  ↓
生成临时 PreviewArticle
  ↓
不写入 IndexedDB
  ↓
切换 ReaderView
```

待确认点：

- 预览文章是否应该出现在文章库？
- 预览文章关闭后是否丢弃？
- 用户在预览页点击保存是否需要支持？

### 4.3 删除流程

```text
用户点击删除
  ↓
打开确认弹窗
  ↓
用户确认
  ↓
ArticleRepository.deleteArticle(id)
  ↓
刷新 UI
  ↓
Toast success
```

---

## 5. 组件设计

如果使用 Vue，推荐组件拆分如下：

```text
src/
├── popup/
│   ├── PopupApp.vue
│   ├── components/
│   │   ├── PopupTopBar.vue
│   │   ├── BottomNav.vue
│   │   ├── ToastHost.vue
│   │   ├── ConfirmModal.vue
│   │   ├── AppCard.vue
│   │   ├── IconButton.vue
│   │   └── ToggleSwitch.vue
│   ├── views/
│   │   ├── CaptureView.vue
│   │   ├── LibraryView.vue
│   │   ├── ReaderView.vue
│   │   └── SettingsView.vue
│   └── composables/
│       ├── useToast.ts
│       ├── useModal.ts
│       ├── useCurrentPage.ts
│       ├── useArticles.ts
│       └── useSettings.ts
│
├── extension/
│   ├── background.ts
│   ├── content.ts
│   └── messaging.ts
│
├── services/
│   ├── extraction.service.ts
│   ├── markdown.service.ts
│   ├── article.repository.ts
│   ├── settings.repository.ts
│   └── browser.service.ts
│
├── db/
│   ├── indexed-db.ts
│   └── schema.ts
│
├── domain/
│   ├── article.ts
│   ├── extraction.ts
│   ├── settings.ts
│   └── errors.ts
│
└── styles/
    ├── tokens.css
    ├── base.css
    └── popup.css
```

---

## 6. 样式设计规范

### 6.1 尺寸

```css
--popup-width: 400px;
--popup-height: 660px;
--radius-card: 20px;
--radius-button: 16px;
--radius-shell: 32px;
```

### 6.2 颜色

```css
--bg: #f6f6f4;
--card: rgba(255, 255, 255, 0.78);
--card-solid: #ffffff;
--text: #1d1d1f;
--muted: #6e6e73;
--subtle: #a1a1aa;
--line: rgba(29, 29, 31, 0.08);
--line-strong: rgba(29, 29, 31, 0.14);
--black: #111111;
--blue: #2563eb;
--green: #16a34a;
--red: #dc2626;
```

### 6.3 交互动效

| 元素 | 动效 |
|---|---|
| 按钮 hover | `translateY(-1px)` |
| 卡片 hover | 边框增强，背景变白 |
| Toast | `translateY + opacity` |
| Modal | backdrop blur |
| Pipeline | active / done 状态渐变 |
| 列表删除 | 先淡出，再移除 |

### 6.4 可访问性

| 项目 | 要求 |
|---|---|
| 按钮 | 必须有明确文本或 `aria-label` |
| 删除 | 必须二次确认 |
| 焦点 | 支持键盘 Tab |
| 对比度 | 文本与背景满足可读性 |
| 动画 | 不影响核心操作 |

---

## 7. 浏览器插件约束

### 7.1 Manifest V3 注意事项

真实插件中不能直接使用原型里的内联脚本和内联事件。

需要改成：

```text
popup.html
  ↓
引入打包后的 popup.js
  ↓
所有事件由 JS 绑定
```

### 7.2 CSP 限制

Chrome Extension 默认 CSP 较严格：

- 禁止内联 `<script>`
- 禁止 `eval`
- 第三方库需要本地打包
- 外部资源加载需要声明权限或避免使用

### 7.3 权限建议

初步可能需要：

```json
{
  "permissions": [
    "activeTab",
    "scripting",
    "storage"
  ],
  "host_permissions": [
    "<all_urls>"
  ]
}
```

待确认：

- 是否真的需要 `<all_urls>`
- 是否允许用户按站点授权
- 是否需要 `tabs` 权限读取 URL 和标题

---

## 8. 错误设计

### 8.1 错误码

```ts
type AppErrorCode =
  | "NO_ACTIVE_TAB"
  | "UNSUPPORTED_PAGE"
  | "PERMISSION_DENIED"
  | "CONTENT_SCRIPT_FAILED"
  | "EXTRACTION_FAILED"
  | "MARKDOWN_FAILED"
  | "INDEXEDDB_FAILED"
  | "CLIPBOARD_FAILED"
  | "UNKNOWN_ERROR";
```

### 8.2 错误展示

| 错误 | UI |
|---|---|
| 无 active tab | Toast：未找到当前页面 |
| 页面不支持 | CurrentPageCard 显示不可提取状态 |
| 权限不足 | Toast + 权限引导 |
| 提取失败 | Pipeline 停在 Step 1，按钮变为重试 |
| Markdown 失败 | Pipeline 停在 Step 2，允许重试 |
| 存储失败 | Pipeline 停在 Step 3，提示 IndexedDB 不可用 |
| 复制失败 | Toast：当前环境不允许复制 |

---

## 9. 测试设计

### 9.1 单元测试

| 模块 | 测试点 |
|---|---|
| metadata parser | title、author、publishedAt 的优先级 |
| markdown service | HTML 转 Markdown、frontmatter、空字段 |
| article repository | 增删查改、重复 URL、排序 |
| settings repository | 默认值、更新、重置 |
| markdown renderer | XSS 过滤、标题、列表、链接 |
| search | 标题、作者、站点、正文关键词 |

### 9.2 组件测试

| 组件 | 测试点 |
|---|---|
| CaptureView | 点击保存后状态流转 |
| ExtractPipeline | active/done/error 状态 |
| LibraryView | 搜索、空状态、点击文章 |
| ReaderView | 元数据展示、复制、删除 |
| ConfirmModal | 取消、确认、点击遮罩 |
| SettingsView | 开关切换、恢复默认 |

### 9.3 集成测试

| 流程 | 验证 |
|---|---|
| 保存当前网页 | IndexedDB 中有文章 |
| 保存后打开阅读器 | ReaderView 展示正确文章 |
| 搜索文章 | 返回匹配结果 |
| 删除文章 | IndexedDB 删除，UI 刷新 |
| 复制 Markdown | 剪贴板内容正确 |
| Popup 关闭再打开 | 文章仍存在 |

### 9.4 浏览器兼容测试

| 浏览器 | 重点 |
|---|---|
| Chrome | MV3、activeTab、IndexedDB |
| Edge | Popup 尺寸、权限表现 |
| Arc | 插件弹窗表现 |
| Firefox | 如果支持，需要单独确认 Manifest 差异 |

---

## 10. 开发里程碑

### Milestone 1：静态 UI 组件化

- 拆分 Popup Shell
- 拆分四个 View
- 拆分 Card、Button、Toast、Modal、Switch
- 完成设计稿还原

### Milestone 2：本地数据层

- IndexedDB 初始化
- ArticleRepository
- SettingsRepository
- Mock 数据替换为真实数据

### Milestone 3：插件通信

- Background Service Worker
- Content Script
- activeTab 获取
- 当前页元数据检测

### Milestone 4：正文提取与 Markdown

- 接入 defuddle
- 接入 `createMarkdownContent()`
- 完成保存 Pipeline
- 错误处理

### Milestone 5：交互完善

- 搜索
- 删除
- 复制
- 预览
- 设置保存
- Toast 与空状态

### Milestone 6：测试与打包

- 单元测试
- 组件测试
- 插件端到端测试
- Manifest V3 打包验证

---

## 11. 技术评审与架构建议

> 以下内容基于对设计稿（design.html）和本文档（detail.md）的技术评审，并参考 obsidian-clipper 项目（同为 MV3 浏览器插件，使用 defuddle 提取网页）的工程实践。

---

### 11.1 架构建议

#### 11.1.1 Content Script 执行位置：已验证可行

原文 3.3 节对 defuddle 在 Content Script 中能否正常运行存有疑虑。obsidian-clipper 已在生产环境中验证了这条路径：

- defuddle 在 Content Script 中正常运行，依赖 `DOMParser` 等标准 Web API，无需特殊 polyfill
- obsidian-clipper 使用 `new Defuddle(document, { url: document.URL }).parseAsync()` 调用，配合 8 秒超时，超时后回退到同步 `parse()`
- `createMarkdownContent(html, url)` 同样在 Content Script 中直接调用，返回 Markdown 字符串

**建议**：明确 Content Script 内完成「提取 + Markdown 生成」两步，仅将结果返回给 Popup，避免传输原始 DOM。

```ts
// content.ts
async function handleExtract(document: Document, url: string) {
  const defuddle = new Defuddle(document, { url });
  const result = await Promise.race([
    defuddle.parseAsync(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
  ]);
  // 超时回退同步解析
  const markdown = createMarkdownContent(result.content, url);
  return { ...result, markdown };
}
```

#### 11.1.2 Shadow DOM 处理

现代前端框架（Web Components、Lit、Shoelace 等）大量使用 Shadow DOM。obsidian-clipper 在调用 defuddle 前先执行 `flattenShadowDom(document)`，将 Shadow DOM 内容扁平化到主文档树。

**建议**：在 Content Script 提取流程中增加 Shadow DOM 扁平化步骤，否则 Shadow DOM 内的正文会被完全忽略。这是一个容易遗漏但影响面很广的问题。

```text
Content Script 提取流程（修订）：
  flattenShadowDom(document)   ← 新增
    ↓
  new Defuddle(document).parseAsync()
    ↓
  createMarkdownContent()
```

#### 11.1.3 Content Script 注入与生命周期管理

原文未涉及 Content Script 注入失败和僵尸脚本的处理。obsidian-clipper 有两个值得借鉴的模式：

**a) Ping-based 就绪检测**

Content Script 注入后，不使用固定延时，而是通过 `ping` 消息轮询确认就绪：

```ts
// background.ts
async function injectContentScript(tabId: number) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  for (let i = 0; i < 8; i++) {
    try {
      await chrome.tabs.sendMessage(tabId, { action: "ping" });
      return; // ready
    } catch {
      await new Promise(r => setTimeout(r, 50));
    }
  }
  throw new Error("Content script not ready");
}
```

**b) Generation Counter 解决僵尸脚本**

扩展更新后，旧版 Content Script 可能仍在页面中存活。obsidian-clipper 使用 `window.__generation` 计数器，旧脚本检测到新版本注入后自动让出消息监听权：

```ts
// content.ts
window.__pageMindGeneration = (window.__pageMindGeneration ?? 0) + 1;
const myGeneration = window.__pageMindGeneration;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (window.__pageMindGeneration !== myGeneration) return; // 旧脚本静默退出
  // ... handle message
});
```

#### 11.1.4 通信模式：建议 Message 为主 + Port 为辅

原文 2.2 节描述了通信路径，但未明确具体 API 模式。obsidian-clipper 使用两种模式：

| 模式 | API | 适用场景 |
|---|---|---|
| 一次性消息 | `chrome.runtime.sendMessage` | 提取、保存、删除等请求-响应操作 |
| Port 长连接 | `chrome.runtime.connect` | Popup 与 Background 的持续状态同步 |

**建议**：PageMind 以一次性消息为主（简化调试和测试），仅在需要 Background 主动推送状态到 Popup 时引入 Port（如提取进度更新）。

```ts
// messaging.ts — 统一消息定义
type MessageAction =
  | { type: "GET_ACTIVE_TAB" }
  | { type: "EXTRACT_PAGE"; tabId: number }
  | { type: "PING" }
  | { type: "COPY_MARKDOWN"; text: string };
```

#### 11.1.5 提取结果缓存（Memoization）

obsidian-clipper 对提取结果做了 5 秒 TTL 的记忆缓存，避免用户在「提取 → 复制 → 预览」等连续操作时重复执行全文提取。

**建议**：CaptureView 内维护提取缓存，键为 `tabId + url`，TTL 5 秒。用户点击「复制 Markdown」或「仅预览」时，优先使用缓存结果。

---

### 11.2 潜在冲突点

#### 11.2.1 IndexedDB 的跨上下文访问限制

原文设计将 IndexedDB 作为唯一存储方案。但 IndexedDB 存在以下约束：

| 问题 | 说明 |
|---|---|
| Service Worker 无 DOM | MV3 Background 是 Service Worker，无法直接访问 IndexedDB（需引入 `fake-indexeddb` polyfill，增加 bundle 体积） |
| Popup 生命周期 | Popup 关闭后 IndexedDB 连接会关闭，长写入可能被中断 |
| 存储上限 | IndexedDB 单域名配额约 60% 磁盘空间，但各浏览器实现不同；超过一定量级后读写性能下降 |

obsidian-clipper 选择 `chrome.storage.local`（单条限 5MB，总量限 10MB），原因是 MV3 所有上下文均可直接访问、无需额外 polyfill、API 更简单。

**建议方案**：

| 方案 | 适用场景 |
|---|---|
| **A: chrome.storage.local** | 文章数量 < 200 篇，单篇 Markdown < 50KB。API 简单，全上下文可达。但有单条 5MB 和总量 10MB 限制 |
| **B: IndexedDB（推荐）** | 不限文章数量和大小。但需处理 Service Worker 访问问题，可通过 Popup/Offscreen Document 侧操作 |
| **C: 混合方案** | 设置用 `chrome.storage.sync`（自动同步），文章用 IndexedDB（大容量） |

**推荐方案 C**：设置数据小且需要跨设备同步（未来），文章数据大且仅本地使用。obsidian-clipper 也是这个模式。

#### 11.2.2 Markdown 生成时机：Content Script vs Popup

原文 4.1 节流程中，Markdown 生成步骤标注为「Popup 或 Background 调用 `createMarkdownContent()`」。这存在歧义：

- 如果在 Content Script 中生成：返回数据量小（Markdown 字符串），但 Content Script 需要引入 defuddle 的 markdown 模块
- 如果在 Popup 中生成：需要传输 `contentHtml`（可能数百 KB），但 Popup 不需要额外依赖

obsidian-clipper 的做法：**在 Content Script 中完成提取 + Markdown 生成**，只返回 Markdown 字符串和元数据。

**建议**：统一在 Content Script 中完成，理由：
1. 减少跨上下文传输的数据量
2. `defuddle` 已经在 Content Script 中，`createMarkdownContent` 是其子模块，无需额外 bundle
3. Popup 只负责 UI 展示，不处理内容转换

#### 11.2.3 Popup 关闭中断问题

原文 2.3 节提到了 Popup 生命周期问题，但未给出具体解法。核心冲突：

- 提取过程（defuddle + Markdown 生成 + IndexedDB 写入）可能耗时 2-5 秒
- 用户可能在过程中点击其他区域导致 Popup 关闭
- Popup 关闭后，内存中的状态和未完成的 Promise 全部丢失

**建议**：

```text
策略拆分：
├── 提取（Content Script 中执行）→ 不受 Popup 生命周期影响
├── Markdown 生成（Content Script 中执行）→ 同上
├── IndexedDB 写入（Popup 中执行）→ 需要保护
│   └── 方案：先写入 chrome.storage.local 临时缓冲区（毫秒级）
│           再由 Background 异步迁移到 IndexedDB（可选，MVP 阶段直接在 Popup 中写即可）
└── 进度状态（Background 管理）→ Popup 重新打开时可恢复
```

MVP 阶段简化处理：将提取和 Markdown 生成移到 Content Script 完成，Popup 中仅做 IndexedDB 写入（< 100ms），关闭中断风险大幅降低。

#### 11.2.4 `<all_urls>` 权限的审核风险

原文 7.3 节标注了待确认项。Chrome Web Store 审核对 `<all_urls>` 权限的审批越来越严格。

**建议**：

```json
{
  "permissions": ["activeTab", "scripting", "storage"],
  "optional_host_permissions": ["<all_urls>"]
}
```

- 使用 `activeTab` + `scripting` 即可在用户点击插件图标后注入 Content Script 到当前页
- `optional_host_permissions` 仅在需要时请求（如自动检测功能）
- 避免一开始就声明 `<all_urls>`，降低审核被拒概率

obsidian-clipper 虽然使用了 `<all_urls>`，但其功能复杂度（高亮、Reader Mode 注入等）远高于 PageMind MVP。

#### 11.2.5 `tabs` 权限的隐式需求

原文提到「是否需要 `tabs` 权限读取 URL 和标题」。实际上：

- `activeTab` 权限 + `chrome.tabs.query({ active: true, currentWindow: true })` 可以在用户点击插件图标后获取当前 Tab 的 `url` 和 `title`
- 但如果需要在 Background 中监听 Tab 变化（如切换 Tab 时自动更新采集页信息），则需要 `tabs` 权限

**建议**：MVP 阶段不需要 `tabs` 权限。用户每次打开 Popup 时主动查询当前 Tab 即可。

---

### 11.3 技术优化方案

#### 11.3.1 依赖选型

基于 obsidian-clipper 的验证和 Chrome Extension 约束，推荐以下核心依赖：

| 功能 | 推荐 | 理由 |
|---|---|---|
| 网页提取 | `defuddle` | obsidian-clipper 已验证在 Content Script 中可用；自带 `createMarkdownContent()` |
| HTML 清理 | `dompurify` | obsidian-clipper 使用同一方案；MV3 CSP 兼容；体积小（~8KB gzip） |
| Markdown 渲染 | `marked` + `dompurify` | `marked` 体积小（~30KB），性能好，不依赖 Node API；配合 dompurify 做 XSS 过滤 |
| 浏览器 API | `webextension-polyfill` | 统一 Chrome/Firefox 的 Promise API；obsidian-clipper 核心依赖 |
| 跨浏览器构建 | webpack 多入口 | 参考 obsidian-clipper 的 webpack.config.js，通过 `env.BROWSER` 切换 manifest 和构建配置 |

**不推荐**：

| 不推荐 | 原因 |
|---|---|
| `markdown-it` | 功能丰富但体积大（~100KB），MVP 阶段 `marked` 足够 |
| `sanitize-html` | 依赖较多，DOMPurify 更轻量且专为浏览器环境设计 |
| `turndown` | 额外的 HTML→Markdown 转换库，defuddle 已内置此功能 |

#### 11.3.2 defuddle 使用细节

基于 obsidian-clipper 的实际使用，补充以下技术细节：

```ts
// defuddle 完整调用链
import Defuddle from 'defuddle';
import { createMarkdownContent } from 'defuddle/full';

// 1. Shadow DOM 扁平化
flattenShadowDom(document);

// 2. 提取（带超时保护）
const defuddle = new Defuddle(document, { url: document.URL });
let result;
try {
  result = await Promise.race([
    defuddle.parseAsync(),
    timeout(8000)
  ]);
} catch {
  result = defuddle.parse(); // 同步回退
}

// 3. 生成 Markdown
const markdown = createMarkdownContent(result.content, url);

// 4. 返回结构
return {
  title: result.title,
  content: result.content,       // HTML
  markdown,                       // Markdown
  author: result.author,
  description: result.description,
  domain: result.domain,
  favicon: result.favicon,
  image: result.image,
  published: result.published,
  wordCount: result.wordCount,
};
```

注意：defuddle 的 `parse()` 是同步方法，在大页面上可能阻塞 Content Script 执行。建议优先使用 `parseAsync()`，仅在超时时回退。

#### 11.3.3 搜索优化路径

原文 3.7 节的第一阶段搜索方案 `string.includes(keyword)` 在文章数量增长后会遇到性能瓶颈。

**建议的渐进式优化路径**：

```text
Phase 1（MVP）：
  - 全量加载文章元数据到内存（不含 markdown 正文）
  - 对 title + siteName + author + excerpt 做 string.includes()
  - 预计 < 5ms，即使 500 篇文章

Phase 2（文章 > 500 篇）：
  - 加载时只取 id + title + siteName + author + createdAt + excerpt
  - 搜索时按需加载 markdown（延迟加载）
  - 引入 Web Worker 做搜索，避免阻塞 Popup UI

Phase 3（文章 > 2000 篇）：
  - 引入 MiniSearch（~10KB gzip，纯前端全文搜索）
  - 支持分词、模糊匹配、权重排序
  - 索引在 Background 中构建，通过消息传递结果
```

MVP 阶段无需引入额外搜索库，但设计 `ArticleRepository` 接口时应预留 `searchArticles()` 的返回值可扩展性。

#### 11.3.4 剪贴板复制的多层回退

原文未详细说明复制策略。obsidian-clipper 实现了三层回退：

```ts
async function copyToClipboard(text: string): Promise<void> {
  // 1. 现代 Clipboard API（Popup 中可用，Content Script 中需 HTTPS）
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {}

  // 2. execCommand 回退
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    return;
  } catch {}

  // 3. Background 代为复制（通过 offscreen document 或 service worker）
  await chrome.runtime.sendMessage({ type: 'COPY_CLIPBOARD', text });
  throw new Error("clipboard-fallback-needed");
}
```

**建议**：Popup 中使用方案 1 即可（Popup 是扩展自己的页面，Clipboard API 可用）。但保留 `CLIPBOARD_FAILED` 错误码，给用户明确反馈。

#### 11.3.5 Content Script Bundle 体积控制

defuddle 本身是一个较重的库（包含 DOM 解析、规则引擎等）。在 Content Script 中引入 defuddle + createMarkdownContent 会增加注入到每个页面的 JS 体积。

**建议**：

```text
Content Script Bundle 策略：
├── content.ts（轻量）：消息监听、DOM 读取、元数据提取、Shadow DOM 处理
├── defuddle + markdown（按需加载）：仅在收到 extract 消息时动态 import
└── 总注入体积目标：< 50KB（gzip 后）
```

如果 webpack 打包后 defuddle 部分过大，可考虑：
- 使用 `chrome.scripting.executeScript` 按需注入提取脚本（仅在用户点击提取时注入）
- 将 defuddle 作为单独 chunk，在 Background 中协调注入时机

#### 11.3.6 Storage Key 设计

如采用 11.2.1 推荐的混合存储方案（chrome.storage.sync + IndexedDB），key 设计如下：

```ts
// chrome.storage.sync（设置，< 100KB）
{
  "pagemind_settings": AppSettings,
  "pagemind_version": string,  // 用于 schema migration
}

// IndexedDB: PageMindDB
// Object Store: articles
// 索引：url(unique), createdAt, updatedAt, siteName
```

#### 11.3.7 构建配置建议

参考 obsidian-clipper 的 webpack 配置，建议采用多入口打包：

```ts
// webpack.config.js
module.exports = {
  entry: {
    popup: './src/popup/main.ts',
    background: './src/background.ts',
    content: './src/content.ts',
  },
  output: {
    // 每个入口独立输出，避免把 Vue runtime 注入到 content script
  },
  // ...
};
```

**关键点**：Popup 使用 Vue，但 Content Script 不需要。打包时必须确保 Content Script 的 bundle 不包含 Vue 运行时，否则会无谓增加注入体积。

---

### 11.4 修订后的推荐依赖清单

```json
{
  "dependencies": {
    "defuddle": "^0.19.0",
    "dompurify": "^3.0.0",
    "marked": "^15.0.0",
    "webextension-polyfill": "^0.12.0",
    "vue": "^3.5.0"
  },
  "devDependencies": {
    "@types/webextension-polyfill": "...",
    "@types/dompurify": "...",
    "webpack": "^5.0.0",
    "ts-loader": "...",
    "css-loader": "...",
    "mini-css-extract-plugin": "...",
    "copy-webpack-plugin": "...",
    "vitest": "..."
  }
}
```

---

### 11.5 待确认问题汇总

以下是设计中仍需产品或技术决策的问题：

| # | 问题 | 影响范围 | 建议默认值 |
|---|---|---|---|
| 1 | 同一 URL 再次保存的策略 | 存储层、UI 反馈 | 覆盖更新，保留 `createdAt`，更新 `updatedAt` |
| 2 | 预览文章是否写入 IndexedDB | 采集页流程 | 不写入，预览关闭后丢弃；预览页提供「保存」按钮 |
| 3 | 是否需要 `<all_urls>` 权限 | Manifest、审核 | 不需要，`activeTab` + `scripting` 足够 MVP |
| 4 | 图片协议白名单 | Markdown 渲染安全 | 允许 `https:` 和 `data:`，禁止 `javascript:` 和 `file:` |
| 5 | IndexedDB vs chrome.storage | 存储架构 | 混合方案：设置用 storage.sync，文章用 IndexedDB |
| 6 | defuddle bundle 体积是否可接受 | Content Script 注入性能 | 先实测，超过 80KB gzip 则改为按需注入 |
| 7 | 提取中的长任务放置位置 | Popup 生命周期 | Content Script 完成提取 + Markdown，Popup 仅做存储写入 |

---

### 11.6 里程碑调整建议

基于以上技术评审，建议调整里程碑顺序：

```text
Milestone 1：静态 UI 组件化（不变）

Milestone 2：插件脚手架与通信 ← 提前到数据层之前
  - webpack 多入口配置
  - manifest.json（activeTab + scripting + storage）
  - Background Service Worker
  - Content Script 注入 + ping 就绪检测
  - 消息通道验证

Milestone 3：本地数据层
  - IndexedDB 初始化（仅 Popup 上下文）
  - chrome.storage.sync 设置读写
  - ArticleRepository / SettingsRepository

Milestone 4：正文提取与 Markdown
  - defuddle 接入（Content Script）
  - Shadow DOM 扁平化
  - createMarkdownContent() 在 Content Script 中调用
  - 完整 Pipeline：提取 → Markdown → 保存
  - 超时保护 + 错误回退

Milestone 5：交互完善（不变）

Milestone 6：测试与打包（不变）
```

理由：将插件脚手架提前，可以在 Milestone 3-4 中直接使用真实的消息通道和存储，避免 Milestone 2 存储层和 Milestone 3 通信层之间的集成风险。

---
