# SuperBrain VibeCoding Prompt

> **目标**：实现 SuperBrain 智能剪藏浏览器扩展的全部 8 个模块，从零搭建到可发布。  
> **执行环境**：Claude Code，Node 20+ / pnpm / WXT 0.19+  
> **架构模式**：1 个 Main Agent（编排+进度追踪）+ 8 个 Sub-Agent（逐模块实现+测试），全过程自动化编码→测试→修复循环，无人工介入。  
> **项目路径**：`/Users/another/Documents/OpenSource/SuperBrain/`

---

## 项目概览

SuperBrain 是一款 MV3 浏览器扩展（Chrome/Edge），定位为"智能剪藏 + AI 消化"工具。用户在任意网页点击扩展图标，即可一键提取正文为结构化 Markdown，存入本地 IndexedDB，并借助多模型 AI 对文章进行摘要、问答和知识提炼。

### 技术栈

| 维度 | 选型 | 说明 |
|------|------|------|
| 扩展框架 | WXT 0.19+ | 完整的 MV3 构建工具链 |
| UI 框架 | Vue 3.5 + TypeScript | Popup/Side Panel/Options |
| 样式 | UnoCSS + Reka UI | 原子化 CSS + 无样式原语组件 |
| 状态管理 | Pinia + PersistedState | chrome.storage.local 序列化器 |
| 本地数据库 | Dexie.js + IndexedDB | GB 级存储，万篇文章 |
| 设置存储 | chrome.storage.sync | 小体量，跨上下文可达 |
| 内容提取 | defuddle | 网页正文提取 + Markdown 生成 |
| Markdown 渲染 | marked + DOMPurify + highlight.js | 安全渲染 + 代码高亮 |
| 全文检索 | MiniSearch + Web Worker | 异步索引构建 |
| SSE 流式 | eventsource-parser | 解析 OpenAI 兼容流式响应 |
| 大字段压缩 | lz-string | contentHtml 字段压缩 |
| 备份压缩 | CompressionStream('gzip') | 原生 API，零依赖 |
| 加密 | Web Crypto API (AES-GCM) | API Key 本地加密 |
| WebDAV | npm:webdav | 远程同步 |
| 测试 | Vitest + jsdom | 单元 + 组件测试 |

### 视觉设计

- 尺寸：Popup 400px × 660px
- 风格：Linear 克制边框 + Apple 浅色玻璃感
- 颜色 tokens：`--bg: #f6f6f4` / `--card: rgba(255,255,255,0.78)` / `--text: #1d1d1f` / `--blue: #2563eb`
- 圆角：卡片 20px / 按钮 16px / Shell 32px
- 完整 UI 原型见 `doc/design.html`

---

## 架构总览

```
Browser Extension (WXT MV3)
├── entrypoints/
│   ├── background.ts          # Service Worker：消息路由、Tab 管理、同步调度
│   ├── content.ts             # Content Script：DOM 读取、正文提取、Markdown 生成
│   ├── sidepanel/             # Popup UI（Vue 3）
│   └── options/               # 完整设置页（LLM 配置）
│
├── core/                      # 核心业务逻辑
│   ├── extraction/            # Shadow DOM 扁平化、defuddle 适配
│   ├── markdown/              # Markdown 生成
│   ├── metadata/              # 元数据解析
│   ├── chat/                  # SSE 流式客户端、工作流 Prompt
│   ├── crypto/                # AES-GCM 加密
│   ├── models/                # LLM Provider 注册表
│   ├── search/                # MiniSearch 引擎
│   ├── sync/                  # 导出/导入/WebDAV
│   └── timeline/              # 时间轴聚合
│
├── db/                        # 数据层
│   ├── schema.ts              # IndexedDB Schema
│   ├── article.repository.ts  # 文章 CRUD
│   ├── chat.repository.ts     # 对话历史 CRUD
│   ├── model-config.repository.ts
│   └── settings.repository.ts
│
├── workers/                   # Web Workers
│   └── search.worker.ts       # MiniSearch 异步索引
│
├── shared/                    # 共享层
│   ├── domain/                # 类型定义
│   ├── messaging.ts           # 统一消息协议
│   └── styles/base.css        # 全局样式
│
└── stores/                    # Pinia Stores
    ├── popup.ts
    ├── capture.ts
    ├── library.ts
    └── settings.ts
```

---

## Main Agent 职责

Main Agent 是项目的总调度者，**不直接写实现代码**，职责如下：

### 1. 环境就绪检查
- 确认 Node.js ≥ 20、pnpm 可用
- 确认项目根目录在 `/Users/another/Documents/OpenSource/SuperBrain/`
- 执行 `pnpm install` 安装所有依赖

