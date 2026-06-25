# 记忆层：本地存储与同步 (Persistence)

## 目标
使用 Dexie.js + IndexedDB 本地存储文档、对话、设置，支持手动导出和 WebDAV 整包同步。

## 最小可执行任务

### 1. IndexedDB 数据层搭建
- [ ] 创建 `db/dexie.ts`：Dexie 实例 + 表定义
  - `documents: 'id, url, title, createdAt, updatedAt'`
  - `chatHistories: 'id, documentId, createdAt, updatedAt'`
  - `settings: 'key, updatedAt'`
- [ ] 创建 `db/schema.ts`：所有类型定义（`CapturedDocument`, `ChatHistory`, `Settings`）
- [ ] 创建 `db/migrations.ts`：版本迁移策略（`schemaVersion`）
- [ ] 实现各表 Repository（`document.repository.ts`, `chat.repository.ts`, `settings.repository.ts`）

### 2. 大字段压缩（rawHtml）
- [ ] 安装 `lz-string` 依赖
- [ ] 写入 `rawHtml` 时压缩（`LZString.compressToUTF16`）
- [ ] 读取时解压（`LZString.decompressFromUTF16`）
- [ ] 可选：Markdown 内容也压缩（评估性能后决定）

### 3. 手动导出
- [ ] 实现 `core/sync/backup-packager.ts`
- [ ] 读取 `documents` + `chatHistories` + `settings` 全量数据
- [ ] 打包为 `ReadChat_backup.json`：
  - `schemaVersion`, `documents`, `chatHistories`, `settings`, `exportedAt`, `version`
- [ ] 触发浏览器下载（`URL.createObjectURL` + `<a download>`）
- [ ] Side Panel / Options 添加"导出备份"按钮

### 4. 手动导入
- [ ] 实现文件选择（`<input type="file" accept=".json">`）
- [ ] 解析 JSON 并校验 `schemaVersion`
- [ ] 版本不兼容时提示并拒绝导入
- [ ] 导入前提示"将覆盖本地数据，是否先导出备份？"
- [ ] 使用 `db.bulkPut()` 写入数据
- [ ] 导入完成后重建搜索索引

### 5. WebDAV 配置
- [ ] 创建 `entrypoints/options/WebDAVSettings.vue`
- [ ] 表单：服务器地址、用户名、密码、远程目录
- [ ] 测试连接按钮（PROPFIND 根目录）
- [ ] 加密存储密码（`secret-store.ts`）
- [ ] 保存配置到 `settings` 表

### 6. WebDAV 上传（整包覆盖）
- [ ] 实现 `core/sync/webdav-client.ts`
  - `mkcol(path)`, `put(path, data)`, `get(path)`, `propfind(path)`
- [ ] 实现 `core/sync/sync.service.ts`：`syncUpload()`
- [ ] 读取 IndexedDB 全量数据
- [ ] 生成 `ReadChat_data.json`（含 schemaVersion）
- [ ] 生成 `metadata.json`（`updatedAt` 时间戳）
- [ ] 使用 `CompressionStream('gzip')` 压缩数据包
- [ ] `PUT` 到 `ReadChat_Backup/ReadChat_data.json.gz`
- [ ] `PUT` `metadata.json`
- [ ] UI 进度指示（可选）

### 7. WebDAV 拉取（整包覆盖）
- [ ] 实现 `sync.service.ts`：`syncDownload()`
- [ ] `GET metadata.json`，读取远端 `updatedAt`
- [ ] 比较本地 `settings.lastSyncAt`
- [ ] 若远端更新：
  - 保存本地快照（`ReadChat_snapshot_<timestamp>.json`）
  - `GET ReadChat_data.json.gz`
  - 解压（`DecompressionStream('gzip')`）
  - 校验 schemaVersion
  - `clear()` 本地表 + `bulkPut()` 远端数据
  - 更新 `lastSyncAt`
  - 重建搜索索引
- [ ] 若本地更新：提示"本地已是最新"
- [ ] 冲突时提示"远端将覆盖本地"，需用户确认

### 8. 同步状态管理
- [ ] Pinia store 管理同步状态
- [ ] 状态：idle / syncing / success / error
- [ ] 上次同步时间展示
- [ ] 自动同步（可选：启动时检测）

---

## 验收标准
- [ ] 万级文档 IndexedDB 读写流畅
- [ ] 导出 JSON 可在新浏览器完整导入恢复
- [ ] WebDAV 上传/下载 100MB 数据包不崩溃
- [ ] 同步冲突时用户有明确选择，不丢失数据
- [ ] 压缩后数据包体积减少 ≥50%

## 依赖模块
- `db/dexie.ts`（所有表）
- `workers/search.worker.ts`（同步后重建索引）
- `entrypoints/options/`（配置页面）
