## 3. 核心功能需求 (Functional Requirements)

### 3.1 捕获层（Perception）

#### 3.1.1 网页解析与数据提取 (P0)
* **用户场景**：用户在浏览任意网页（如 CSDN、Medium、Github Issue、微信公众号）时，点击插件或悬浮按钮，无感抓取内容。
* **技术实现**：
  * 采用最新 **Readability.js** 解析算法，提取网页正文，并自动转化为标准 **Markdown** 格式。
  * **元数据提取引擎**：同步抓取以下结构化字段：
    * `Title` (页面标题)
    * `URL` (源链接)
    * `Author` (作者，基于 Schema.org 规范解析)
    * `Publish Date` (发布时间)
    * `Favicon` (网站图标)
    * `SEO Keywords & Description`


### 3.2 处理层（Thinking）—— AI 结构化重塑

本模块参考 **Cherry Studio** 的多模型适配器设计，提供强大的本地多模型调度能力。

#### 3.2.1 多模型配置管理 (P0)
* 支持配置多个主流大模型 API 通道，支持单独开启/禁用。
* **适配渠道**：OpenAI, Anthropic (Claude) Gemini。
* 连接测试（Ping）：提供“测试连接”按钮，实时返回延迟。
* 自定义代理 (API Base URL)：支持用户配置和模型
* 支持设置系统提示词

#### 3.2.3 沉浸式侧边栏对话 (P1)
* 支持类似 Cherry Studio 的 **Chat with Doc** 功能。
* **交互规则**：
  * 自动将当前捕获的网页 Markdown 全文作为上下文（Context Window）注入 Prompt。
  * 用户可在侧边栏提问（例如：“文章里提到的第三个实验的数据支撑是什么？”）。
  * 采用 **SSE (Server-Sent Events) 流式输出**，支持 Markdown 渲染（包含代码高亮、公式解析）。
---

### 3.3 记忆层（Persistence）

同步采用 Cherry Studio 式的整包覆盖备份
设计原则：不作复杂的增量合并，采用 LWW (Last-Write-Wins) 整包覆盖同步 机制
WebDAV 配置字段：

endpoint (WebDAV 服务器地址，如坚果云 https://dav.jianguoyun.com/dav/)
username (账号)
password (应用授权密码，本地加密存储)
backupPath (默认 /AuraMind_Backup/)


同步动作逻辑：

手动导出 (P0)：一键将 IndexedDB 的 documents、chatHistories 以及插件 settings 序列化为单个 auramind_backup.json 文件并下载。
WebDAV 同步流程：

上传云端 (手动)：将本地所有数据整包压缩成一个 auramind_data.json，并计算 updatedAt 时间戳写入 metadata.json。通过 PUT 请求推送到 WebDAV 服务器。
拉取云端：读取云端 metadata.json 的时间戳。若远端时间戳 $>$ 本地，则拉取 auramind_data.json 并覆盖本地 IndexedDB，实现多设备“冷同步”。
技术：JSZip 进行 Gzip 压缩 后再上传


---

### 3.4 唤醒层（Awakening）

#### MiniSearch 本地全文本地检索

数据索引：

在网页端开启一个无感 Web Worker。
每当 documents 表发生写入，Worker 异步为 Markdown 正文及 Title 构建 MiniSearch 内存索引。


检索接口：

支持 title (权重: 3)、markdownContent (权重: 1) 联合检索。
检索响应时间 $\le 50\text{ms}$ (测试基准：5000 篇文档)。

通过 miniSearch.toJSON()。在每次 WebDAV 备份或定期（如每新增 10 篇文章）时，将构建好的索引序列化存入 IndexedDB。
扩展启动时，直接从 IndexedDB 加载 JSON 恢复索引，耗时可从秒级降至毫秒级。

#### 3.4.3 历史时间轴（Timeline）
* **UI 展现**：仿类似 GitHub Contribution Graph 的时间轴视图，按“天/周/月”聚合用户的捕获足迹。


---

| 维度 | 选型组件/方案 | 选型理由 |
| :--- | :--- | :--- |
| **正文提取** | `@mozilla/readability` | 事实上的工业级正文提取标准，针对新闻、博客类布局具备极高的置信度与过滤率。 |
| **富文本转换** | `Turndown` | 支持灵活扩展 GFM 表格、代码块、多媒体格式的 HTML-to-Markdown 转换引擎。 |
| **本地存储** | `Dexie.js` (基于 IndexedDB) | 提供原生 Promise 封装、复合索引查询、多窗口（Side Panel 与 Background）数据并发安全。 |
| **本地搜索引擎** | `MiniSearch` (v0.7+) | 基于 Trie 树的高性能轻量分词引擎，在 O(1) ~ O(n) 复杂度下提供近乎瞬时的全文检索。 |
| **数据同步协议** | `WebDAV` (基于 XML/HTTP) | 兼容坚果云、Nextcloud 及私有 NAS。免除云端存储成本，实现完全的 Local-First 隐私闭环。 |