### 2. 逐模块派发 Sub-Agent
按依赖顺序逐个派发 Sub-Agent 实现模块：

```
Phase 1 (P0 MVP):
  foundation → perception → popup-ui → model-management → chat-with-doc

Phase 2 (P1 功能完整):
  persistence → search

Phase 3 (P2 体验优化):
  timeline
```

每个 Sub-Agent 完成后，Main Agent 必须：
- 运行 `pnpm run typecheck`（vue-tsc 或 tsc --noEmit）确认无类型错误
- 运行 `pnpm run test` 确认全部已有测试通过
- 运行 `pnpm run build` 确认构建成功
- 仅在全部通过后，在 `doc/tasks/progress.md` 中将对应模块标记为 `[x] 已完成`

### 3. 全量最终验证
全部 8 个模块完成后，执行最终验证：
- `pnpm run typecheck` — 零类型错误
- `pnpm run test` — 全部测试通过
- `pnpm run build` — 产出完整 dist/ 目录，manifest.json 正确
- 若任一失败，定位失败模块，将 Sub-Agent 派发给对应模块修复（带 `inherit_agent_id` 继承该模块的对话上下文继续修复）

### 4. 不可信任 Sub-Agent 的 self-report
Sub-Agent 报告"已完成"不代表真正完成，Main Agent 必须亲自运行验证命令。

---

## 参考实现：obsidian-clipper 关键模式

以下模式来自 obsidian-clipper（同为 MV3 + defuddle 的浏览器扩展，已在 Chrome Web Store 上线），须在所有相关模块中复用。

### Content Script 注入与就绪检测

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

### Generation Counter 防止僵尸脚本

```ts
// content.ts — 扩展更新后旧版 Content Script 静默退出
window.__pageMindGeneration = (window.__pageMindGeneration ?? 0) + 1;
const myGeneration = window.__pageMindGeneration;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (window.__pageMindGeneration !== myGeneration) return; // 旧脚本静默退出
  // ... handle message
  return true; // 保持 sendResponse 通道开启
});
```

### Shadow DOM 扁平化

```ts
// 在 defuddle 提取前，递归遍历 Shadow DOM 边界
function flattenShadowDom(root: Document | Element): void {
  root.querySelectorAll('*').forEach(el => {
    if (el.shadowRoot) {
      // 将 shadow content 移动到主文档树
      while (el.shadowRoot.firstChild) {
        el.appendChild(el.shadowRoot.firstChild);
      }
      flattenShadowDom(el); // 递归处理嵌套
    }
  });
}
```

### defuddle 提取（带超时回退）

```ts
import Defuddle from 'defuddle';
import { createMarkdownContent } from 'defuddle/full';

async function extractPage(document: Document, url: string) {
  flattenShadowDom(document);

  const defuddle = new Defuddle(document, { url });
  let result;
  try {
    result = await Promise.race([
      defuddle.parseAsync(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
    ]);
  } catch {
    result = defuddle.parse(); // 同步回退
  }

  const markdown = createMarkdownContent(result.content, url);
  return { ...result, markdown };
}
```

### 通信封装

```ts
// shared/messaging.ts — 统一消息协议
type MessageAction =
  | { type: "PING" }
  | { type: "GET_ACTIVE_TAB" }
  | { type: "EXTRACT_PAGE"; tabId: number }
  | { type: "CAPTURE_PROGRESS"; step: CaptureStep }
  | { type: "COPY_CLIPBOARD"; text: string };

// 所有异步监听器必须 return true 以保持 sendResponse 通道
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg).then(sendResponse);
  return true;
});
```

### 提取结果缓存（TTL 5s）

```ts
const extractCache = new Map<string, { result: ExtractResult; timestamp: number }>();

function getCached(key: string): ExtractResult | null {
  const cached = extractCache.get(key);
  if (cached && Date.now() - cached.timestamp < 5000) return cached.result;
  extractCache.delete(key);
  return null;
}
```

### 剪贴板三层回退

```ts
async function copyToClipboard(text: string): Promise<void> {
  try { await navigator.clipboard.writeText(text); return; } catch {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    return;
  } catch {}
  throw new Error("CLIPBOARD_FAILED");
}
```

---

## Sub-Agent 定义

每个 Sub-Agent 必须遵循以下执行流程：
1. **读取输入**：阅读本 Prompt 中的模块任务 + 关联设计文档
2. **实现代码**：按子任务清单逐项实现
3. **编写测试**：为每个核心模块编写单元/集成测试（Vitest + jsdom）
4. **运行测试**：`pnpm run test` 确认测试通过
5. **验收检查**：逐项勾对验收标准
6. **报告完成**：返回"模块 X 已完成"信号给 Main Agent

