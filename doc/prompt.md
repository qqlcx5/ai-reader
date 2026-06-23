# ReadChat Clipper — VibeCoding 编排 Prompt

> 本文档是给**主控 Agent** 读取的完整编排指令。主控 Agent 按依赖顺序依次派发子 Agent，每个模块对应一个完整的自洽 Sub-Agent Prompt，子 Agent 无需阅读其他文档或询问用户。

---

## 0. 本文档使用说明（给主控 Agent）

### 0.1 工作流程

```
主控 Agent 启动
  → 阅读「实现状态表」（第 2 节）
  → 按依赖顺序逐模块派发子 Agent（每次只跑一个或一批无依赖模块）
  → 每个子 Agent 完成后：
      1. 运行 pnpm test（如有新增测试）
      2. 运行 pnpm compile（TypeScript 类型检查）
      3. 检查输出，若失败则携带错误信息重新派发子 Agent
      4. 将该模块状态更新为 COMPLETE 或 BLOCKED
  → 所有模块 COMPLETE 后，运行最终验收：pnpm test && pnpm compile && pnpm build
```

### 0.2 派发规则

- 每个子 Agent 的提示词在「第 3 节 — 模块定义」中，直接复制到新 Agent 上下文
- 子 Agent **禁止**向用户提问；如信息不足，记录在代码注释中并继续
- 子 Agent 完成后必须输出：已创建/修改的文件列表 + 验收测试结果
- 主控 Agent 维护本文档第 2 节的「实现状态」表（编辑 `doc/prompt.md`）

### 0.3 失败处理

1. `pnpm compile` 类型错误 → 携带完整错误日志重新派发同一模块 Agent
2. `pnpm test` 失败 → 携带失败的 test case 输出重新派发
3. 依赖模块未完成导致阻塞 → 标记为 BLOCKED，先完成依赖再重试

### 0.4 最终验收命令

```bash
cd D:\Desktop\qms-frontend
pnpm test && pnpm compile && pnpm build
```

三条命令全部通过才算项目完成。

---

## 1. 项目概览

| 属性 | 值 |
|------|-----|
| **产品名称** | ReadChat Clipper（manifest 中当前为 "AI Reader"，需重命名） |
| **类型** | Chrome 浏览器扩展 |
| **核心理念** | 一页一会话（Page-Isolated Chat）：每个 URL 对应独立的正文快照 + 对话记录 |
| **工作目录** | `D:\Desktop\qms-frontend` |

### 1.1 技术栈

- **WXT** `^0.20` + **Vue 3** `^3.5` + **TypeScript** strict mode
- **Pinia** `^3.0` + `pinia-plugin-persistedstate` — 跨页面状态同步
- **Dexie** `^4.4` — IndexedDB ORM
- **@mozilla/readability** + **defuddle** — 正文提取
- **markdown-it** — Markdown 渲染
- **turndown** — HTML→Markdown 转换
- **eventsource-parser** — SSE 流式解析
- **jszip** — ZIP 打包
- **webdav** — WebDAV 同步
- **vitest** `^4` + **jsdom** — 单元测试

### 1.2 扩展入口

| 入口 | 路径 | 说明 |
|------|------|------|
| Side Panel | `entrypoints/sidepanel/` | 主界面，边看边聊 |
| Popup | `entrypoints/popup/` | 工具栏弹窗，快速入口 |
| Options | `entrypoints/options/` | 设置/Library 页面 |
| Background | `entrypoints/background.ts` | Service Worker |
| Content Script | `entrypoints/content.ts` | 注入到网页，执行提取 |

### 1.3 关键目录结构

```
D:\Desktop\qms-frontend\
├── entrypoints/
│   ├── background.ts          # Service Worker（已实现）
│   ├── content.ts             # Content Script（已实现）
│   ├── sidepanel/App.vue      # 侧边栏根组件
│   ├── options/App.vue        # 设置页根组件
│   └── popup/App.vue          # 弹窗根组件
├── modules/
│   ├── extraction/            # 正文提取模块（已实现）
│   ├── provider/              # LLM Provider 适配层（已实现）
│   └── storage/               # IndexedDB 存储层（已实现，schema 需扩展）
├── lib/
│   ├── workspace/             # 多模型调度逻辑（已实现）
│   └── export/                # 备份/导出逻辑（部分实现）
├── stores/
│   ├── index.ts               # Pinia 工厂（chrome.storage 持久化）
│   ├── context.store.ts       # 当前页面 context
│   ├── conversation.store.ts  # 当前会话
│   ├── settings.store.ts      # 用户设置
│   └── ui.store.ts            # UI 状态
├── components/
│   ├── layout/                # SidePanelLayout, OptionsLayout, PopupLayout
│   ├── workspace/             # ChatWorkspace, MessageList, InputComposer 等
│   ├── history/               # HistoryList, HistoryItem
│   ├── settings/              # ProviderConfigForm, PromptManager 等
│   └── export/                # SyncOptionsPanel
├── wxt.config.ts              # WXT 配置
├── package.json
└── vitest.config.ts
```

---

## 2. 实现状态表

> 主控 Agent 在每个模块完成后更新此表。

| # | 模块名 | 状态 | 说明 |
|---|--------|------|------|
| M1 | IndexedDB 数据层 — PageRecord schema | **PARTIAL** | `modules/storage/db.ts` 已有 conversations/messages 表，缺少 URL-keyed PageRecord 表及其 repo |
| M2 | 正文提取 — content.ts + Readability | **COMPLETE** | `modules/extraction/` 完整实现，三级提取策略，支持大文件分块传输 |
| M3 | Background Service Worker — 消息路由 | **COMPLETE** | `entrypoints/background.ts` 已实现，含 tab 管理、alarm 备份调度 |
| M4 | Settings & Provider Config — stores + UI | **COMPLETE** | `stores/settings.store.ts` + `components/settings/` 完整实现 |
| M5 | Side Panel — Chat UI | **COMPLETE** | `components/workspace/ChatWorkspace.vue` 完整实现多模型流式对话 |
| M6 | Side Panel — URL 绑定 & Context Header | **PARTIAL** | `ContextStatusBar.vue` 已实现状态展示，缺少 URL→PageRecord 自动绑定逻辑 |
| M7 | Options — Library 阅读库页面 | **PARTIAL** | `HistoryList.vue` 展示的是 conversations，缺少按 URL 聚合的 Page 视图、正文快照 Tab |
| M8 | 备份与恢复 — export/import ZIP/JSON | **PARTIAL** | backup.ts/WebDAV 已实现，缺少手动 ZIP 导出 UI 和 **导入/恢复** 完整流程 |
| M9 | Popup 入口 | **COMPLETE** | `components/layout/PopupLayout.vue` 已实现 |
| M10 | 集成测试 — vitest happy-path | **PARTIAL** | 多个模块有单元测试，缺少端到端 happy-path 集成测试 |
| M0 | 扩展重命名 ReadChat Clipper | **NOT_STARTED** | `wxt.config.ts` 中 name 仍为 "AI Reader" |

