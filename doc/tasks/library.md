# M6 历史库与检索 — Vibe Coding 任务清单 (v1)

> **目标**：实现"阅读库"历史记录面板（虚拟滚动列表）、文章快照与对话历史双 Tab 查看器、Web Worker 隔离全文检索。
> **输入**：`doc/proposal_v1.md` §2.5
> **依赖**：M8（存储层，主副表读写分离）

---

## 1. 历史记录列表（虚拟滚动）

- [x] 安装 `vue-virtual-scroller`
- [x] 实现 `components/library/HistoryList.vue`
  - 使用 `RecycleScroller`，`itemSize` 约 64px
  - 数据源：M8 `Conversations` 主表（仅元数据，<5ms 查询）
  - **严禁 `v-for` 全量渲染**，DOM 节点数始终 ≤ 20
- [x] 实现 `components/library/HistoryItem.vue`（列表项）
  - favicon（40px 圆角，带边框背景）
  - 页面标题（`text-xs font-bold truncate`）
  - 抓取时间（`dayjs` 相对时间，如"3 小时前"，`text-[10px] text-obsidian-muted`）
  - 对话消息数量 badge + 字数标签
  - hover 效果：背景 `bg-obsidian-bg`，`shadow-sm`
- [x] 排序：默认按 `updatedAt` 倒序；支持切换按域名分类
- [x] 顶部搜索框：输入后触发 Web Worker 检索（见 §3）

---

## 2. 快照查看器（主副表懒加载）

- [x] 实现 `components/library/SnapshotViewer.vue`
  - 点击 `HistoryItem` 后展开 / 跳转到查看器
  - 加载时显示 `LoadingDots`（骨架屏），同时从 M8 副表按 `id` 懒加载完整数据
  - **严禁**在列表渲染阶段提前加载副表
- [x] 双 Tab 切换：
  - **Tab 1 - 文章快照**：渲染 `Messages.rawText`（Markdown 格式），使用 `MarkdownRenderer.vue`
    - 即使原网页已失效，本地数据可用
    - 顶部展示元数据（作者 / 发布时间 / 来源 URL 外链）
  - **Tab 2 - 对话历史**：完整历史 `chatHistory`，复用 M4 `MessageList.vue`
    - 底部提供【继续对话】按钮，在 Side Panel 恢复该对话上下文
- [x] Tab 切换动画：`opacity` 150ms 淡入淡出

---

## 3. Web Worker 全文检索

- [x] 实现 `workers/search.worker.ts`
  - `onmessage` 接收 `{ query: string, limit: number }`
  - 从 Dexie 主表 + 副表查询：
    - 主表 `Conversations`：`title` 字段正则匹配
    - 副表 `Messages.rawText`：正文全文正则匹配（按需分批扫描，避免单次阻塞）
    - 副表 `Messages.chatHistory`：对话内容关键词匹配
  - `postMessage` 回传：`SearchResult[]`（含 `pageId` / `title` / `snippet` / `matchType`）
  - `snippet` 为命中关键词前后各 60 字符的摘要切片
- [x] 实现 `lib/library/search.ts`（主线程接口）
  - `search(query: string): Promise<SearchResult[]>`（封装 Worker 通信）
  - debounce 300ms 防抖，避免输入时高频触发
- [x] 搜索结果高亮渲染：命中关键词背景色 `#fff299`，文字 `#5c4a00`
- [x] 无结果时展示 `EmptyState`（"未找到相关记录"）

---

## 4. 搜索结果列表

- [x] 实现 `components/library/SearchResultList.vue`
  - 复用 `RecycleScroller` 虚拟滚动
  - 每条结果展示：标题 + 来源类型（文章 / 对话）+ 高亮 snippet
  - 点击跳转到 `SnapshotViewer` 对应 Tab（文章 or 对话）并滚动到命中位置

---

## 5. 历史记录管理操作

- [x] 删除单条记录：长按 / 右键 → 确认 Modal → 同时删除主表 + 副表 + 关联 Highlights
- [x] 批量删除：勾选模式（Checkbox），批量确认后事务性删除
- [x] 按域名筛选：左侧域名导航列表（类书签分组），点击过滤 `HistoryList`
- [ ] 导出单条记录为 Markdown：调用 M7 `export-single` 方法

---

## 6. 库面板入口

- [x] 在 M1 右栏"历史"Tab 中嵌入 `HistoryList.vue`（紧凑模式，150px 高度，可展开）
- [x] 在 Options 独立管理页中嵌入完整 `LibraryPage.vue`（左侧列表 + 右侧查看器分屏）

---

## 验收标准

1. 历史列表有 2000 条记录时，滚动流畅（帧率 ≥ 60fps），DOM 节点数 ≤ 25。
2. 点击某条记录后，骨架屏 → 加载完成 ≤ 200ms（本地 IndexedDB 读取）。
3. 输入关键词搜索后，Worker 检索完成，结果高亮正确，主线程无卡顿（无 jank）。
4. Tab 1 文章快照在原 URL 已 404 的情况下仍可正常渲染本地 Markdown 快照。
5. 删除记录后，主表 + 副表 + Highlights 表关联数据均被清除。