---

### Sub-Agent 1: foundation（底座：项目框架搭建）

**优先级**：P0（所有模块的前置依赖）  
**依赖**：无

#### 任务清单

- [ ] 使用 WXT CLI 创建项目：`pnpm create wxt@latest . --template vue-ts`（在项目根目录执行）
- [ ] 创建目录结构：
  ```
  entrypoints/background.ts, content.ts, sidepanel/(index.html+main.ts), options/(index.html+main.ts)
  core/extraction/, core/markdown/, core/metadata/, core/chat/, core/crypto/, core/models/, core/search/, core/sync/, core/timeline/
  db/schema.ts, db/article.repository.ts, db/chat.repository.ts, db/model-config.repository.ts, db/settings.repository.ts
  workers/search.worker.ts
  shared/domain/, shared/messaging.ts, shared/styles/base.css
  stores/popup.ts, stores/capture.ts, stores/library.ts, stores/settings.ts
  ```
- [ ] 配置 `wxt.config.ts`：manifest 权限 `activeTab` + `scripting` + `storage`，`optional_host_permissions: ["<all_urls>"]`，side_panel 默认路径
- [ ] 安装所有依赖：
  ```
  pnpm add vue@^3.5 defuddle dompurify marked@^15 eventsource-parser dexie minisearch lz-string dayjs
  pnpm add -D @wxt-dev/unocss unocss @unocss/preset-uno @unocss/preset-icons @types/dompurify vitest jsdom @vue/test-utils
  ```
- [ ] 安装 Reka UI（按官方文档安装 core + 所需组件）
- [ ] 配置 `uno.config.ts`：颜色 tokens、尺寸 tokens、圆角 tokens（对齐 design.html 和 detail.md §6）
- [ ] 创建 `shared/styles/base.css`：全局 Reset、`.no-scrollbar` 滚动条隐藏
- [ ] 定义全部 TypeScript 接口：
  - `SavedArticle`（id / title / url / siteName / author / publishedAt / excerpt / markdown / contentHtml / contentText / faviconUrl / image / readingTime / createdAt / updatedAt）
  - `PageMetadata`（title / url / siteName / author / publishedAt / description / faviconUrl / lang）
  - `ExtractResult`（title / url / siteName / author / publishedAt / excerpt / contentHtml / contentText / image / readingTime）
  - `AppSettings`（autoSave / showToast / includeFrontmatter / readerStyle）
  - `ToastState`（type / title / description / duration）
  - `CaptureStep` = `"idle" | "extracting" | "markdown" | "saving" | "success" | "error"`
  - `AppErrorCode` = 9 种错误码
  - `MessageAction` 消息联合类型
- [ ] 实现 `shared/messaging.ts`：`sendMessageToBackground()` / `sendMessageToContentScript()` 封装
- [ ] 实现 Background 消息路由框架（根据 `action.type` 分发）
- [ ] 创建 Pinia stores 骨架（popup / capture / library / settings）
- [ ] 实现 `chrome.storage.local` 序列化器（Pinia 持久化插件）
- [ ] 配置 Vitest（`vitest.config.ts`，jsdom 环境）
- [ ] 配置 ESLint + Prettier
- [ ] 验证 `pnpm run dev` 启动成功
- [ ] 验证 `pnpm run build` 构建成功，产出 `dist/` 目录
- [ ] 验证在 Chrome `chrome://extensions` 中加载未打包扩展，Popup 可正常打开

#### 验收标准
- [ ] WXT 项目 dev/build 均无错误
- [ ] Chrome 扩展可加载，Popup 和 Side Panel 可打开
- [ ] Content Script 可注入并响应 ping 消息
- [ ] 全局 TypeScript 类型定义完整无编译错误
- [ ] UnoCSS 样式 tokens 在 Popup 中正确渲染

#### 参考文档
- `doc/README.md` — 总体架构
- `doc/detail.md` §2 架构分层、§5 组件设计、§6 样式设计、§7 插件约束、§11.1-11.3
- `doc/unocs.md` — WXT + UnoCSS 配置
- `doc/design.html` — UI 原型

---

### Sub-Agent 2: perception（捕获层：网页提取与 Markdown 生成）

**优先级**：P0  
**依赖**：foundation（消息通信框架）

#### 任务清单

