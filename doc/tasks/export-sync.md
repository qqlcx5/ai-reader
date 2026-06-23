# M7 跨端导出与灾备同步 — Vibe Coding 任务清单 (v1)

> **目标**：实现本地 ZIP 全量备份（Web Worker 进度条）、全量导入合并（两种策略）、WebDAV 双向增量同步、Obsidian URI 直写、本地文件导出，以及浏览器间设置同步（lz-string 压缩分片）。
> **输入**：`doc/proposal_v1.md` §2.6
> **依赖**：M8（存储层）

---

## 1. 全量导出（ZIP 本地备份）

- [x] 安装 `jszip`
- [x] 实现 `lib/export/zip.worker.ts`（Web Worker）
  - 接收 `{ type: 'EXPORT_ALL' }` 消息
  - 从 M8 `Conversations` + `Messages` + `Highlights` + `Templates` + `RSSFeeds` 读取全量数据
  - 构建 ZIP 结构：
    ```
    backup-{timestamp}/
      index.json                   // 所有 Conversation 元数据列表
      articles/{pageId}.md         // 每条记录的正文快照（Markdown）
      chats/{pageId}.json          // 每条记录的完整对话 JSON
      highlights.json              // 全量高亮数据
      templates.json               // 提示词模板
      rss-feeds.json               // RSS 订阅源配置
    ```
  - 每完成一个文件，`postMessage({ progress: N/total, file: filename })`
  - 全部完成后 `postMessage({ done: true, blob })` 触发浏览器下载
- [x] 实现主线程 `lib/export/zip.ts`（Worker 封装）
  - `exportAll(): Promise<void>`：启动 Worker，监听进度
- [x] 实现 `components/export/ExportProgressModal.vue`
  - Modal 展示进度条（紫色填充，150ms 过渡）+ 当前处理文件名
  - 完成时显示"导出成功，已下载到本地"Toast

---

## 2. 全量导入与合并

- [x] 实现 `lib/export/importer.ts`
  - 解析 `.zip` 文件（`jszip.loadAsync(file)`）
  - 读取 `index.json` 获取所有记录 ID
  - 支持两种合并策略（`ImportStrategy`）：
    - **`overwrite`**（覆盖合并）：以导入数据为准，覆盖本地同 `pageId` 的记录
    - **`skip`**（跳过重复项）：保留本地数据，仅导入本地不存在的记录
  - 事务性批量写入 M8（Dexie 事务，保证原子性）
  - 导入完成后返回：`{ imported: N, skipped: M, errors: [] }`
- [x] 实现 `components/export/ImportPanel.vue`
  - 文件拖拽 / 点击上传区域（`input[type=file] accept=".zip"`）
  - 策略选择：单选 Radio（覆盖合并 / 跳过重复）
  - 进度展示 + 完成摘要（导入 N 条，跳过 M 条）

---

## 3. WebDAV 双向同步

- [x] 安装 `webdav` npm 库
- [x] 实现 `lib/export/webdav.ts`
  - `connect(config: WebDAVConfig): WebDAVClient`（config 含 url / username / password / remotePath）
  - `testConnection(): Promise<boolean>`（`PROPFIND /` 验连）
  - **增量上传**：遍历 `Conversations` 主表，对 `updatedAt > lastSyncAt` 的记录，将对应 Markdown PUT 到远程
    ```
    PUT {remotePath}/{domain}/{pageId}-{title}.md
    ```
    - 文件头部附 YAML Frontmatter（含 `title` / `url` / `source_length` / `engine` / `truncation` / `models_applied` / `synced_at`）
  - **下载**：从远程拉取配置 JSON / 模板文件，与本地合并
- [x] 实现 `lib/export/scheduler.ts`（WebDAV 定时同步）
  - `chrome.alarms.create('auto-backup', { periodInMinutes: 7 * 24 * 60 })`（默认每 7 天）
  - `background.ts` 监听 `chrome.alarms.onAlarm`，触发静默备份
  - 支持手动触发：Options 页"立即同步"按钮
- [x] 实现 `components/export/SyncOptionsPanel.vue`
  - WebDAV 服务商选择（坚果云 / Nextcloud / 自定义）
  - 端点 URL / 账号 / 密码输入（密码 `type="password"`）
  - 远程路径配置
  - 【测试连接】按钮（绿色成功 / 红色失败 Toast）
  - 【立即同步】按钮 + 上次同步时间展示
  - 自动同步开关（Toggle）+ 同步间隔下拉

---

## 4. Obsidian URI 直写

- [x] 实现 `lib/export/obsidian.ts`
  - `writeToObsidian(record: ExportRecord, vaultName: string, targetPath: string): void`
  - 构建 URI：`obsidian://new?vault=${vaultName}&file=${encodeURIComponent(path)}&content=${encodeURIComponent(markdown)}`
  - 通过 `chrome.tabs.create({ url: uri })` 触发 Obsidian 本地协议
- [x] 自动生成 YAML Frontmatter：
  ```yaml
  ---
  title: "文章标题"
  source: "https://example.com/article"
  source_length: 4200
  engine: readability
  truncation: false
  models_applied: ["gpt-4o", "claude-3-5-sonnet"]
  created: 2025-01-15T08:00:00Z
  ---
  ```
- [x] Options 设置：Obsidian Vault 名称输入框 + 默认目标路径（如 `AI-Reader/`）

---

## 5. 本地文件导出（单条记录）

- [x] 实现 `lib/export/local-file.ts`
  - `exportAsMarkdown(record): void`：生成含 Frontmatter 的 `.md` 文件，`window.showSaveFilePicker` 或 `<a download>` 触发下载
  - `exportAsHtml(record): void`：将 Markdown 渲染为完整 HTML（含内联 CSS）下载为 `.html`
  - `exportAsText(record): void`：纯文本 `.txt` 下载
- [x] 实现【复制到剪贴板】：`navigator.clipboard.writeText(markdown)`

---

## 6. 浏览器间设置同步（lz-string 分片）

- [x] 安装 `lz-string`
- [x] 实现 `lib/export/settings-sync.ts`
  - `saveSettings(settings: AppSettings): Promise<void>`
    - 将 settings JSON → `lz-string.compressToUTF16(json)`
    - 按 `CHUNK_SIZE=8000` bytes 分片写入 `chrome.storage.sync`
    - key 格式：`settings_chunk_0` / `settings_chunk_1` / ... + `settings_chunks_count: N`
  - `loadSettings(): Promise<AppSettings>`
    - 读取所有 chunk → 拼接 → `lz-string.decompressFromUTF16` → JSON.parse
  - 同步内容：Provider 配置（不含 API Key）/ 提示词模板 / 快捷键设置

---

## 验收标准

1. 点击"全量导出"，进度条更新，ZIP 文件下载成功，解压后结构完整（`index.json` + `articles/` + `chats/` 等）。
2. 导入同一备份 ZIP，选"跳过重复项"后导入 0 条新记录，选"覆盖合并"后全量覆盖成功。
3. WebDAV 连接测试显示绿色"连接成功"，手动同步后坚果云/Nextcloud 上可见 `.md` 文件含正确 Frontmatter。
4. 点击"写入 Obsidian"，Obsidian 应用自动打开并创建对应笔记（需本机安装 Obsidian）。
5. lz-string 分片：20 个模板 JSON 压缩后单片 ≤ 8KB，读取解压后与原始数据一致。