---

## 3. 模块定义

---

### Module M0：扩展重命名 ReadChat Clipper

#### Goal
将扩展名从 "AI Reader" 重命名为 "ReadChat Clipper"，更新所有相关文案。

#### Files to Create/Modify
- `wxt.config.ts` — 修改 `manifest.name` 和 `description`
- `components/layout/PopupLayout.vue` — 修改品牌文案
- `components/layout/OptionsLayout.vue` — 修改品牌文案
- `entrypoints/content.ts` — 修改 console.log 中的品牌标识

#### Acceptance Criteria
- `wxt.config.ts` 中 `manifest.name === 'ReadChat Clipper'`
- `manifest.description` 更新为 "Clip any page, chat with AI — per-page, always local."
- PopupLayout 标题显示 "ReadChat Clipper"
- OptionsLayout 标题显示 "ReadChat Clipper · Settings"

#### Dependencies
无

#### Sub-Agent Prompt

```
你是一个代码执行 Agent，工作目录为 D:\Desktop\qms-frontend。

任务：将 Chrome 扩展的品牌名称从 "AI Reader" 重命名为 "ReadChat Clipper"。

需要修改的文件：

1. wxt.config.ts：
   - 将 `name: 'AI Reader'` 改为 `name: 'ReadChat Clipper'`
   - 将 `description:` 改为 `'Clip any page, chat with AI — per-page, always local.'`

2. components/layout/PopupLayout.vue：
   - 将模板中的 "AI Reader" 文字改为 "ReadChat Clipper"

3. components/layout/OptionsLayout.vue：
   - 将模板中的 "AI Reader · Settings" 改为 "ReadChat Clipper · Settings"

4. entrypoints/content.ts：
   - 将 console.log 中的 '[AI Reader]' 改为 '[ReadChat Clipper]'

完成后运行 `pnpm compile` 确认无类型错误。输出已修改文件列表和 compile 结果。
```

---

### Module M1：IndexedDB 数据层 — PageRecord Schema

#### Goal
在现有 Dexie 数据库中添加 `pages` 表，实现以 URL hash 为主键的 PageRecord 存储，并提供 CRUD repository。

#### Files to Create/Modify
- `modules/storage/db.ts` — 新增 `pages` EntityTable，迁移到 version 6
- `modules/storage/types.ts` — 新增 `PageRecord` / `PageContent` 类型
- `modules/storage/repositories/page.repo.ts` — **新建**，PageRecord CRUD
- `modules/storage/index.ts` — 导出新增的类型和 repo

#### Data Schema（严格按 PRD）

```typescript
export interface PageContent {
  rawText: string;      // Markdown 格式的正文
  wordCount: number;
}

export interface PageRecord {
  id: string;           // hash(url) — 主键
  url: string;          // 原始 URL（去参数/锚点后标准化）
  title: string;
  favicon: string;      // favicon URL 或 base64
  timestamp: number;    // 最后抓取/对话时间（Unix ms）
  content: PageContent;
  conversationId: string; // 关联到 conversations 表的 ID
}
```

#### URL 规范化规则

```typescript
// 去掉 fragment (#) 和追踪参数 (utm_*, fbclid 等)
function normalizeUrl(url: string): string { ... }

// id = 前 16 位 hex of SHA-1 of normalizedUrl
async function hashUrl(url: string): Promise<string> { ... }
```

#### Acceptance Criteria
1. `modules/storage/db.ts` 新增 version 6，`pages` 表 schema：`'id, url, conversationId, timestamp'`
2. `pageRepo.upsert(record)` 正常写入和读取
3. `pageRepo.findByUrl(url)` 返回 PageRecord 或 undefined
4. `pageRepo.listRecent({ limit })` 返回按 timestamp 倒序的列表
5. `pnpm compile` 无错误
6. 至少 1 个 vitest 单元测试覆盖 upsert + findByUrl

#### Dependencies
无（可与 M0 并行）

#### Sub-Agent Prompt

```
你是一个代码执行 Agent，工作目录为 D:\Desktop\qms-frontend。

背景：
- 项目使用 Dexie ^4.4 操作 IndexedDB
- 现有 db 定义在 modules/storage/db.ts，已有 conversations/messages/rssItems/rssFeeds/workflowTemplates 五张表，当前最高版本为 version 5
- 类型定义在 modules/storage/types.ts
- 已有 repo 示例：modules/storage/repositories/conversation.repo.ts

任务：

1. 在 modules/storage/types.ts 中添加以下类型（不要修改现有类型）：

```typescript
export interface PageContent {
  rawText: string;
  wordCount: number;
}

export interface PageRecord {
  id: string;           // hashUrl(url) 的前 16 位 hex
  url: string;          // 规范化后的原始 URL
  title: string;
  favicon: string;
  timestamp: number;    // Unix ms，最后更新时间
  content: PageContent;
  conversationId: string; // 关联的 conversations.id
}
```

2. 在 modules/storage/db.ts 中：
   - 添加 `pages!: EntityTable<PageRecord, 'id'>;`
   - 在 class 构造函数中添加 version(6).stores()，在已有五张表的基础上新增：
     `pages: 'id, url, conversationId, timestamp'`
   - 注意：version(6) 必须保留其他所有表的现有 schema，不能删减

3. 新建文件 modules/storage/repositories/page.repo.ts，实现：

```typescript
import { getDb } from '../db';
import type { PageRecord } from '../types';

