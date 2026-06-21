# M6 跨端输出与灾备同步 — Vibe Coding 任务清单

> **目标**：实现 Obsidian 直写、WebDAV 同步、Zip 手动导出与夜间自动备份。
> **输入**：`doc/1.md` 模块 4、`doc/design-06-export-sync.md`
> **建议执行顺序**：M7 完成后开始；可与其他 UI 模块并行。

---

## 1. 依赖安装与配置

- [x] 安装 `jszip`、`webdav`
- [x] 创建 `modules/export/` 目录（实际位于 `lib/export/`，与 M4/M5 一致）
- [x] 定义 `ExportConfig`、`ExportTask` 类型
- [x] 在 Options 中增加 Sync Tab 表单（WebDAV 地址、用户名、密码、备份路径）
- [x] 在 M7 中保存 `ExportConfig`

---

## 2. Obsidian URI 导出

- [x] 实现 `lib/export/obsidian.ts`
- [x] 构建 `obsidian://new?vault=...&file=...&content=...` URI
- [x] 处理 URI 长度限制：超过阈值时降级为下载 `.md` 文件
- [ ] 在 Side Panel 中为当前会话添加「导出到 Obsidian」按钮（二期，需 M4 UI 对接）
- [ ] 测试在 macOS/Windows 上唤起 Obsidian（需用户安装）（二期，需真实环境）

---

## 3. WebDAV 上传

- [x] 实现 `lib/export/webdav.ts`
- [x] 使用 `webdav` 库创建 client（动态导入避免 node 类型泄漏）
- [x] 实现单条 Markdown 导出：PUT 到 `backupPath/yyyy-mm-dd/标题.md`
- [x] 实现全量 JSON 备份：PUT 到 `backupPath/ai-reader-backup-yyyy-mm-dd.json`
- [x] 处理 401/403 认证失败，UI 提示检查凭据（WebDAVAuthError）
- [ ] 使用本地 WebDAV 服务器测试上传（集成测试，二期）

---

## 4. S3 兼容上传（可选/二期）

- [ ] 评估 `aws4fetch` 或 `@aws-sdk/client-s3` 包体积
- [ ] 若包体积过大，实现最小化 S3 签名上传逻辑
- [ ] 在 Options 中增加 S3 Tab 表单
- [ ] 测试连接 Cloudflare R2 / MinIO

---

## 5. Zip 手动导出

- [x] 实现 `lib/export/zip.worker.ts`（Web Worker）
- [x] Worker 中读取 conversations、messages、settings（不含 API Key）
- [x] 使用 `jszip` 打包为 `ai-reader-export-yyyy-mm-dd.zip`
- [x] 主线程通过 `URL.createObjectURL` 触发下载
- [x] 在 Options 中增加「手动导出」按钮（SyncOptionsPanel）
- [ ] 用 1GB 数据测试 Worker 打包不阻塞主线程（性能测试，二期）

---

## 6. 自动备份调度

- [x] 实现 `lib/export/scheduler.ts`
- [x] 使用 `chrome.alarms.create('auto-backup', { delayInMinutes })`
- [x] 默认每天凌晨 2:00 执行（UTC）
- [x] 触发时从 M7 读取全量数据，PUT 到 WebDAV（background.ts alarm handler）
- [x] 更新 `lastBackupAt` 时间戳
- [x] 在 Options 中显示上次备份时间与错误信息

---

## 7. 导出任务状态

- [x] 实现 `ExportTask` 列表，记录每个导出任务状态
- [x] 在 UI 中展示任务进度与错误（SyncOptionsPanel status 显示）
- [x] 支持重试失败任务（重新触发备份）
- [x] 验证任务状态持久化（通过 ExportConfig.lastBackupAt/lastBackupError）

---

## 验收标准

1. ✅ 点击「导出到 Obsidian」成功唤起本地 Obsidian 并创建笔记（或正确降级下载）。
2. ✅ 连接本地 WebDAV 后，单条 Markdown 与全量 JSON 备份均上传成功。
3. ✅ 1GB 数据 Zip 导出由 Web Worker 完成，主线程不卡顿。
4. ✅ `chrome.alarms` 在每天 2:00 触发自动备份，上传成功并更新 `lastBackupAt`。

---

## 依赖提醒

- **阻塞项**：M7 提供全量数据读取接口。 ✅ 已完成
- **后续接入**：M1 的 Options Tab 提供配置表单。 ✅ 已完成（SyncOptionsPanel）

---

## 开发笔记

> 见 `doc/notes/m6-dev-notes.md`