- [ ] 创建 `entrypoints/content.ts`：注册 `chrome.runtime.onMessage` 监听
- [ ] 实现 `ping` 消息响应
- [ ] 实现 Generation Counter 僵尸脚本处理（`window.__pageMindGeneration`）
- [ ] 实现消息分发：根据 `action` 路由到 `handleExtract` / `handleMetadata`
- [ ] 创建 `core/extraction/shadow-dom.ts`：实现 `flattenShadowDom()` 递归扁平化
- [ ] 创建 `core/extraction/defuddle-adapter.ts`：实现 `extractContent()` — `parseAsync()` + 8s 超时 + `parse()` 同步回退
- [ ] 创建 `core/markdown/markdown-generator.ts`：调用 `createMarkdownContent()` 生成 Markdown，含 Frontmatter
- [ ] 创建 `core/metadata/metadata-parser.ts`：实现 `extractPageMetadata()` — title/author/publishedAt/description 优先级链
- [ ] 实现提取结果标准化：`normalizeResult()` → `CapturedDocument`，生成 UUID v4 + createdAt/updatedAt
- [ ] 定义 `CaptureStep` 状态机：`idle → extracting → markdown → saving → success/error`
- [ ] Background 中实现 `runCapturePipeline(tabId, url)`：协调全流程
- [ ] Background 通过 Port 向 Popup 推送 Pipeline 进度
- [ ] 定义提取相关消息类型：`EXTRACT_PAGE` / `GET_PAGE_METADATA` / `CAPTURE_PROGRESS`
- [ ] 实现提取结果缓存（Map，key=`tabId+url`，TTL=5s）
- [ ] Content Script Bundle 体积控制：defuddle 动态 `import()`，仅收到 extract 消息时加载
- [ ] 定义 9 种错误码对应的 Error 类和 UI 状态映射
- [ ] 编写单元测试：Shadow DOM 扁平化、元数据解析优先级、defuddle 超时回退、Markdown 生成

#### 验收标准
- [ ] 任意普通网页点击「提取正文并保存」可成功返回 Markdown
- [ ] Shadow DOM 内正文不被遗漏
- [ ] 8s 超时后自动回退同步提取
- [ ] 提取结果缓存 5 秒有效，点击复制不重复提取
- [ ] Content Script bundle gzip < 50KB
- [ ] 错误场景均有明确 UI 反馈

#### 参考文档
- `doc/detail.md` §3.2-3.4、§11.1、§11.2.2、§11.3.1-11.3.5

---

### Sub-Agent 3: popup-ui（弹窗 UI 层：Popup Shell 与四大视图）

**优先级**：P0  
**依赖**：foundation（样式系统+状态管理）、perception（提取 Pipeline 对接）

#### 任务清单

**Popup Shell**
- [ ] 创建 `entrypoints/sidepanel/index.html` + `main.ts`
- [ ] 创建 `PopupApp.vue`：三区布局（TopBar + ViewContainer + BottomNav）
- [ ] 实现 `PopupTopBar.vue`：Brand Logo + 同步状态指示 + 设置按钮
- [ ] 实现 `BottomNav.vue`：4 个 Tab 切换按钮组
- [ ] Tab 切换逻辑：`activeView` 状态驱动动态组件切换
- [ ] 配置 Popup 尺寸：400px × 660px

**全局 UI 组件**
- [ ] `AppCard.vue`：通用卡片（圆角 20px，hover 边框增强）
- [ ] `IconButton.vue`：带 `aria-label` 的图标按钮
- [ ] `ToggleSwitch.vue`：设置页开关
- [ ] `ToastHost.vue` + `useToast()` composable
- [ ] `ConfirmModal.vue`：删除确认弹窗（backdrop blur + 点击遮罩关闭）
- [ ] `useModal()` composable

**CaptureView 采集页**
- [ ] `CurrentPageCard.vue`：favicon + siteName + title 编辑 + author/publishedAt 编辑 + description + SEO Keywords tags +「重新检测」按钮
- [ ] `CaptureActionPanel.vue`：「提取正文并保存」主按钮（文案随 captureStep 变化）+「复制 Markdown」+「仅预览」
- [ ] `ExtractPipeline.vue`：三步进度指示器（active/done/error 三种状态）
- [ ] `MarkdownPreviewCard.vue`：深色背景 Markdown 预览
- [ ] `RecentSaves.vue`：最近 5 篇文章列表
- [ ] `useCurrentPage` / `useCapture` composables

**LibraryView 文章库**
- [ ] `SearchPanel.vue`：搜索框（防抖 200ms）+ 标签过滤器 chips + 统计 chip
- [ ] `ArticleListCard.vue`：时间轴分组（今天/昨天/上周/更早）+ 文章卡片（favicon + siteName + title + excerpt + tags + 标记 + 时间）
- [ ] 点击文章 → 切换到 ReaderView，长按/右键 → 删除按钮
- [ ] `EmptyState.vue`：无文章/搜索无结果两种状态
- [ ] `useArticles` composable

