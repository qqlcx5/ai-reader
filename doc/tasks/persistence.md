# 记忆层：本地存储与同步 (Persistence)

## 目标
使用 Dexie.js + IndexedDB 本地存储文档、对话、设置，支持手动导出和 WebDAV 整包同步。

## 最小可执行任务

### 1. IndexedDB 数据层搭建
- [ ] 创建 `db/dexie.ts`：Dexie 实例 + 表定义（参考 `storage-utils.ts` 的 `browser.storage.local` 模式，迁移到 Dexie）
  - `documents: 'id, url, title, createdAt, updatedAt'`
  - `chatHistories: 'id, documentId, createdAt, updatedAt'`
  - `settings: 'key, updatedAt'`
- [ ] 创建 `db/schema.ts`：所有类型定义（参考 `types.ts` 的接口定义风格）
- [ ] 创建 `db/migrations.ts`：版本迁移策略（`schemaVersion`，参考 `import-export.ts` 的 `SCHEMA_VERSION`）
- [ ] 实现各表 Repository（参考 `storage-utils.ts` 的 `setLocalStorage` / `getLocalStorage` 模式）

### 2. 大字段压缩（rawHtml）
- [ ] 安装 `lz-string` 依赖（参考 `import-export.ts` 第 8 行的导入）
- [ ] 写入 `rawHtml` 时压缩（`LZString.compressToUTF16`，参考 `import-export.ts` 的用法）
- [ ] 读取时解压（`LZString.decompressFromUTF16`，参考 `import-export.ts`）
- [ ] 可选：Markdown 内容也压缩（评估性能后决定）

### 3. 手动导出
- [ ] 实现 `core/sync/backup-packager.ts`（参考 `import-export.ts` 的 `exportTemplate` 函数）
- [ ] 读取 `documents` + `chatHistories` + `settings` 全量数据（参考 `storage-utils.ts` 的读取模式）
- [ ] 打包为 `ReadChat_backup.json`（参考 `import-export.ts` 的 JSON 打包格式）：
  - `schemaVersion`, `documents`, `chatHistories`, `settings`, `exportedAt`, `version`
- [ ] 触发浏览器下载（参考 `file-utils.ts` 的 `saveFile` 函数）
- [ ] Side Panel / Options 添加"导出备份"按钮（参考 `popup.ts` 的按钮创建）

### 4. 手动导入
- [ ] 实现文件选择（`<input type="file" accept=".json">`，参考 `import-export.ts` 的 `importTemplate`）
- [ ] 解析 JSON 并校验 `schemaVersion`（参考 `import-export.ts` 的 `validateImportedTemplate`）
- [ ] 版本不兼容时提示并拒绝导入（参考 `import-export.ts` 的错误处理）
- [ ] 导入前提示"将覆盖本地数据，是否先导出备份？"（参考 `import-export.ts` 的确认逻辑）
- [ ] 使用 `db.bulkPut()` 写入数据（参考 `storage-utils.ts` 的批量存储模式）
- [ ] 导入完成后重建搜索索引（参考 `search.md` 的索引重建）

### 5. WebDAV 配置
- [ ] 创建 `entrypoints/options/WebDAVSettings.vue`（参考 `settings.html` 和 `managers/general-settings.ts` 的设置页面结构）
- [ ] 表单：服务器地址、用户名、密码、远程目录（参考 `types.ts` 的接口定义）
- [ ] 测试连接按钮（PROPFIND 根目录，参考 `interpreter.ts` 的 `ping` 逻辑）
- [ ] 加密存储密码（参考 `secret-store.ts` 或 `storage-utils.ts` 的存储模式）
- [ ] 保存配置到 `settings` 表（参考 `generalSettings` 的存储模式）

### 6. WebDAV 上传（整包覆盖）
- [ ] 实现 `core/sync/webdav-client.ts`（参考 `obsidian-clipper` 的 `api.ts` 或外部 WebDAV 库）
  - `mkcol(path)`, `put(path, data)`, `get(path)`, `propfind(path)`
