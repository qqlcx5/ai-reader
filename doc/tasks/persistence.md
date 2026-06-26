# 记忆层：本地存储与同步 (P1)

> **模块名称**: persistence  
> **优先级**: P1（数据持久化）  
> **依赖关系**: 依赖 foundation.md（IndexedDB 框架、chrome.storage 封装）  
> **目标**: 实现混合存储方案（IndexedDB 文章 + chrome.storage 设置），支持大字段压缩、手动导入/导出、WebDAV 同步

---

## 子任务

### IndexedDB 数据层
- [ ] 创建 `db/schema.ts`：定义 IndexedDB schema
- [ ] 安装 Dexie.js：`dexie`
- [ ] 实现 `IndexedDBManager` 类：数据库初始化 + 版本迁移
- [ ] 创建 `documents` store（对齐 detail.md §3.5 articles store）：
  - 主键：`id` (string)
  - 索引：`url` (unique)、`createdAt`、`updatedAt`、`siteName`、`title`
- [ ] 创建 `chatHistories` store：
  - 主键：`id` (string)
  - 索引：`articleId`、`createdAt`
- [ ] 创建 `settings` store（本地缓存，主存储仍在 chrome.storage.sync）：
  - 主键：`key` (string)

### ArticleRepository
- [ ] 创建 `db/article.repository.ts`：封装 articles store CRUD
- [ ] 实现 `saveArticle(article: SavedArticle): Promise<SavedArticle>`
  - 重复 URL 检查：若已存在同一 URL → 覆盖更新，保留 `createdAt`，更新 `updatedAt`
- [ ] 实现 `getArticle(id: string): Promise<SavedArticle | undefined>`
- [ ] 实现 `getArticleByUrl(url: string): Promise<SavedArticle | undefined>`
- [ ] 实现 `listArticles(): Promise<SavedArticle[]>` — 按 `createdAt` 降序
- [ ] 实现 `searchArticles(keyword: string): Promise<SavedArticle[]>`
- [ ] 实现 `deleteArticle(id: string): Promise<void>`
- [ ] 实现 `getArticleCount(): Promise<number>`

### SettingsRepository
- [ ] 创建 `db/settings.repository.ts`：封装 chrome.storage.sync 读写
- [ ] 实现 `getSettings(): Promise<AppSettings>` — 带默认值回退
- [ ] 实现 `updateSettings(partial: Partial<AppSettings>): Promise<AppSettings>`
- [ ] 实现 `resetSettings(): Promise<AppSettings>` — 恢复默认值
- [ ] 实现 schema version 检查：`pagemind_version` key，支持迁移

### 大字段压缩
- [ ] 安装 `lz-string`
- [ ] 实现 `compressRawHtml(html: string): string` — lz-string 压缩
- [ ] 实现 `decompressRawHtml(compressed: string): string` — lz-string 解压
- [ ] `saveArticle` 时自动压缩 `contentHtml` 字段（若存在且 > 10KB）
- [ ] `getArticle` 时自动解压 `contentHtml` 字段

### 手动导出
- [ ] 创建 `core/sync/export.service.ts`
- [ ] 实现 `exportToFile(): Promise<void>` — 导出 `ReadChat_backup.json`
- [ ] JSON 结构：`{ schemaVersion: 1, exportedAt: string, articles: SavedArticle[], chatHistories: ChatSession[], settings: AppSettings }`
- [ ] 触发浏览器下载：`Blob` + `URL.createObjectURL` + `<a>.click()`
- [ ] 文件命名：`SuperBrain_backup_YYYYMMDD_HHmmss.json`

### 手动导入
- [ ] 创建 `core/sync/import.service.ts`
- [ ] 实现 `importFromFile(file: File): Promise<ImportResult>`
- [ ] 导入验证：检查 `schemaVersion` 兼容性
- [ ] 分流合并策略：按 `id` 判断新增/覆盖，保留最新 `updatedAt`
- [ ] 导入进度报告：新增 N 篇 / 覆盖 M 篇 / 跳过 K 篇 / 错误 E 条
- [ ] 导入后自动刷新 LibraryView

### WebDAV 同步
- [ ] 创建 `core/sync/webdav.service.ts`
- [ ] 安装 WebDAV 客户端库（`webdav` npm 包）
- [ ] 实现 WebDAV 配置存储：`webdav_url` / `webdav_username` / `webdav_password`（密码 AES-GCM 加密）
- [ ] 实现 `pushToWebDAV()`：整包上传（`SuperBrain_backup.json`）
- [ ] 实现 `pullFromWebDAV()`：下载远程备份文件
- [ ] 实现 LWW（Last-Writer-Wins）冲突策略：比较本地与远程 `exportedAt` 时间戳
- [ ] 实现静默同步：每天自动执行一次（通过 `chrome.alarms` API）
- [ ] 实现同步状态指示器：
  - 绿色圆点 = 已同步
  - 黄色圆点 = 同步中
  - 红色圆点 = 同步失败
  - 灰色圆点 = 未配置

### 存储空间管理
- [ ] 实现存储空间估算：`navigator.storage.estimate()`
- [ ] 在 SettingsView 显示存储使用量（"SQLite Size: X.X MB"）
- [ ] 实现「清理全部文章」功能（带二次确认）

---

## 验收标准

- [x] 文章保存到 IndexedDB，关闭 Popup 重新打开后数据仍在
- [x] 重复 URL 保存时覆盖更新，保留原始 createdAt
- [x] 导出的 JSON 可成功导入另一台设备
- [x] WebDAV 配置后可完成一次完整的推拉同步
- [x] 存储使用量正确显示

## 依赖模块

- `foundation.md` — IndexedDB 初始化、chrome.storage 封装
- `model-management.md` — AES-GCM 加密工具复用

## 关联文件

- `detail.md` §3.5 存储模块
- `detail.md` §11.2.1 IndexedDB 跨上下文访问限制
- `design.html` Tab 4 设置页的备份恢复 UI