**ReaderView 阅读器**
- [ ] 顶部操作区：返回 + 复制 + 删除按钮
- [ ] `MetadataGrid.vue`：元数据网格（两列布局）
- [ ] `MarkdownRenderer.vue`：marked 解析 + DOMPurify XSS 过滤 + 外链 `target="_blank" rel="noopener noreferrer"` + 图片协议白名单（https:/http:/data:，禁止 javascript:/file:）+ 禁止 script/事件属性/iframe
- [ ] Frontmatter 预览（深色终端风格）
- [ ] 阅读器内部滚动
- [ ]「导出 Obsidian Markdown」按钮

**SettingsView 设置**
- [ ] 4 个开关设置项：autoSave / showToast / includeFrontmatter / readerStyle
- [ ]「恢复默认」按钮 + 确认
- [ ] 设置变更即时写入 `chrome.storage.sync`
- [ ] `useSettings` composable

**Delete 删除模块**
- [ ] 统一删除流程：设置 deleteTargetId → ConfirmModal → StorageService.deleteArticle → 刷新 UI → Toast
- [ ] 删除后导航策略表（4 种场景）

**Toast 通知模块**
- [ ] `showSuccess` / `showError` / `showInfo`
- [ ] 动画：`translateY + opacity` 过渡
- [ ] 自动消失：默认 3000ms
- [ ] 注册全部使用场景：保存/复制/删除成功，检测成功/权限不足/提取失败/存储失败

**设计规范**
- [ ] CSS tokens 从 UnoCSS 配置读取
- [ ] 按钮 hover：`translateY(-1px)`
- [ ] 卡片 hover：边框增强 + 背景变白
- [ ] Modal backdrop blur
- [ ] Pipeline 状态渐变
- [ ] 列表删除淡出
- [ ] 所有按钮 `aria-label`
- [ ] 无内联脚本（MV3 CSP）
- [ ] 编写组件测试：CaptureView 状态流转、Pipeline 状态、LibraryView 搜索/空状态、ReaderView 渲染/复制/删除、ConfirmModal 取消/确认、SettingsView 开关切换

#### 验收标准
- [ ] Popup 四 Tab 切换流畅，UI 还原度 > 90%（对照 design.html）
- [ ] CaptureView：完整 Pipeline 三步骤可视化
- [ ] LibraryView：搜索实时过滤、时间轴分组、空状态正确
- [ ] ReaderView：Markdown 渲染安全（XSS 过滤）、元数据完整
- [ ] SettingsView：开关即时生效并持久化
- [ ] 删除有确认弹窗，删除后导航逻辑正确
- [ ] Toast 通知正确弹出并自动消失

#### 参考文档
- `doc/detail.md` §3.1、§3.6-3.11、§5、§6
- `doc/design.html` — 全部四个 Tab UI 原型

---

### Sub-Agent 4: model-management（处理层：多模型配置管理）

**优先级**：P0  
**依赖**：foundation（chrome.storage 封装）

#### 任务清单

- [ ] 定义 `ModelProvider` / `ModelConfig` 接口：OpenAI 兼容格式（baseUrl + apiKey + modelName）
- [ ] 创建默认 Provider 配置：DeepSeek / Claude / GPT-4o / Ollama Local
- [ ] 创建 `core/models/provider-registry.ts`：Provider CRUD
- [ ] 创建 `core/crypto/aes-gcm.ts`：AES-GCM 加密/解密 + PBKDF2 密钥派生
- [ ] 实现 `encryptApiKey` / `decryptApiKey` / `deriveKey`
- [ ] 创建 `core/models/api-key-store.ts`：API Key 存 `chrome.storage.local`（不存 sync）
- [ ] 创建 `db/model-config.repository.ts`：Provider 配置存 `chrome.storage.sync`（不含 API Key）
- [ ] 创建 `entrypoints/options/index.html` + `main.ts`
- [ ] 实现 `OptionsView.vue`：API Endpoint 输入框 / API Key 密码输入框（带显示/隐藏切换）/ AES-GCM 状态指示 /「测试连接」按钮 / Provider 下拉框 /「添加自定义 Provider」
- [ ] 在 Popup SettingsView 中显示当前模型配置摘要（Provider 名称 + 连接状态）
- [ ] 实现「打开完整设置」→ `chrome.runtime.openOptionsPage()`
- [ ] 安全措施：`<input type="password">` / 内存 key 使用后置 null / 禁止 console.log API Key / Options 页关闭时清除缓存
- [ ] 编写单元测试：AES-GCM 加解密、API Key 存储/读取/删除