- [ ] 实现 `core/sync/sync.service.ts`：`syncUpload()`（参考 `import-export.ts` 的导出逻辑）
- [ ] 读取 IndexedDB 全量数据（参考 `storage-utils.ts`）
- [ ] 生成 `ReadChat_data.json`（含 schemaVersion，参考 `import-export.ts` 的 `SCHEMA_VERSION`）
- [ ] 生成 `metadata.json`（`updatedAt` 时间戳）
- [ ] 使用 `CompressionStream('gzip')` 压缩数据包（原生 API，零依赖）
- [ ] `PUT` 到 `ReadChat_Backup/ReadChat_data.json.gz`
- [ ] `PUT` `metadata.json`
- [ ] UI 进度指示（可选，参考 `popup.ts` 的加载状态）

### 7. WebDAV 拉取（整包覆盖）
- [ ] 实现 `sync.service.ts`：`syncDownload()`（参考 `import-export.ts` 的导入逻辑）
- [ ] `GET metadata.json`，读取远端 `updatedAt`（参考 `import-export.ts` 的时间戳比较）
- [ ] 比较本地 `settings.lastSyncAt`（参考 `storage-utils.ts` 的时间戳存储）
- [ ] 若远端更新：
  - 保存本地快照（`ReadChat_snapshot_<timestamp>.json`，参考 `import-export.ts` 的备份逻辑）
  - `GET ReadChat_data.json.gz`
  - 解压（`DecompressionStream('gzip')`）
  - 校验 schemaVersion（参考 `import-export.ts` 的 `validateImportedTemplate`）
  - `clear()` 本地表 + `bulkPut()` 远端数据（参考 `storage-utils.ts` 的批量操作）
  - 更新 `lastSyncAt`
  - 重建搜索索引（参考 `search.md`）
- [ ] 若本地更新：提示"本地已是最新"
- [ ] 冲突时提示"远端将覆盖本地"，需用户确认（参考 `import-export.ts` 的确认弹窗）

### 8. 同步状态管理
- [ ] ✅ **使用 `chrome.storage.session` 存储 Background 中的同步状态**（参考 chrome-extensions 规则 #7）：
  ```ts
  // SW 是 ephemeral，不能使用全局变量
  const { syncState = 'idle' } = await chrome.storage.session.get('syncState');
  await chrome.storage.session.set({ syncState: 'syncing' });
  ```
- [ ] 状态：idle / syncing / success / error（参考 `interpreter.ts` 的请求状态）
- [ ] 上次同步时间展示（参考 `storage-utils.ts` 的时间戳显示）
- [ ] 自动同步（可选：启动时检测，参考 `background.ts` 的启动逻辑）

---

## 验收标准
- [ ] 万级文档 IndexedDB 读写流畅（参考 `storage-utils.ts` 的存储性能）
- [ ] 导出 JSON 可在新浏览器完整导入恢复（参考 `import-export.ts` 的导出格式）
- [ ] WebDAV 上传/下载 100MB 数据包不崩溃（参考 `CompressionStream` 的性能）
- [ ] 同步冲突时用户有明确选择，不丢失数据（参考 `import-export.ts` 的确认逻辑）
- [ ] 压缩后数据包体积减少 ≥50%（参考 `lz-string` 的压缩率）

## 依赖模块
- `db/dexie.ts`（所有表，参考 `storage-utils.ts` 的存储模式）
- `workers/search.worker.ts`（同步后重建索引，参考 `search.md`）
- `entrypoints/options/`（配置页面，参考 `settings.html` 和 `managers/`）

## 参考资料
- [chrome-extensions] skill - Storage 规范
- `obsidian-clipper/storage-utils.ts` - 存储封装
- `obsidian-clipper/import-export.ts` - 导入导出
- 选型表：CompressionStream('gzip') 原生 API
