# AI Reader 架构概览

## 模块体系

AI Reader 由 8 个模块（M1–M8）构成，按依赖关系分层：

```
┌─────────────────────────────────────────────────────────┐
│                      M1 入口与布局                       │
│  PopUp / Side Panel / Options / 快捷键 / 主题           │
├─────────────────────────────────────────────────────────┤
│              M4 多模型工作区    M5 高阶工作流            │
│  会话管理 / 并发调度 / 流式渲染  圆桌 / 接力链 / 模板   │
├──────────────┬────────────────┬─────────────────────────┤
│  M2 上下文   │   M3 Provider  │   M8 RSS 流水线         │
│  提取        │   & LLM 客户端 │  抓取 / 去重 / 摘要    │
│  Readability │   OpenAI       │                         │
│  Defuddle    │   Anthropic    │                         │
│  innerText   │   Gemini/Custom│                         │
├──────────────┴────────────────┴─────────────────────────┤
│         M6 导出与同步         M7 存储与数据层            │
│  Obsidian / WebDAV / Zip      Dexie / Pinia / Worker    │
└─────────────────────────────────────────────────────────┘
```

### 模块职责

| 模块 | 职责 | 核心文件 |
|------|------|----------|
| **M1** | 三个入口页、全局快捷键、主题、共享组件 | `entrypoints/{popup,sidepanel,options}/`、`components/layout/` |
| **M2** | 网页正文提取、三级降级、大文本分片 | `modules/extraction/`、`entrypoints/content.ts` |
| **M3** | LLM Provider 抽象、SSE 流式、重试/中止、指标 | `modules/provider/` |
| **M4** | 对话管理、多模型并发调度、流式渲染、追问 | `lib/workspace/`、`components/workspace/` |
| **M5** | 圆桌讨论、接力链、工作流模板管理 | `lib/workflow/`、`components/workflow/` |
| **M6** | Obsidian URI、WebDAV 同步、Zip 导出、自动备份 | `lib/export/` |
| **M7** | Dexie 数据库、Pinia 持久化、跨入口同步、全文搜索 | `modules/storage/`、`stores/` |
| **M8** | RSS 抓取、去重、AI 摘要、图标角标 | `lib/rss/` |

### 依赖关系

```
M7（存储层） ← 所有模块
M2（提取）+ M3（Provider） ← M4（工作区）+ M5（工作流）
M1（入口） → 容器给 M4（工作区）
M4（工作区数据） ← M6（导出）
M8（RSS） → M3（AI 摘要）
```

## 数据流

### 核心提取流

```
网页 DOM → Content Script (M2)
           → Readability (Markdown)
           → Defuddle (Markdown, 8s timeout)
           → innerText (plain text fallback)
           → chrome.storage.local._extraction_result
           → Side Panel / Popup 通过 storage.onChanged 读取
```

### 对话流

```
用户输入 → InputComposer → ChatWorkspace
         → runMultiModelChat (M4 调度器)
         → 并发调用多个 M3 Provider.chatStream()
         → 每个 Provider 独立 SSE 流
         → onDelta / onStatus / onMetrics 回调
         → StreamingText 增量渲染（rAF 节流）
         → 写入 Dexie (M7)
```

### 消息通道

```
┌──────────┐   runtime.sendMessage    ┌──────────┐
│ Background│ ←───────────────────────│  Side    │
│  (M1/M6)  │ ───────────────────────→│  Panel   │
└───────────┘   runtime.onMessage      └────┬─────┘
                                             │
                                    tabs.sendMessage(tabId, ...)
                                             │
                                             ▼
                                      ┌──────────┐
                                      │  Content  │
                                      │  Script   │
                                      │  (M2)     │
                                      └──────────┘

  ⚠️ MV3 限制: Background (service worker) 的 runtime.sendMessage
     无法到达 content script。仅 tabs.sendMessage(tabId) 有效。
     因此 Side Panel 直接通过 tabs.sendMessage 调用 content script，
     Background 仅负责打开侧边栏和 M6 自动备份。
```

## 状态管理

### 存储分层

```
┌─────────────────────────────────────┐
│ chrome.storage.local (Pinia 持久化) │  ← small state (<5MB)
│  ui-store / context-store /         │
│  settings-store / conversation-store│
├─────────────────────────────────────┤
│ IndexedDB (Dexie)                   │  ← large data
│  conversations / messages /         │
│  rssItems / rssFeeds /              │
│  workflowTemplates                  │
└─────────────────────────────────────┘
```

### 跨入口同步

- 每个入口（Popup / Side Panel / Options）都有自己的 Pinia store 实例。
- `pinia-plugin-persistedstate` 将 store 序列化到 `chrome.storage.local`。
- `chrome.storage.onChanged` 监听器同步其他入口的 store 变化。
- 大型对话数据直接通过 Dexie 读写，不过 Pinia 持久化。

## 关键技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 状态管理 | Pinia + Dexie | Pinia 处理小状态/跨入口同步；Dexie 处理大数据 |
| 持久化 | `pinia-plugin-persistedstate` | 自动序列化到 `chrome.storage.local` |
| 内容提取 | Readability → Defuddle → innerText | 三级降级保证最大兼容性 |
| Provider 抽象 | 策略模式（BaseProvider） | 统一接口，方便扩展新 Provider |
| 流式渲染 | 增量追加 + rAF 节流 | 避免长文本时全量重渲染 |
| 全文搜索 | Web Worker | 不阻塞主线程 |
| 分片传输 | 1MB/块 | 突破 Chrome runtime message 大小限制 |
| 自动备份 | `chrome.alarms` | 无需常驻后台 |
| 工作流编排 | `Promise.all`（圆桌）+ 拓扑排序（接力链） | 分别对应并发和串行场景 |

## 扩展点

### 添加新 Provider

1. 在 `modules/provider/types.ts` 的 `ProviderType` 中添加新类型。
2. 在 `modules/provider/providers/` 中创建实现文件。
3. 在 `modules/provider/factory.ts` 中添加 case。
4. 在 `modules/storage/types.ts` 的 `defaultSettings.providers` 中添加默认配置。

### 添加新工作流类型

1. 在 `lib/workflow/types.ts` 的 `WorkflowType` 中添加新类型。
2. 在 `lib/workflow/` 中创建编排模块。
3. 在 `components/workflow/` 中添加 UI 组件。

### 添加新导出目标

1. 在 `lib/export/` 中创建导出实现。
2. 在 `modules/storage/types.ts` 的 `ExportConfig` 中添加配置字段。
3. 在 `components/settings/SyncOptionsPanel.vue` 中添加 UI。
