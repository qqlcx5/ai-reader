# M6 跨端输出与灾备同步（Export & Backup）详细设计

> **版本**：v1.0
> **对应 PRD**：第二章「模块 4：跨端输出与灾备同步」
> **设计原则**：导出模块是消费型模块，只读取 M7 数据并转换为外部格式或协议；不修改业务数据。

---

## 1. 设计目标

- 支持 Obsidian URI 直写，一键创建本地笔记。
- 支持 Remotely Save：通过 `webdav` 库将 Markdown 同步到 WebDAV/S3。
- 支持手动导出全量数据为 `.zip`（Web Worker 中打包 Dexie 数据）。
- 支持自动备份：利用 `chrome.alarms` 夜间将全量 JSON 覆盖上传至 WebDAV。
- 双轨资产备份：手动导出 + 自动备份并行，降低误删风险。

---

## 2. 职责边界

| 职责 | 属于本模块 | 不属于本模块 |
|---|---|---|
| Obsidian URI 生成 | ✅ |  |
| WebDAV/S3 上传 | ✅ |  |
| Zip 打包与下载 | ✅ |  |
| 自动备份调度 | ✅ |  |
| 数据存储 |  | M7 |
| 会话内容生成 |  | M4 |
| RSS 数据导出 |  | M8 |

---

## 3. 核心数据结构

### 3.1 导出配置

```ts
// modules/export/types.ts
export interface ExportConfig {
  obsidian: {
    enabled: boolean;
    vaultName: string;
    defaultFolder?: string;
  };
  webdav: {
    enabled: boolean;
    url: string;
    username: string;
    password: string;
    backupPath: string;
  };
  s3: {
    enabled: boolean;
    endpoint: string;
    bucket: string;
    region: string;
    accessKey: string;
    secretKey: string;
    backupPath: string;
  };
  autoBackup: {
    enabled: boolean;
    /** 备份时间，默认 02:00 */
    time: string;
    /** 全量或增量 */
    mode: 'full' | 'incremental';
  };
}
```

### 3.2 导出任务

```ts
export interface ExportTask {
  id: string;
  type: 'obsidian' | 'webdav' | 's3' | 'zip';
  status: 'pending' | 'running' | 'done' | 'error';
  createdAt: number;
  completedAt?: number;
  error?: { code: string; message: string };
}
```

---

## 4. Obsidian URI 直写

### 4.1 URI 构建

```ts
// modules/export/obsidian.ts
export function buildObsidianUri(
  title: string,
  content: string,
  vault: string,
  folder?: string
): string {
  const params = new URLSearchParams();
  params.set('vault', vault);
  params.set('file', folder ? `${folder}/${title}.md` : `${title}.md`);
  params.set('content', content);
  return `obsidian://new?${params.toString()}`;
}
```

### 4.2 长度限制处理

- Obsidian URI 长度受浏览器/系统限制（通常 ~2MB）。
- 超过限制时，降级为下载 `.md` 文件，并在 UI 提示用户手动导入。

### 4.3 跨平台说明

- Windows/macOS/Linux 均支持 `obsidian://` 协议，但需用户已安装 Obsidian 并完成协议注册。
- 若调用失败（无响应），UI 提示检查 Obsidian 安装。

---

## 5. WebDAV / S3 同步

### 5.1 WebDAV

- **库**：`webdav`
- **操作**：
  - `createClient(url, { username, password })`
  - `client.putFileContents(path, content, { overwrite: true })`
- 每个会话/笔记导出为单个 Markdown 文件。
- 全量备份为单个 JSON 文件。

### 5.2 S3

- 使用兼容 S3 API 的服务（Cloudflare R2、MinIO、AWS S3）。
- 通过 `aws4fetch` 或 `@aws-sdk/client-s3`（需评估包体积）。
- 若包体积过大，可手写最小化签名上传逻辑。

### 5.3 文件命名