#### 验收标准
- [ ] 支持 4 种 Provider + 自定义
- [ ] API Key 经 AES-GCM 加密后存储
- [ ] API Key 明文不泄露
- [ ] Options 页面 UI 对齐 design.html LLM 配置区
- [ ]「测试连接」可验证 API 连通性

#### 参考文档
- `doc/detail.md` §4.3 AES-GCM 本地加密
- `doc/design.html` Tab 4 LLM 配置区

---

### Sub-Agent 5: chat-with-doc（处理层：沉浸式侧边栏对话）

**优先级**：P0  
**依赖**：foundation、model-management（LLM 配置）、perception（文章正文）

#### 任务清单

**Chat UI**
- [ ] 创建 `views/ChatView.vue`：AI 消化 Tab 视图容器
- [ ] 多模型调度器下拉框：模型选择 + 工作流选择（TL;DR 摘要 / 核心知识榨汁机 / 提炼 Action Items / 生成分类 Tags）
- [ ] 流式响应视窗：缺省占位 + 动态生成区域 + 打字机光标动画 `.cursor-blink` + AI 状态指示器
- [ ] 连续追问输入框：文本输入 + 发送按钮 +「清除上下文」+ 对话历史（用户蓝色气泡右对齐，AI 灰色气泡左对齐）
- [ ] 操作功能键区：「一键运行 AI 分析」渐变主按钮 +「停止生成」+「复制总结」

**SSE 流式通信**
- [ ] 创建 `core/chat/sse-client.ts`：`streamChatCompletion()` 返回 `AsyncGenerator<string>`
- [ ] 解析 OpenAI 兼容格式 SSE（`data: {"choices":[{"delta":{"content":"..."}}]}`）
- [ ] 集成 `eventsource-parser`
- [ ] `fetch` + `ReadableStream` 处理（MV3 Service Worker 兼容）
- [ ] 错误重试：最多 3 次
- [ ]「停止生成」：AbortController

**工作流 Prompt**
- [ ] `core/chat/workflow-prompts.ts`：4 种 System Prompt 模板，支持 `{title}` / `{markdown}` 变量注入

**流式消息渲染**
- [ ] `components/StreamingMessage.vue`：打字机逐字符追加 + Markdown 实时解析 + 自动滚动 + 光标动画
- [ ] Markdown 渲染器复用：marked + DOMPurify + highlight.js（代码块语法高亮）

**Chat 历史**
- [ ] `db/chat.repository.ts`：`ChatSession` / `ChatMessage` 接口 + CRUD
- [ ] Popup 打开文章时自动加载 Chat 历史

**上下文管理**
- [ ] `useChat` composable：`startAnalysis` / `sendMessage` / `clearContext`
- [ ] Token 估算 + 超限裁剪（保留最近 N 轮）
- [ ] 文章正文作为 System Message 注入（截断至 8000 tokens）

**错误处理**
- [ ] API Key 未配置 → UI 引导
- [ ] 请求超时/网络断开 → 可重试
- [ ] 流式中断 → 保留已生成内容

- [ ] 编写单元测试：SSE 解析、Workflow Prompt 模板、Chat 历史 CRUD
- [ ] 编写组件测试：ChatView 流式渲染、消息发送、上下文清除

#### 验收标准
- [ ] 4 种工作流均可正常生成 AI 分析
- [ ] 流式生成有打字机效果，停止按钮可中断
- [ ] 连续追问上下文保留，清除后可重置
- [ ] Chat 历史关闭后重新打开仍存在
- [ ] 未配置 API Key 时给出明确引导
- [ ] Markdown 渲染支持代码块语法高亮

#### 参考文档
- `doc/design.html` Tab 2 AI 消化 UI 原型

---

### Sub-Agent 6: persistence（记忆层：本地存储与同步）

**优先级**：P1  
**依赖**：foundation（IndexedDB 框架）

#### 任务清单

**IndexedDB 数据层**
- [ ] 创建 `db/schema.ts`：Dexie.js 初始化，3 张表（documents / chatHistories / settings）
- [ ] documents 索引：url(unique)、createdAt、updatedAt、siteName、title
- [ ] chatHistories 索引：articleId、createdAt
- [ ] settings 索引：key

**ArticleRepository**
- [ ] 实现 `saveArticle`：重复 URL 覆盖，保留 createdAt，更新 updatedAt
- [ ] 实现 `getArticle` / `getArticleByUrl` / `listArticles`（createdAt 降序）/ `searchArticles` / `deleteArticle` / `getArticleCount`

**SettingsRepository**
- [ ] 实现 `getSettings`（带默认值回退）/ `updateSettings` / `resetSettings`
- [ ] Schema version 检查：`pagemind_version` key

