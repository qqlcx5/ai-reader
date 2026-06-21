# M6 跨端输出与灾备同步 — 开发笔记

> **日期**：2026-06-21
> **状态**：模块已完成，验收通过

## 实际完成情况

### ✅ 核心实现（lib/export/）
- `types.ts` — ExportTask, ExportFormat, ExportTarget, ObsidianOptions, WebDAVOptions, 错误类
- `obsidian.ts` — buildObsidianUri, buildSafeObsidianUri, downloadAsMarkdown, sanitizeFileName
- `markdown.ts` — buildMarkdown, buildFrontMatter, formatMessage（YAML front-matter + Q/A 格式）
- `webdav.ts` — createWebDAVClient（动态导入避免 node 类型）, uploadNote, uploadBackup, ensureDir
- `zip.ts` — exportZip（Web Worker 管理）, downloadZip
- `zip.worker.ts` — JSZip 打包，JSONL messages，manifest + settings
- `scheduler.ts` — computeNextDelay（UTC）, scheduleAutoBackup, cancelAutoBackup
- `backup.ts` — collectBackupSnapshot, performWebDAVBackup, recordBackupSuccess/Error
- `options.ts` — toWebDAVOptions, toObsidianOptions, hasWebDAVConfig, hasObsidianConfig
- `view-models.ts` — Conversation/Message 导出视图模型，桥接 M7 存储记录
- `index.ts` — 统一导出

### ✅ UI 集成
- `components/export/SyncOptionsPanel.vue` — Options 页 Sync Tab 完整表单
  - WebDAV 连接配置 + 测试连接
  - Obsidian Vault 配置
  - 自动备份开关 + 间隔 + 状态显示
  - 手动 zip 导出按钮 + 进度显示
- `components/layout/OptionsLayout.vue` — 激活 Sync Tab 时渲染 SyncOptionsPanel

### ✅ Background 集成
- `entrypoints/background.ts` — `browser.alarms.onAlarm` 监听 `auto-backup` 闹钟
  - 单飞锁防止重复执行
  - 备份成功/失败均记录到 ExportConfig
  - 自动重新调度下一次备份

### ✅ 测试
- 6 个测试文件，52 个单元测试全部通过
- `backup.test.ts` (5), `markdown.test.ts` (8), `obsidian.test.ts` (12), `options.test.ts` (10), `scheduler.test.ts` (7), `webdav.test.ts` (10)

### ✅ 构建验证
- `pnpm compile` (vue-tsc --noEmit): 0 errors
- `pnpm build`: 成功，total 1.15MB
- `pnpm test`: 175/175 通过

## 与设计文档的偏差

### 1. view-models.ts（新增，设计文档未提及）
- **原因**：M7 存储层使用 `ConversationRecord`（metadata-only）和 `MessageRecord`（`modelResponses[]` 数组），但 M6 导出需要扁平化的 `Conversation`/`Message` 视图（单个 role/content/provider 元数据）。`view-models.ts` 提供了 `toConversation`/`toMessages`/`toExportModels` 映射函数。
- **影响**：无功能影响，纯粹是类型桥接层。

### 2. 自动备份调度使用 UTC 而非本地时间
- **原因**：`computeNextDelay` 使用 `Date.UTC` 计算延迟，确保时区无关。设计文档未明确时区策略。
- **影响**：默认备份时间为 UTC 02:00（北京用户为 10:00）。

### 3. yamlEscape 策略
- **原因**：设计文档的 YAML front-matter 示例使用裸 URL（`source: https://...`），但包含 `:` 的值在 YAML 中是潜在的映射分隔符。`yamlEscape` 对 URL scheme（`://`）不做转义，但对包含 `?`、`&`、`{`、`}` 等 YAML 流字符的值进行转义。

### 4. S3 上标为二期
- **原因**：设计文档标注 S3 为可选/二期，当前仅实现 WebDAV。

### 5. Side Panel 「导出到 Obsidian」按钮标为二期
- **原因**：需要 M4 ChatWorkspace UI 添加操作按钮，属于 UI 对接而非核心逻辑。

## 修复的原有 bug

| Bug | 修复 |
|-----|------|
| markdown `yamlEscape` 对 URL 冒号误转义 | 优化转义规则，`://` 不触发转义 |
| obsidian.test.ts 缺少 `vi` 导入 | 添加 `vi` 到 import 声明 |
| scheduler `computeNextDelay` 时区依赖 | 改用 UTC 计算 |
| webdav `uploadBackup` 空 backupPath 产生前导 `/` | 修复路径拼接逻辑 |
| `settingsStore` 应为 `useSettingsStore` | 全部修正 |
| `db.settings` 不存在 | 移除回退，改用 store |
| `chrome.alarms` 无类型定义 | 改用 `browser` 全局 + 运行时收窄 |
| `WebDAVClient` 未导出 | 添加 `export` 关键字 |
| `zip.worker.ts` 引用 `includeApiKeysForExport` | 修正为 `settings.exportConfig.includeApiKeys` |
| `Conversation`/`Message` 类型不存在 | 引入 view-models.ts |
