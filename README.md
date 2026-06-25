## 1. 总体架构

1. **捕获层 Perception**
   - 网页正文提取
   - 元数据抓取
   - Markdown 结构化输出

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
   - SSE / Fetch 流式通信

---

# 2. 核心模块拆解

## 2.1 捕获层：网页解析与数据提取
### 目标
用户点击插件后，自动从任意网页提取：
- 正文 Markdown
- 标题
- URL
- 作者
- 发布时间
- favicon
- SEO description/keywords

---

## 2.2 处理层：多模型配置管理
### 目标
支持 OpenAI / Anthropic / Gemini 等多供应商模型，允许：
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
- `auramind_backup.json`

内容包含：
- documents
- chatHistories
- settings
- 导出时间
- 版本号

### WebDAV 同步方案
采用你定义的 **整包覆盖 + LWW** 策略，足够简单稳定。

#### 同步逻辑
1. 本地打包所有数据
2. 写入 `auramind_data.json`
3. 写入 `metadata.json`
4. JSZip 进行 Gzip 压缩 后再上传
5. PUT 到 WebDAV

#### 拉取逻辑
1. 先读远端 `metadata.json`
2. 比较远端 `updatedAt` 和本地 `updatedAt`
3. 若远端更大，则拉取 `auramind_data.json`
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

### Worker 机制
- `documents` 表变更后通知 Worker
- Worker 异步构建/更新索引
- 主线程只负责查询结果展示

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
