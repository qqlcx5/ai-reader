# 唤醒层：本地全文检索 (P1)

> **模块名称**: search  
> **优先级**: P1（可延至 MVP 后）  
> **依赖关系**: 依赖 persistence.md（IndexedDB 数据访问）  
> **目标**: 实现本地全文检索，支持 MiniSearch 索引、Web Worker 混合策略、搜索降级

---

## 子任务

### MiniSearch 集成
- [ ] 安装 `minisearch`
- [ ] 创建 `core/search/minisearch-engine.ts`
- [ ] 实现 MiniSearch 实例初始化：配置分词、权重、搜索选项
- [ ] 配置字段权重（对齐 detail.md §11.3.3 Phase 3）：
  - title 权重 3
  - siteName 权重 2
  - author 权重 2
  - excerpt 权重 1.5
  - markdownContent 权重 1
- [ ] 实现 `addDocument(article: SavedArticle)` — 将文章加入索引
- [ ] 实现 `removeDocument(id: string)` — 从索引中移除
- [ ] 实现 `search(query: string, options?): SearchResult[]` — 返回带相关度分数的结果
- [ ] 支持分词搜索、模糊匹配、权重排序

### Web Worker 混合策略
- [ ] 创建 `workers/search.worker.ts`：在 Worker 中运行 MiniSearch
- [ ] 实现启动全量重建：插件启动时从 IndexedDB 加载全部文章 → 构建完整索引
- [ ] 实现运行时增量更新：`saveArticle` 成功后 → Worker 增量添加
- [ ] 实现 `deleteArticle` 成功后 → Worker 增量移除
- [ ] 实现消息协议：主线程 ↔ Worker 通信（`BUILD_INDEX` / `SEARCH` / `ADD_DOC` / `REMOVE_DOC`）
- [ ] 实现防抖搜索：用户输入 300ms 后触发 Worker 搜索
- [ ] 实现搜索取消：新搜索到达时中断旧搜索（通过 `AbortController` 或消息 ID）

### 搜索页面 UI
- [ ] 实现搜索工具栏（对齐 design.html Tab 3 §3.1）：
  - 搜索框（带搜索图标 + placeholder）
  - 快捷标签过滤器（全部 / #AI / #知识管理 / #Obsidian 等动态生成）
- [ ] 搜索结果列表：卡片样式展示匹配文章
- [ ] 高亮匹配关键词：搜索结果中关键词用 `<mark>` 标签高亮
- [ ] 搜索统计显示："找到 N 篇匹配文章" / "共 N 篇文章"
- [ ] 搜索无结果状态：显示「未找到匹配的文章」+ 建议调整搜索词

### 搜索降级策略
- [ ] 实现搜索降级链：
  1. MiniSearch 全文检索（优先）
  2. 降级到 IndexedDB `searchArticles(keyword)` — 简单 `string.includes`
  3. 降级到内存全量遍历（即使 500 篇 < 5ms，对齐 detail.md §11.3.3 Phase 1）
- [ ] 实现降级检测：MiniSearch 索引未就绪/Worker 异常 → 自动降级
- [ ] 降级时 UI 提示：「索引构建中，当前使用简易搜索」

### 搜索优化
- [ ] 搜索结果缓存：相同 query 缓存 30 秒
- [ ] 搜索历史记录（本地存储最近 10 条）
- [ ] 空搜索时显示搜索历史 + 热门标签

---

## 验收标准

- [x] 输入关键词后 500ms 内返回搜索结果
- [x] 搜索结果按相关度排序，title 命中权重大于正文
- [x] Worker 构建索引时不影响 Popup UI 交互
- [x] 搜索降级链路全部可用
- [x] 搜索高亮正确显示

## 依赖模块

- `persistence.md` — IndexedDB 数据访问

## 关联文件

- `detail.md` §3.7 文章库模块搜索功能
- `detail.md` §11.3.3 搜索优化路径
- `design.html` Tab 3 我的大脑的搜索工具栏