// URL 规范化：去掉 hash fragment 和常见追踪参数
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    const TRACKING = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid','ref'];
    TRACKING.forEach(p => u.searchParams.delete(p));
    u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
}

// 生成 URL 的 16 位 hex ID（使用 Web Crypto）
export async function hashUrl(url: string): Promise<string> {
  const normalized = normalizeUrl(url);
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(buf)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const pageRepo = {
  async upsert(record: PageRecord): Promise<void> {
    await getDb().pages.put(record);
  },

  async findById(id: string): Promise<PageRecord | undefined> {
    return getDb().pages.get(id);
  },

  async findByUrl(url: string): Promise<PageRecord | undefined> {
    const id = await hashUrl(url);
    return getDb().pages.get(id);
  },

  async listRecent(opts: { limit?: number } = {}): Promise<PageRecord[]> {
    const limit = opts.limit ?? 100;
    return getDb().pages.orderBy('timestamp').reverse().limit(limit).toArray();
  },

  async deleteById(id: string): Promise<void> {
    await getDb().pages.delete(id);
  },

  async search(keyword: string, limit = 50): Promise<PageRecord[]> {
    const lower = keyword.toLowerCase();
    return getDb().pages
      .filter(r => r.title.toLowerCase().includes(lower) || r.content.rawText.toLowerCase().includes(lower))
      .limit(limit)
      .toArray();
  },
};
```

4. 在 modules/storage/index.ts 中导出 pageRepo 和 PageRecord 类型（查看现有 index.ts 的导出方式，保持一致）

5. 新建测试文件 modules/storage/__tests__/page.repo.test.ts：
   - 使用 vitest + jsdom 环境（参考现有测试文件的 setup）
   - 测试 normalizeUrl 去除 utm 参数和 fragment
   - 测试 hashUrl 对同一 URL 返回相同 id
   - 测试 pageRepo.upsert 后 findByUrl 能查到记录
   - 注意：测试中需要 mock 或使用 resetDbForTests（见 modules/storage/db.ts 已有的 resetDbForTests 函数）

完成后运行 `pnpm test` 和 `pnpm compile`，输出结果。若有错误，自行修复后再输出。
```

---

### Module M6：Side Panel — URL 绑定 & Page-Isolated Chat

#### Goal
实现核心的「一页一会话」绑定逻辑：侧边栏打开时，根据当前 Tab 的 URL 查找或创建对应的 PageRecord 和 Conversation，自动加载历史对话，并在提取完成后持久化正文快照。

#### Files to Create/Modify
- `utils/page-session.ts` — **新建**，URL 绑定核心逻辑
- `components/layout/SidePanelLayout.vue` — 修改 refresh() 流程，集成 page-session
- `stores/conversation.store.ts` — 新增 `loadByUrl(url)` 方法
- `components/workspace/InputComposer.vue` — 添加快捷 Prompt 按钮（总结/翻译/提取要点）

#### Core Logic

```typescript
// utils/page-session.ts
// 当侧边栏激活时：
// 1. 获取当前 Tab URL
// 2. normalizeUrl + hashUrl → pageId
// 3. pageRepo.findById(pageId)
//    - 若存在 → 加载 content 到 contextStore，loadConversation(record.conversationId)
//    - 若不存在 → 触发提取，提取成功后 upsert PageRecord，createConversation 绑定
// 4. 提取结果写入 contextStore（已有逻辑），同时持久化到 PageRecord.content
```

#### Acceptance Criteria
1. 在页面 A 聊天后，关闭侧边栏，重新打开同一页面，历史消息自动恢复
2. 在页面 B 打开侧边栏，显示空白会话（与页面 A 完全隔离）
3. `contextStore.currentContext.url` 的值与当前 Tab URL 一致
4. `InputComposer` 底部有至少 3 个快捷按钮：「总结」「翻译成中文」「提取要点」
5. 点击快捷按钮直接填充 textarea 并触发发送

#### Dependencies
M1（PageRecord schema 必须先完成）

#### Sub-Agent Prompt

```
你是一个代码执行 Agent，工作目录为 D:\Desktop\qms-frontend。

背景：
- 这是一个 Chrome 扩展，使用 Vue 3 + TypeScript + Pinia + WXT
- 核心产品理念：「一页一会话」— 每个 URL 对应一个独立的 PageRecord + Conversation
- 现有的 SidePanelLayout.vue（components/layout/SidePanelLayout.vue）已实现内容提取并存入 contextStore，但没有 URL→Conversation 的绑定逻辑
- modules/storage/repositories/page.repo.ts 已实现（M1 完成后），提供 pageRepo.findByUrl / upsert 等方法
- stores/conversation.store.ts 已实现 loadConversation(id) 和 createConversation()
- modules/extraction/ 已实现完整的提取逻辑
- 当前的提取流程（SidePanelLayout.vue 中的 refresh()）通过 chrome.storage.local._extraction_result 传递提取结果

任务 1：新建 utils/page-session.ts

```typescript
/**
 * Page-Isolated Session Manager
 * URL → PageRecord → Conversation 绑定的核心逻辑
 */
import { pageRepo, hashUrl, normalizeUrl } from '@/modules/storage/repositories/page.repo';
import { conversationRepo } from '@/modules/storage/repositories/conversation.repo';
import type { PageRecord } from '@/modules/storage/types';

export interface SessionResult {
  pageId: string;
  conversationId: string;
  isNew: boolean;
  existingContent?: PageRecord['content'];
}

/**
 * 根据 URL 查找或创建 Page Session。
 * - 若 PageRecord 已存在：返回已有的 conversationId 和 content
 * - 若不存在：创建新的 Conversation，创建空 PageRecord（content 将由后续提取填充）
 */
export async function getOrCreateSession(url: string, title: string, favicon: string = ''): Promise<SessionResult> {
  const pageId = await hashUrl(url);
  const existing = await pageRepo.findById(pageId);

  if (existing) {
    return {
      pageId,
      conversationId: existing.conversationId,
      isNew: false,
      existingContent: existing.content,
    };
  }

  // 创建新会话
  const conversation = await conversationRepo.create({
    title: title || normalizeUrl(url),
    mode: 'chat',
    activeProviderIds: [],
  });

  const record: PageRecord = {
    id: pageId,
    url: normalizeUrl(url),
    title: title || '',
    favicon,
    timestamp: Date.now(),
    content: { rawText: '', wordCount: 0 },
    conversationId: conversation.id,
  };
  await pageRepo.upsert(record);

  return {
    pageId,
    conversationId: conversation.id,
    isNew: true,
  };
}

/**
 * 提取完成后，更新 PageRecord 的 content 字段
 */
export async function updatePageContent(pageId: string, rawText: string): Promise<void> {
  const existing = await pageRepo.findById(pageId);
  if (!existing) return;
  const wordCount = countWords(rawText);
  await pageRepo.upsert({
    ...existing,
    content: { rawText, wordCount },
    timestamp: Date.now(),
  });
}

function countWords(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const words = (text.match(/[a-zA-Z]+/g) || []).length;
  return cjk + words;
}
```

任务 2：修改 components/layout/SidePanelLayout.vue

在现有的 refresh() 函数中，在提取成功后调用 page-session 逻辑：

1. import { getOrCreateSession, updatePageContent } from '@/utils/page-session'
2. import { useConversationStore } from '@/stores/conversation.store'
3. 在 setContextFromExtraction() 调用之后，添加以下逻辑：
   ```typescript
   // 绑定 URL → Conversation
   const session = await getOrCreateSession(c.url || '', c.title || '', '')
   await conversation.loadConversation(session.conversationId)
   // 若提取到正文，持久化到 PageRecord
   if (c.fullText) {
     await updatePageContent(session.pageId, c.fullText)
   }
   // 若已有历史内容但本次无提取结果，从 PageRecord 恢复正文
   if (!c.fullText && session.existingContent?.rawText) {
     ctx.setContext({ fullText: session.existingContent.rawText, rawText: session.existingContent.rawText })
   }
   ```
4. 在 SidePanelLayout.vue 的 script setup 顶部添加 useConversationStore 的导入和初始化

注意：
- 保留现有的 loading 状态管理
- 保留现有的 fallback 链（scripting → background → storage）
- 新增逻辑只在 URL 有效时执行（c.url 不为空）

任务 3：在 stores/conversation.store.ts 中添加 loadByUrl 方法

```typescript
async function loadByUrl(url: string) {
  const { pageRepo, hashUrl } = await import('@/modules/storage/repositories/page.repo')
  const pageId = await hashUrl(url)
  const page = await pageRepo.findById(pageId)
  if (page) {
    await loadConversation(page.conversationId)
    return page.conversationId
  }
  return undefined
}
// 同时在 return 中暴露 loadByUrl
```

任务 4：修改 components/workspace/InputComposer.vue

在现有 composer__shortcuts div 中，修改快捷按钮为以下三个 Prompt 按钮（发送后直接触发消息）：

替换现有的 "圆桌交锋" 和 "串联接力" 按钮为：

```html
<button type="button" class="composer__shortcut" @click="sendQuick('请用中文总结这篇文章的核心要点，用 3-5 条 bullet points 格式输出。')">总结</button>
<span class="muted-light">·</span>
<button type="button" class="composer__shortcut" @click="sendQuick('请将以上页面内容翻译成中文，保留段落结构。')">翻译</button>
<span class="muted-light">·</span>
<button type="button" class="composer__shortcut" @click="sendQuick('请提取这篇文章的核心论点和关键概念，用清单格式列出。')">提取要点</button>
```

在 script 中添加：
```typescript
function sendQuick(prompt: string) {
  text.value = prompt
  nextTick(() => onSend())
}
```

完成后运行 `pnpm compile`，若有错误自行修复。输出已修改文件列表。
```

---

### Module M7：Options Page — Library 阅读库

#### Goal
在 Options 页面中添加「Library」标签页，展示所有已抓取页面的列表（按时间倒序），点击页面可查看文章正文快照和对话记录（左右分屏 Tab）。

#### Files to Create/Modify
- `components/history/PageLibrary.vue` — **新建**，Library 主视图（取代当前的 HistoryList + HistoryItem）
- `components/history/PageSnapshotViewer.vue` — **新建**，右侧快照查看器（正文 Tab + 对话 Tab）
- `components/layout/OptionsLayout.vue` — 添加 Library 标签页

#### UI 规范

```
┌─────────────────── Options ── Library ──────────────────────┐
│  [搜索框]                            已抓取 42 页            │
├──────────────────┬──────────────────────────────────────────┤
│  页面列表（左）   │  快照查看器（右）                         │
│  ─────────────  │  ┌──────────────┬──────────────┐         │
│  • 页面标题 1    │  │  正文快照    │  对话记录    │         │
│    2天前·1500字  │  ├──────────────┴──────────────┤         │
│  • 页面标题 2    │  │  ...内容...                 │         │
│    5天前·800字   │  └─────────────────────────────┘         │
└──────────────────┴──────────────────────────────────────────┘
```

#### Acceptance Criteria
1. Library 页面显示所有 PageRecord（从 pageRepo.listRecent() 加载）
2. 列表显示：页面标题、hostname、相对时间、字数
3. 搜索框支持标题和正文全文过滤（调用 pageRepo.search()）
4. 点击列表项：右侧显示正文快照（Markdown 渲染）和对话记录
5. 对话记录展示 user 和 assistant 消息（从 conversationStore 加载）
6. OptionsLayout 新增 "Library" Tab（图标 `📚`）

#### Dependencies
M1（PageRecord schema）、M6（有数据写入后才有意义）

#### Sub-Agent Prompt

```
你是一个代码执行 Agent，工作目录为 D:\Desktop\qms-frontend。

背景：
- 项目使用 Vue 3 + TypeScript + Pinia + WXT
- modules/storage/repositories/page.repo.ts 已实现 listRecent / search 方法
- modules/storage/repositories/conversation.repo.ts 已实现
- modules/storage/repositories/message.repo.ts 已实现 listByConversationId
- markdown-it 已安装，可以 import MarkdownIt from 'markdown-it' 渲染正文
- 现有的 components/layout/OptionsLayout.vue 已实现多 Tab 布局（Provider/Prompts/Sync/RSS/Advanced）
- 现有 components/history/HistoryList.vue 展示 conversations 列表（保持不变，不影响它）

任务 1：新建 components/history/PageLibrary.vue

实现以下结构：
```vue
<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue'
import { pageRepo } from '@/modules/storage/repositories/page.repo'
import { messageRepo } from '@/modules/storage/repositories/message.repo'
import type { PageRecord, MessageRecord } from '@/modules/storage/types'
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({ breaks: true, linkify: true })

const pages = ref<PageRecord[]>([])
const selectedPage = ref<PageRecord | null>(null)
const messages = ref<MessageRecord[]>([])
const searchKeyword = ref('')
const activeTab = ref<'content' | 'chat'>('content')

async function loadPages() {
  pages.value = await pageRepo.listRecent({ limit: 200 })
}

async function selectPage(page: PageRecord) {
  selectedPage.value = page
  activeTab.value = 'content'
  messages.value = []
  if (page.conversationId) {
    const result = await messageRepo.listByConversationId(page.conversationId, { limit: 500 })
    messages.value = result.items
  }
}

const filteredPages = computed(() => {
  if (!searchKeyword.value.trim()) return pages.value
  const lower = searchKeyword.value.toLowerCase()
  return pages.value.filter(p =>
    p.title.toLowerCase().includes(lower) ||
    p.url.toLowerCase().includes(lower) ||
    p.content.rawText.toLowerCase().includes(lower)
  )
})

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${Math.floor(diff / 86400000)} 天前`
}

function hostname(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}

const renderedContent = computed(() => {
  if (!selectedPage.value?.content.rawText) return ''
  return md.render(selectedPage.value.content.rawText)
})

onMounted(loadPages)

watch(searchKeyword, async (kw) => {
  if (kw.trim()) {
    pages.value = await pageRepo.search(kw, 100)
  } else {
    await loadPages()
  }
})
</script>

<template>
  <div class="page-library">
    <div class="library-sidebar">
      <div class="library-search">
        <input
          v-model="searchKeyword"
          class="library-search__input"
          type="search"
          placeholder="搜索标题、正文…"
        />
        <span class="library-count muted">{{ filteredPages.length }} 页</span>
      </div>
      <div class="library-list">
        <div
          v-for="page in filteredPages"
          :key="page.id"
          class="library-list__item"
          :class="{ 'library-list__item--active': selectedPage?.id === page.id }"
          @click="selectPage(page)"
        >
          <div class="library-item__title">{{ page.title || page.url }}</div>
          <div class="library-item__meta muted">
            <span>{{ hostname(page.url) }}</span>
            <span>·</span>
            <span>{{ relativeTime(page.timestamp) }}</span>
            <span>·</span>
            <span>{{ page.content.wordCount }} 字</span>
          </div>
        </div>
        <div v-if="filteredPages.length === 0" class="library-empty muted">
          暂无记录
        </div>
      </div>
    </div>
    <div class="library-viewer">
      <template v-if="selectedPage">
        <div class="viewer-tabs">
          <button
            class="viewer-tab"
            :class="{ 'viewer-tab--active': activeTab === 'content' }"
            @click="activeTab = 'content'"
          >正文快照</button>
          <button
            class="viewer-tab"
            :class="{ 'viewer-tab--active': activeTab === 'chat' }"
            @click="activeTab = 'chat'"
          >对话记录</button>
        </div>
        <div class="viewer-body">
          <div v-if="activeTab === 'content'" class="viewer-content markdown-body" v-html="renderedContent" />
          <div v-else class="viewer-chat">
            <div
              v-for="msg in messages"
              :key="msg.id"
              class="chat-msg"
              :class="`chat-msg--${msg.role}`"
            >
              <div class="chat-msg__role muted">{{ msg.role === 'user' ? '你' : 'AI' }}</div>
              <div class="chat-msg__content">
                <template v-if="msg.role === 'assistant'">
                  <div
                    v-for="r in msg.modelResponses"
                    :key="r.providerId"
                    class="chat-msg__response"
                    v-html="md.render(r.content || '')"
                  />
                </template>
                <span v-else>{{ msg.content }}</span>
              </div>
            </div>
            <div v-if="messages.length === 0" class="muted">暂无对话记录</div>
          </div>
        </div>
      </template>
      <div v-else class="library-viewer__empty muted">
        从左侧选择一个页面查看
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-library {
  display: flex;
  height: 100%;
  min-height: 500px;
  gap: 0;
}
.library-sidebar {
  width: 280px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.library-search {
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--border);
}
.library-search__input {
  flex: 1;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 6px 10px;
  font-size: var(--fs-xs);
  background: var(--bg);
  color: var(--text);
  outline: none;
}
.library-search__input:focus {
  border-color: var(--primary);
}
.library-count {
  font-size: var(--fs-11);
  white-space: nowrap;
}
.library-list {
  flex: 1;
  overflow-y: auto;
}
.library-list__item {
  padding: 10px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
  transition: background 0.1s;
}
.library-list__item:hover,
.library-list__item--active {
  background: var(--primary-soft);
}
.library-item__title {
  font-size: var(--fs-xs);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.library-item__meta {
  font-size: 11px;
  display: flex;
  gap: 4px;
  margin-top: 2px;
}
.library-empty {
  padding: 24px;
  text-align: center;
}
.library-viewer {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.library-viewer__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: var(--fs-xs);
}
.viewer-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
  padding: 0 12px;
  gap: 0;
}
.viewer-tab {
  padding: 10px 16px;
  font-size: var(--fs-xs);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  color: var(--muted);
  font-weight: 500;
}
.viewer-tab--active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}
.viewer-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
.viewer-content {
  line-height: 1.7;
  font-size: var(--fs-xs);
}
.chat-msg {
  margin-bottom: 16px;
}
.chat-msg__role {
  font-size: 11px;
  font-weight: 700;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.chat-msg--user .chat-msg__role {
  color: var(--primary);
}
.chat-msg__content {
  font-size: var(--fs-xs);
  line-height: 1.6;
}
</style>
```

任务 2：修改 components/layout/OptionsLayout.vue

在 tabs 数组中添加一个新 tab（在 provider 之前或最前面）：
```typescript
{ id: 'library', label: 'Library', icon: '📚' },
```

在 template 的 section.options__panel 中，在最前面或对应位置添加：
```html
<PageLibrary v-if="activeTab === 'library'" />
```

在 script 顶部添加 import：
```typescript
import PageLibrary from '@/components/history/PageLibrary.vue'
```

完成后运行 `pnpm compile`。若有类型错误自行修复。输出文件列表。
```

---

### Module M8：备份与恢复 — 完整 UI + 导入流程

#### Goal
完善备份与恢复功能：实现手动导出 ZIP/JSON UI，并实现**导入恢复**的完整流程（包含 PageRecord + Conversation + Message 的合并策略）。

#### Files to Create/Modify
- `lib/export/import.ts` — **新建**，导入解析 + 合并策略逻辑
- `components/export/SyncOptionsPanel.vue` — 修改，添加手动导出按钮和导入 UI

#### Import Merge Strategies

```typescript
type MergeStrategy = 'skip' | 'overwrite';
// skip: 已存在的 record 保留本地版本
// overwrite: 已存在的 record 用导入版本覆盖
```

#### Acceptance Criteria
1. Options → Sync 页面有「导出 JSON」和「导出 ZIP」按钮
2. 点击导出后自动下载文件（无弹窗，直接触发浏览器下载）
3. 有「导入」区域，用户选择 .json 或 .zip 文件后预览条目数，确认后执行导入
4. 导入时支持「跳过重复」和「覆盖合并」策略选项
5. 导入完成后显示：导入页面数 / 跳过数 / 错误数

#### Dependencies
M1（PageRecord）

#### Sub-Agent Prompt

```
你是一个代码执行 Agent，工作目录为 D:\Desktop\qms-frontend。

背景：
- lib/export/ 目录已有 backup.ts（WebDAV 备份）、zip.ts（ZIP 打包）、webdav.ts、view-models.ts、markdown.ts 等文件
- lib/export/backup.ts 中已有 collectBackupSnapshot()，返回 { conversations, messages, settings, generatedAt }
- modules/storage/repositories/page.repo.ts 已实现（M1）
- modules/storage/repositories/conversation.repo.ts 和 message.repo.ts 已实现
- jszip 已安装：import JSZip from 'jszip'
- 组件 components/export/SyncOptionsPanel.vue 已存在，实现了 WebDAV 配置 UI

任务 1：新建 lib/export/import.ts

实现以下功能：

```typescript
import JSZip from 'jszip'
import { getDb } from '@/modules/storage/db'
import { pageRepo } from '@/modules/storage/repositories/page.repo'

export type MergeStrategy = 'skip' | 'overwrite'

export interface ImportStats {
  pages: { imported: number; skipped: number; errors: number }
  conversations: { imported: number; skipped: number }
  messages: { imported: number; skipped: number }
}

/** 解析 JSON 字符串为备份数据 */
export function parseBackupJson(json: string): unknown {
  return JSON.parse(json)
}

/** 从 ZIP 文件（ArrayBuffer）提取主 backup.json */
export async function extractBackupFromZip(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer)
  const entry = zip.file('backup.json') || zip.file(Object.keys(zip.files)[0])
  if (!entry) throw new Error('ZIP 中未找到 backup.json')
  return entry.async('string')
}

/** 执行导入：将备份数据合并到本地数据库 */
export async function importBackup(
  data: unknown,
  strategy: MergeStrategy = 'skip'
): Promise<ImportStats> {
  const stats: ImportStats = {
    pages: { imported: 0, skipped: 0, errors: 0 },
    conversations: { imported: 0, skipped: 0 },
    messages: { imported: 0, skipped: 0 },
  }

  if (typeof data !== 'object' || data === null) throw new Error('无效的备份格式')
  const backup = data as Record<string, unknown>

  const db = getDb()

  // 导入 conversations
  if (Array.isArray(backup.conversations)) {
    for (const conv of backup.conversations) {
      try {
        const exists = await db.conversations.get((conv as any).id)
        if (exists && strategy === 'skip') { stats.conversations.skipped++; continue }
        await db.conversations.put(conv as any)
        stats.conversations.imported++
      } catch { /* ignore */ }
    }
  }

  // 导入 messages
  if (Array.isArray(backup.messages)) {
    for (const msg of backup.messages) {
      try {
        const exists = await db.messages.get((msg as any).id)
        if (exists && strategy === 'skip') { stats.messages.skipped++; continue }
        await db.messages.put(msg as any)
        stats.messages.imported++
      } catch { /* ignore */ }
    }
  }

  // 导入 pages（若备份中有 pages 数组）
  if (Array.isArray(backup.pages)) {
    for (const page of backup.pages) {
      try {
        const exists = await pageRepo.findById((page as any).id)
        if (exists && strategy === 'skip') { stats.pages.skipped++; continue }
        await pageRepo.upsert(page as any)
        stats.pages.imported++
      } catch { stats.pages.errors++ }
    }
  }

  return stats
}
```

任务 2：新建 lib/export/manual-export.ts

```typescript
import JSZip from 'jszip'
import { collectBackupSnapshot } from './backup'
import { pageRepo } from '@/modules/storage/repositories/page.repo'

/** 下载数据到浏览器（通过 <a download> 技巧） */
function downloadFile(filename: string, content: string | Blob, mimeType: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/** 导出 JSON 备份（含 pages） */
export async function exportJson(): Promise<void> {
  const snapshot = await collectBackupSnapshot()
  const pages = await pageRepo.listRecent({ limit: 10000 })
  const full = { ...snapshot, pages }
  const filename = `readchat-backup-${new Date().toISOString().slice(0, 10)}.json`
  downloadFile(filename, JSON.stringify(full, null, 2), 'application/json')
}

/** 导出 ZIP 备份（backup.json + pages/ 目录每页一个 .md 文件） */
export async function exportZip(): Promise<void> {
  const snapshot = await collectBackupSnapshot()
  const pages = await pageRepo.listRecent({ limit: 10000 })
  const zip = new JSZip()
  zip.file('backup.json', JSON.stringify({ ...snapshot, pages }, null, 2))
  const pagesFolder = zip.folder('pages')!
  for (const page of pages) {
    const safe = page.title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_').slice(0, 50)
    const md = `# ${page.title}\n\nURL: ${page.url}\n\n---\n\n${page.content.rawText}`
    pagesFolder.file(`${page.id}-${safe}.md`, md)
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  const filename = `readchat-backup-${new Date().toISOString().slice(0, 10)}.zip`
  downloadFile(filename, blob, 'application/zip')
}
```

任务 3：修改 components/export/SyncOptionsPanel.vue

阅读该文件现有内容，然后在底部或合适位置添加以下 UI 区域（保留现有的 WebDAV 配置区域）：

新增「手动备份」区域：
- 「导出 JSON」按钮 → 调用 exportJson()
- 「导出 ZIP」按钮 → 调用 exportZip()

新增「导入恢复」区域：
- 文件选择框（accept=".json,.zip"）
- 合并策略单选：⚬ 跳过重复（默认）  ⚬ 覆盖本地
- 「开始导入」按钮
- 导入结果展示（页面数/消息数/跳过数）

在 script 中：
```typescript
import { exportJson, exportZip } from '@/lib/export/manual-export'
import { importBackup, extractBackupFromZip, type MergeStrategy } from '@/lib/export/import'