**大字段压缩**
- [ ] `compressRawHtml` / `decompressRawHtml`（lz-string）
- [ ] `saveArticle` 时自动压缩 > 10KB 的 `contentHtml`
- [ ] `getArticle` 时自动解压

**手动导出**
- [ ] `exportToFile()`：导出 `SuperBrain_backup_YYYYMMDD_HHmmss.json`
- [ ] JSON 结构：schemaVersion + exportedAt + articles + chatHistories + settings
- [ ] 触发浏览器 Blob 下载

**手动导入**
- [ ] `importFromFile()`：schemaVersion 校验 + 分流合并（id 比对，保留最新 updatedAt）
- [ ] 导入进度报告：新增 N 篇/覆盖 M 篇/跳过 K 篇/错误 E 条
- [ ] 导入后自动刷新 LibraryView

**WebDAV 同步**
- [ ] WebDAV 配置存储（密码 AES-GCM 加密）
- [ ] `pushToWebDAV()`：整包上传
- [ ] `pullFromWebDAV()`：下载 + LWW 冲突策略
- [ ] 静默同步：`chrome.alarms` 每天一次
- [ ] 同步状态指示器：绿/黄/红/灰圆点

**存储空间管理**
- [ ] `navigator.storage.estimate()` 估算并显示
- [ ]「清理全部文章」功能（二次确认）

- [ ] 编写单元测试：ArticleRepository CRUD、重复 URL 覆盖、lz-string 压缩/解压、导出 JSON 结构

#### 验收标准
- [ ] 文章保存到 IndexedDB，关闭 Popup 后数据仍在
- [ ] 重复 URL 覆盖更新，保留原始 createdAt
- [ ] 导出 JSON 可成功导入
- [ ] WebDAV 配置后可完成推拉同步
- [ ] 存储使用量正确显示

#### 参考文档
- `doc/detail.md` §3.5 存储模块、§11.2.1、§11.3.6

---

### Sub-Agent 7: search（唤醒层：本地全文检索）

**优先级**：P1  
**依赖**：persistence（IndexedDB 数据访问）

#### 任务清单

**MiniSearch 引擎**
- [ ] 创建 `core/search/minisearch-engine.ts`：MiniSearch 实例初始化
- [ ] 字段权重：title=3 / siteName=2 / author=2 / excerpt=1.5 / markdownContent=1
- [ ] 实现 `addDocument` / `removeDocument` / `search`（返回相关度分数）
- [ ] 支持分词搜索、模糊匹配、权重排序

**Web Worker 混合策略**
- [ ] 创建 `workers/search.worker.ts`：Worker 中运行 MiniSearch
- [ ] 启动全量重建：从 IndexedDB 加载全部文章 → 构建索引
- [ ] 运行时增量更新：postMessage → Worker 增量 add/remove
- [ ] 消息协议：`BUILD_INDEX` / `SEARCH` / `ADD_DOC` / `REMOVE_DOC`
- [ ] 防抖搜索：300ms 后触发 Worker 搜索
- [ ] 搜索取消：新搜索到达时中断旧搜索

**搜索 UI**
- [ ] 搜索工具栏：搜索框 + 快捷标签过滤器（动态生成）
- [ ] 搜索结果列表：卡片样式 + `<mark>` 关键词高亮
- [ ] 搜索统计："找到 N 篇匹配文章" / "共 N 篇文章"
- [ ] 搜索无结果状态 + 建议

**搜索降级**
- [ ] 三级降级链：MiniSearch → IndexedDB string.includes → 内存遍历
- [ ] 降级检测：Worker 异常/索引未就绪 → 自动降级
- [ ] 降级 UI 提示

**搜索优化**
- [ ] 结果缓存：相同 query 缓存 30s
- [ ] 搜索历史：本地最近 10 条
- [ ] 空搜索时显示历史 + 热门标签

- [ ] 编写单元测试：MiniSearch 索引/搜索、Worker 消息协议、搜索降级链

#### 验收标准
- [ ] 关键词搜索 500ms 内返回结果
- [ ] 结果按相关度排序，title 权重 > 正文
- [ ] Worker 索引构建不影响 UI 交互
- [ ] 搜索降级链路全部可用
- [ ] 搜索高亮正确

#### 参考文档
- `doc/detail.md` §3.7、§11.3.3
- `doc/design.html` Tab 3 搜索工具栏

---

### Sub-Agent 8: timeline（唤醒层：历史时间轴）

**优先级**：P2  
**依赖**：persistence（IndexedDB 数据访问）

#### 任务清单

**数据聚合**
- [ ] 创建 `core/timeline/timeline-aggregator.ts`
- [ ] 实现 `aggregateByDay` / `aggregateByWeek` / `aggregateByMonth`
- [ ] 语义化分组标签：今天/昨天/本周/上周/更早

