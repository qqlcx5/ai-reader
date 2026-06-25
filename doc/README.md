## 1. 总体架构

1. **捕获层 Perception**
   - 网页正文提取（defuddle）
   - 元数据抓取（defuddle 内置）
   - Markdown 结构化输出（defuddle 内置 `createMarkdownContent()`）

2. **处理层 Thinking**
   - 多模型配置管理
   - 侧边栏 Chat with Doc
   - SSE 流式 AI 回复

3. **记忆层 Persistence**
   - IndexedDB 本地存储
   - 手动导出
   - WebDAV 整包同步
   - LWW 覆盖策略

4. **唤醒层 Awakening**
   - 本地全文检索
   - 时间轴视图

5. **底座**
   - Chrome Extension MV3
   - Dexie + IndexedDB
   - Web Worker
   - MiniSearch
   - SSE 流式通信（eventsource-parser，仅 OpenAI 兼容格式）

---

# 2. 核心模块拆解

## 2.1 捕获层：网页解析与数据提取
### 目标
用户点击插件后，通过 **defuddle** 自动从任意网页提取：
- 正文 Markdown（`defuddle` 内置 `createMarkdownContent()`）
- 标题、URL、作者、发布时间
- favicon、image
- SEO description/keywords
- wordCount、language
- schema.org 结构化数据

---

## 2.2 处理层：多模型配置管理
### 目标
统一采用 **OpenAI 兼容格式**（`/v1/chat/completions`），通过自定义 Base URL 接入不同供应商（DeepSeek / 通义 / OpenRouter 等均兼容），允许：
- 单独启用/禁用
- 自定义 Base URL
- 测试连接 Ping
- 系统提示词配置

## 2.3 处理层：沉浸式侧边栏对话
### 目标
用户在侧边栏中对当前网页内容提问，AI 基于整篇 Markdown 文本回答。

### 关键点
- 当前捕获文档作为 **Context Window**
- 支持流式输出
- 支持 Markdown 渲染


## 2.4 记忆层：本地存储与同步
### 存储建议
使用 **Dexie.js + IndexedDB**，拆成三张核心表：
- `documents`
- `chatHistories`
- `settings`

### 手动导出
导出为单个：
- `ReadChat_backup.json`

内容包含：
- `schemaVersion`（用于未来数据迁移）
- documents
- chatHistories
- settings
- 导出时间
- 版本号

### WebDAV 同步方案
采用你定义的 **整包覆盖 + LWW** 策略，足够简单稳定。

#### 同步逻辑
1. 本地打包所有数据
2. 写入 `ReadChat_data.json`
3. 写入 `metadata.json`
4. 使用原生 `CompressionStream('gzip')` 压缩后再上传
5. PUT 到 WebDAV

#### 拉取逻辑
1. 先读远端 `metadata.json`
2. 比较远端 `updatedAt` 和本地 `updatedAt`
3. 若远端更大，则拉取 `ReadChat_data.json`
4. 覆盖本地 IndexedDB

边界情况
- 在同步前保存一个本地快照
- 在冲突时提示“远端覆盖本地”

---

## 2.5 唤醒层：本地全文检索
### 目标
当 documents 写入后，异步更新本地搜索索引，实现秒级甚至毫秒级检索。

### 索引字段
- `title` 权重 3
- `markdownContent` 权重 1

### Worker 机制（混合策略）
- **启动时全量重建**：Worker 初始化时从 Dexie 读取全部 documents，一次性 `addDocuments()` 构建完整索引（万级文档 < 1s）
- **运行时增量更新**：捕获/删除文档后通过 `postMessage` 通知 Worker，Worker 执行 `addDocument()` / `remove()` 局部更新，无需重建
- 主线程只负责查询结果展示
- Worker 内部独立创建 Dexie 实例读取 documents 表

---

## 2.6 历史时间轴
### 目标
显示用户按天/周/月的捕获足迹，类似 GitHub Contribution Graph。

### 数据聚合
按 `createdAt` 聚合：
- 日维度：当天捕获数
- 周维度：每周活跃度
- 月维度：每月总量

### UI 建议
- 贡献热力图
- 时间范围筛选
- 点击某一天查看文档列表


4.1 技术栈

| 层级 | 技术选型 |
|------|---------|
| 测试 | Vitest + jsdom |
| 内容提取 | defuddle |
| 日期处理 | dayjs |
| 本地存储压缩 | lz-string（大字段压缩，如 rawHtml） |
| 图标 | Lucide |
| HTML 净化 | DOMPurify |
| 代码高亮 | highlight.js |
| 技术维度 | 选型方案 | 引入理由与技术优势 |
| **样式与 UI 库** | `UnoCSS` + `Reka UI` | UnoCSS 极致的按需编译，零 runtime 开销；Reka UI 提供无样式原语，便于像素级还原冷淡风视觉。 |
| **状态跨端同步** | `Pinia` + `PersistedState` | 基于 `chrome.storage.local` 实现 Pinia 序列化器，保障 Popup 与 Side Panel 的状态秒级互通。 |
| **流式解析(核心)** | `eventsource-parser` | 替代不稳定原生解析，彻底解决多字节字符（中文）在网络 Chunks 截断时产生的乱码与格式断裂问题。仅需支持 OpenAI 兼容格式（`/v1/chat/completions`）。 |
| **备份压缩** | `CompressionStream('gzip')` | 原生 API（Chrome 80+），零依赖，替代 JSZip/pako。 |
| **海量数据库** | `Dexie.js` / `idb-keyval` | 规避 5MB 限制，完美承载 **百万 Token 级别 (1M+ Tokens)** 的超长文本与上万条历史记录检索，支持 GB 级存储。 |
| **客户端防御** | `DOMPurify` | 在渲染大段模型输出及 RSS 抓取的外部 HTML 时，强制在内存中净化 DOM，彻底阻断跨站脚本攻击 (XSS)。 |