const importFile = ref<File | null>(null)
const mergeStrategy = ref<MergeStrategy>('skip')
const importStats = ref<null | { pages: any; conversations: any; messages: any }>(null)
const importing = ref(false)

async function handleImport() {
  if (!importFile.value) return
  importing.value = true
  importStats.value = null
  try {
    let json: string
    if (importFile.value.name.endsWith('.zip')) {
      const buf = await importFile.value.arrayBuffer()
      json = await extractBackupFromZip(buf)
    } else {
      json = await importFile.value.text()
    }
    const data = JSON.parse(json)
    importStats.value = await importBackup(data, mergeStrategy.value)
  } finally {
    importing.value = false
  }
}
```

完成后运行 `pnpm compile`，修复所有错误。输出文件列表。
```

---

### Module M10：集成测试 — Vitest Happy-Path

#### Goal
编写覆盖关键用户旅程的集成测试，确保核心流程在 jsdom 环境下可验证通过。

#### Files to Create
- `modules/storage/__tests__/page-session.integration.test.ts` — URL 绑定 happy-path
- `lib/export/__tests__/import.test.ts` — 导入流程测试（若已有则补充）
- `modules/extraction/__tests__/extraction.spec.ts` — 若已有则检查覆盖率，补充 edge case

#### Test Cases（必须覆盖）