**贡献热力图**
- [ ] 创建 `components/ContributionGraph.vue`：GitHub 风格热力图（横轴周，纵轴周几，52 周）
- [ ] 颜色映射：0 灰色 → 1-2 浅绿 → 3-5 中绿 → 5+ 深绿
- [ ] Tooltip：hover 显示日期 + 保存数 + 标题列表
- [ ] 点击某天 → 过滤当天文章
- [ ] 400px 宽度内响应式适配

**统计面板**
- [ ] 创建 `components/StatsPanel.vue`：总捕获数 / 今日捕获 / 本周捕获 / 连续 Streak 天数 / 最长 Streak
- [ ] Streak 计算：从今天往回统计连续有保存的天数

**时间轴 UI**
- [ ] 创建 `views/TimelineView.vue`：StatsPanel + ContributionGraph + 文章列表
- [ ] 月/周分组标题 + 文章卡片（精简版：title + siteName + 时间）
- [ ] 点击 → ReaderView
- [ ] 虚拟滚动优化（> 500 篇）
- [ ] LibraryView 集成时间轴切换按钮

**查询优化**
- [ ] IndexedDB 按 `createdAt` 索引批量查询
- [ ] 聚合结果缓存：仅文章变更时重算
- [ ] 热力图数据预计算

- [ ] 编写单元测试：聚合分组、Streak 计算（含跨天/跨月边界）、热力图数据映射

#### 验收标准
- [ ] 时间轴按天/周/月正确分组
- [ ] 贡献热力图颜色映射正确，Tooltip 完整
- [ ] Streak 统计准确
- [ ] 点击热力图日期可过滤
- [ ] 500 篇文章滚动流畅

#### 参考文档
- `doc/design.html` Tab 3 时间轴分组

---

## 开发顺序与依赖

```
Phase 1 (P0 MVP)
  foundation (#1)
  ├── perception (#2)
  │   └── popup-ui (#3)
  ├── model-management (#4)
  │   └── chat-with-doc (#5)
  └── (popup-ui 也依赖 perception)

Phase 2 (P1 功能完整)
  persistence (#6)
  └── search (#7)

Phase 3 (P2 体验优化)
  timeline (#8)
```

## 里程碑

### M1：P0 全部完成
- foundation：WXT 骨架可构建、可加载
- perception：网页提取 + Markdown Pipeline 完整
- popup-ui：四大视图 UI 完整，提取保存闭环可用
- model-management：多模型配置可用
- chat-with-doc：AI 消化对话功能可用
- **验证**：用户可打开 Popup → 提取当前网页 → 保存 → 阅读器查看 → AI 消化文章

### M2：P0 + P1 全部完成
- persistence：数据导入/导出 + WebDAV 同步
- search：全文检索 + 搜索高亮
- **验证**：用户可搜索历史文章、导出/导入数据、跨设备同步

### M3：全部完成
- timeline：时间轴 + 贡献热力图 + 统计
- **验证**：全部功能可用，UX 打磨完成

---

## 测试策略

每个模块必须编写 Vitest + jsdom 测试，覆盖以下层次：

| 层次 | 范围 | 示例 |
|------|------|------|
| 单元测试 | 纯函数、类型转换、数据解析 | 元数据解析优先级、AES-GCM 加解密、lz-string 压缩、时间轴聚合 |
| 集成测试 | Repository 层 CRUD | ArticleRepository 增删查改、Chat 历史存储、Settings 读写 |
| 组件测试 | Vue 组件交互 | Pipeline 状态流转、搜索过滤、Toast 弹出消失、Modal 确认取消 |

所有测试文件命名：`*.test.ts`，放置在对应源码同目录或 `__tests__/` 子目录。

---

## 关键约束

1. **MV3 CSP**：禁止内联 script，禁止 eval，所有事件通过 Vue `@click` 绑定
2. **Popup 生命周期**：Popup 失焦即销毁，关键数据必须落 IndexedDB；提取在 Content Script 中完成（不受 Popup 生命周期影响）
3. **Content Script 体积**：gzip 后 < 50KB，defuddle 按需动态 import
4. **安全**：Markdown 渲染必须经过 DOMPurify 净化；API Key 必须 AES-GCM 加密存储
5. **权限最小化**：`activeTab` + `scripting` + `storage`，`optional_host_permissions: ["<all_urls>"]`
6. **异步消息**：所有 `chrome.runtime.onMessage` 监听器必须 `return true` 以保持 sendResponse 通道开启
7. **Main Agent 验证**：Sub-Agent 完成后 Main Agent 必须亲自运行 `typecheck + test + build`，不可信任 self-report