```ts
function backupFileName(): string {
  const date = new Date().toISOString().split('T')[0];
  return `ai-reader-backup-${date}.json`;
}
```

---

## 6. 手动导出 Zip

### 6.1 打包内容

- 全部 `Conversations` 元数据。
- 全部 `Messages` 完整内容。
- 设置（不含 API Key，避免泄露）。
- RSS 元数据（可选）。

### 6.2 Web Worker 打包

```ts
// modules/export/zip.worker.ts
import JSZip from 'jszip';

self.onmessage = async (event) => {
  const { conversations, messages, settings } = event.data;
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify({ version: '1.0', exportedAt: Date.now() }));
  zip.file('conversations.json', JSON.stringify(conversations));
  zip.file('messages.jsonl', messages.map(JSON.stringify).join('\n'));
  zip.file('settings.json', JSON.stringify(settings));

  const blob = await zip.generateAsync({ type: 'blob' });
  self.postMessage({ blob });
};
```

### 6.3 下载

- Worker 返回 Blob 后，通过 `URL.createObjectURL` 创建临时下载链接。

---

## 7. 自动备份

### 7.1 调度

```ts
// modules/export/scheduler.ts
export async function scheduleAutoBackup(config: ExportConfig): Promise<void> {
  if (!config.autoBackup.enabled) return;

  const [hour, minute] = config.autoBackup.time.split(':').map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);

  const delayInMinutes = Math.ceil((target.getTime() - now.getTime()) / 60000);
  await chrome.alarms.create('auto-backup', { delayInMinutes });
}
```

### 7.2 备份策略

- **默认**：每天凌晨 2:00 执行一次。
- **模式**：全量覆盖（按用户选择，首期实现 full；incremental 作为二期）。
- **目标**：WebDAV（S3 作为二期）。
- 备份完成后更新 `lastBackupAt` 时间戳。

---

## 8. 组件拆分

```
modules/export/
├── index.ts              # 对外暴露导出函数
├── types.ts              # 数据类型
├── obsidian.ts           # Obsidian URI
├── webdav.ts             # WebDAV 上传
├── s3.ts                 # S3 上传（二期）
├── zip.ts                # Zip 打包入口 + Worker 管理
├── zip.worker.ts         # Web Worker 实现
├── scheduler.ts          # chrome.alarms 调度
└── __tests__/
    └── export.mock.ts
```

---

## 9. 错误处理

| 错误场景 | 处理策略 |
|---|---|
| Obsidian 未安装 | 提示用户安装并检查协议注册 |
| URI 超长 | 降级为下载 `.md` 文件 |
| WebDAV 认证失败 | 返回 401，提示检查凭据 |
| 上传超时 | 重试 3 次，失败后记录任务错误 |
| Worker 打包失败 | 主线程显示错误，支持重试 |
| 自动备份冲突 | 使用 alarm name 排他，避免重复执行 |

---

## 10. 安全与隐私

- Zip 导出的 `settings.json` 默认**不包含** API Key。
- WebDAV 凭据由 M7 存储；本模块运行时读取。
- 自动备份文件建议不加密，但文件名可包含随机前缀避免被猜测（可选）。

---

## 11. 测试策略

- **单元测试**：
  - Obsidian URI 构建与长度限制判断。
  - WebDAV 客户端调用封装。
  - Zip 内容结构校验。
- **集成测试**：
  - 连接本地 WebDAV 测试服务器上传下载。
  - 模拟 `chrome.alarms` 触发自动备份。
- **回归测试**：
  - 导出后重新导入，数据一致性校验。

---

## 12. 依赖契约

| 依赖模块 | 契约 |
|---|---|
| M7 Storage & Data | 读取 Conversation、Message、Settings、ExportConfig |
| M4 Chat Workspace | 接收当前会话，导出为 Markdown |
| M1 Entry & Layout | Options 页面提供导出配置 UI |
| M8 RSS Pipeline | 二期可导出 RSS 条目（可选） |