```
1. 相同 URL 两次创建 session → 返回同一个 conversationId
2. normalizeUrl 去除 utm 参数
3. pageRepo.upsert + findByUrl 往返测试
4. importBackup with strategy='skip' → 不覆盖已有数据
5. importBackup with strategy='overwrite' → 覆盖已有数据
6. extractBackupFromZip → 解析 ZIP 中的 backup.json
```

#### Dependencies
M1、M6（page-session 逻辑）、M8（import 逻辑）

#### Sub-Agent Prompt

```
你是一个代码执行 Agent，工作目录为 D:\Desktop\qms-frontend。

背景：
- vitest ^4，test environment 为 jsdom（见 vitest.config.ts）
- modules/storage/db.ts 有 resetDbForTests(name) 用于测试隔离
- 现有测试在 modules/storage/__tests__/ 和 lib/export/__tests__/ 等目录
- 通过 `import { getOrCreateSession, updatePageContent } from '@/utils/page-session'` 访问 M6 实现
- 通过 `import { importBackup, extractBackupFromZip } from '@/lib/export/import'` 访问 M8 实现

任务：按以下用例编写测试，每个测试文件独立，每个 test case 有清晰的 describe + it 命名。

文件 1：modules/storage/__tests__/page-session.integration.test.ts
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
// 在 beforeEach 中 reset DB
// 测试：
// it('相同 URL 两次调用 getOrCreateSession 返回同一 conversationId')
// it('不同 URL 调用 getOrCreateSession 返回不同 conversationId')
// it('updatePageContent 正确更新 wordCount')
// it('normalizeUrl 去除 utm_source 参数')
// it('normalizeUrl 去除 hash fragment')
```

文件 2：lib/export/__tests__/import.test.ts（若已存在则仅补充缺失用例）
```typescript
// 测试：
// it('importBackup skip 策略不覆盖已有会话')
// it('importBackup overwrite 策略覆盖已有会话')
// it('extractBackupFromZip 正确从 ZIP ArrayBuffer 提取 JSON 字符串')
```

注意：
- jsdom 不支持 crypto.subtle，需要在 vitest.config.ts 的 setup 或 test 文件中 polyfill：
  `import { webcrypto } from 'crypto'; globalThis.crypto = webcrypto as unknown as Crypto;`
- jsdom 不支持 IndexedDB，使用 fake-indexeddb polyfill（检查 package.json 是否已安装，若没有用 npm install fake-indexeddb）
- 查看现有测试文件了解如何正确 setup DB mock

运行 `pnpm test` 验证所有测试通过，输出测试结果摘要。
```

---

## 4. 编码规范与约定

### 4.1 TypeScript

```typescript
// ✅ 正确：使用明确的类型
const pages = ref<PageRecord[]>([])

// ❌ 禁止：使用 any
const data: any = ...

// ✅ 正确：类型断言使用 as，不用强转
const config = value as ProviderConfig

// ✅ 正确：错误处理
try { ... } catch (err) {
  console.error('[module]', err instanceof Error ? err.message : String(err))
}
```

### 4.2 Vue 3 Composition API

```typescript
// ✅ 正确：<script lang="ts" setup>
// ✅ 正确：defineProps<{...}>() 泛型语法
// ✅ 正确：defineEmits<{ (e: 'event', payload: Type): void }>()
// ✅ 正确：computed(() => ...) 有明确返回类型推断
// ❌ 禁止：Options API（除非有特殊原因）
// ❌ 禁止：v-model 直接修改 props
```

### 4.3 Pinia Store 模式

```typescript
// ✅ 正确：Composition Store（function syntax）
export const useXxxStore = defineStore('xxx', () => {
  const data = ref<Type>(initial)
  function action() { ... }
  return { data, action }
}, { persist: { key: ... } })

// ❌ 禁止：Options Store（object syntax）
```

### 4.4 文件命名

| 类型 | 命名规范 | 示例 |
|------|---------|------|
| Vue 组件 | PascalCase.vue | `PageLibrary.vue` |
| TypeScript 模块 | kebab-case.ts | `page-session.ts` |
| 测试文件 | `*.spec.ts` 或 `*.test.ts` | `page.repo.test.ts` |
| Store | `name.store.ts` | `context.store.ts` |
| Repo | `name.repo.ts` | `page.repo.ts` |

### 4.5 CSS 约定

```css
/* ✅ 使用 scoped style */
/* ✅ 使用 CSS 变量（已定义：--primary, --border, --text, --muted, --bg, --card, --panel 等） */
/* ✅ BEM 命名：.block__element--modifier */
/* ❌ 禁止 inline style，除非是动态计算值 */
```

### 4.6 测试约定

```typescript
// ✅ 每个测试文件 beforeEach 重置 DB：
import { resetDbForTests } from '@/modules/storage/db'
beforeEach(() => { resetDbForTests() })

// ✅ 测试文件仅 import 被测模块，不 import 整个 App
// ✅ mock chrome API：globalThis.chrome = { storage: { local: { ... } } }
// ✅ 每个测试独立，不依赖执行顺序
```

---

## 5. 验收清单（最终验证）

主控 Agent 在所有模块完成后，按顺序执行以下验证步骤：

### Step 1: TypeScript 编译
```bash
cd D:\Desktop\qms-frontend
pnpm compile
```
**期望结果**：0 errors, 0 warnings（或仅有 pre-existing warnings）

### Step 2: 单元测试
```bash
pnpm test
```
**期望结果**：所有测试通过，覆盖以下模块：
- [ ] `modules/storage/__tests__/page.repo.test.ts` — PageRecord CRUD
- [ ] `modules/storage/__tests__/page-session.integration.test.ts` — URL 绑定
- [ ] `lib/export/__tests__/import.test.ts` — 导入流程
- [ ] `modules/extraction/__tests__/extraction.spec.ts` — 提取逻辑（已有）
- [ ] `modules/provider/__tests__/` — Provider 适配层（已有）
- [ ] `lib/workspace/__tests__/` — 调度器（已有）

### Step 3: 构建
```bash
pnpm build
```
**期望结果**：`.output/chrome-mv3/` 目录生成，`manifest.json` 中 `name === 'ReadChat Clipper'`

### Step 4: 功能验收矩阵

| 功能 | 验证方式 |
|------|---------|
| 内容提取 | 在 Chrome 扩展环境下，打开任意文章页，侧边栏显示字数 > 0 |
| URL 绑定 | 页面 A 对话后关闭再打开，历史消息恢复 |
| 页面隔离 | 页面 B 打开侧边栏，会话为空 |
| 快捷 Prompt | 点击「总结」按钮，textarea 自动填充并发送 |
| Library | Options → Library 显示已抓取页面列表 |
| 快照查看 | Library 中点击页面，右侧显示 Markdown 正文 |
| 导出 JSON | Sync 页面点击导出，浏览器下载 .json 文件 |
| 导出 ZIP | Sync 页面点击导出 ZIP，浏览器下载 .zip 文件 |
| 导入恢复 | 选择 .json 文件，导入后 Library 显示新增页面 |
| 重命名 | 扩展图标 tooltip 显示 "ReadChat Clipper" |

---

## 6. 已知缺口与风险分析

基于对现有代码库的深入分析，以下是主要缺口和风险点：

### 6.1 架构缺口（高优先级）

| 问题 | 现状 | 目标 |
|------|------|------|
| **URL-Conversation 解耦** | SidePanelLayout.vue 的 refresh() 只提取内容，不与持久化 ID 绑定 | M6 通过 page-session.ts 建立绑定 |
| **PageRecord 表缺失** | DB 只有 conversations/messages，无 URL 主键的 pages 表 | M1 添加 pages 表及 repo |
| **正文快照不持久化** | 提取的 fullText 只存在 chrome.storage.local（临时） | M6 将 fullText 写入 PageRecord.content |

### 6.2 功能缺口（中优先级）

| 问题 | 现状 | 目标 |
|------|------|------|
| **Library 页面** | HistoryList 显示 conversations，非 URL 聚合视图 | M7 新建 PageLibrary 组件 |
| **手动导出 UI** | SyncOptionsPanel 有 WebDAV 配置，无手动导出按钮 | M8 添加导出 UI |
| **导入/恢复** | lib/export/ 无 import 逻辑 | M8 新建 import.ts |
| **快捷 Prompt 按钮** | InputComposer 有「圆桌」「串联」按钮，无「总结/翻译/提取要点」 | M6 替换快捷按钮 |

### 6.3 技术风险

| 风险 | 说明 | 缓解措施 |
|------|------|---------|
| **crypto.subtle 在 Service Worker** | hashUrl 使用 Web Crypto API，SW 中可用，但测试 jsdom 不支持 | 测试中 polyfill webcrypto |
| **大文件内容提取** | content.ts 已处理 > 1MB 的分块传输，但 PageRecord 存储时需要注意 IndexedDB 单条记录大小 | 限制 rawText 最大 5MB，超出时截断并记录 |
| **SidePanelLayout.vue 的 refresh() 竞态** | 多次快速刷新可能产生竞态，创建多个 Conversation | page-session.ts 使用 findById 做幂等检查 |
| **Pinia store 初始化顺序** | conversation store 需要在 page-session 逻辑前初始化 | SidePanelLayout.vue 已在 onMounted 中运行，保证 Pinia 已初始化 |
| **Options 页面 Library 读取大量正文** | listRecent 全量加载 PageRecord 会把 content.rawText 全装入内存 | 列表只显示 title/url/timestamp/wordCount，rawText 仅在选中时按需加载（修改 listRecent 只返回元信息） |

### 6.4 遗留债务（可后续处理）

- `wxt.config.ts` 未配置 `commands['abort-all-generations']`（已在 background.ts 引用但 manifest 未声明）
- HistoryList.vue 与新的 PageLibrary.vue 存在功能重叠，未来可统一
- `defaultSettings` 中的 apiKey 是硬编码测试 key，应在正式发布前清空
- SidePanelLayout.vue 中 `extractViaScripting` 使用了 `(chrome as any).scripting` 规避类型检查，后续应补充正式类型

---

*本文档由主控 Agent 维护，每个模块完成后更新第 2 节的实现状态表。*
