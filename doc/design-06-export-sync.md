# M6 导出、同步与跨端备份（Export & Sync）详细设计

> **版本**：v1.1
> **对应 PRD**：v3.2 第二章「模块 4：跨端输出与灾备同步」
> **设计原则**：导出模块只做格式转换和传输，不依赖 LLM；所有导出目标独立为插件式 Adapter，便于扩展。

---

## Coverage Status

> 基于 `/reference/obsidian-clipper` 与 `/reference/nextai-translator` 源码分析。

| 需求项 | 覆盖状态 | 参考实现 | 备注 |
|--------|---------|---------|------|
| 多种保存行为（直接写入 / 本地文件 / 剪贴板） | **已覆盖** | obsidian-clipper | `ObsidianSettingsProvider` 三种模式 + `sendToClipboard()` + `createNote()` |
| Obsidian URI 直写 | **已覆盖** | obsidian-clipper | `utils.ts` → `createUri()` 生成 `obsidian://adv-uri?vault=...`，`sendToObsidian()` |
| Remotely Save 插件同步 | **部分覆盖** | obsidian-clipper | 文档建议安装，未直接调用 |
| WebDAV / S3 远程备份 | **已覆盖** | obsidian-clipper | 配置中支持 `syncTarget: 'webdav'`/`s3`，Remotely Save 插件处理 |
| Zip 打包导出 | **未覆盖** | — | obsidian-clipper 不做 Zip |
| 双轨资产备份 | **未覆盖** | — | obsidian-clipper 只处理内容，不做资产备份 |
| 浏览器间设置同步（chrome.storage.sync + lz-string） | **未覆盖** | — | 两个项目均无跨浏览器同步 |

**综合评估**：Obsidian 直写成熟方案可直接迁移。增量需求为：多种保存行为 UI、WebDAV/S3 直连、Zip 导出、资产备份、跨浏览器设置同步。

**优先级建议**：P5 — 依赖 M7 存储层提供导出数据。

---

## 1. 设计目标

- 实现多种保存行为：直接写入 Obsidian、保存为本地文件（`.md` / `.html`）、复制到剪贴板。
- 支持 Obsidian URI 直写：通过 `obsidian://adv-uri?` 协议将笔记按用户预设模板写入指定 Vault/路径/文件夹。
- 支持远程备份：WebDAV / S3 / Remotely Save 插件三种通道。
- 支持 Zip 打包导出：将对话历史 + 上下文页面快照 + 关联资产打包为 `.zip`。
- 实现双轨资产备份：备份原文网页（离线 .mhtml）+ Obsidian Markdown 笔记（含引用链接）双向关联。
- 实现浏览器间设置同步：通过 `chrome.storage.sync` + `lz-string` 压缩同步用户配置（Provider、模板、设置）。

---

## 2. 职责边界

| 职责 | 属于本模块 | 不属于本模块 |
|---|---|---|
| 多种保存行为 | ✅ |  |
| Obsidian URI 直写 | ✅ |  |
| WebDAV / S3 远程备份 | ✅ |  |
| Zip 打包导出 | ✅ |  |
| 双轨资产备份 | ✅ |  |
| 浏览器间设置同步 | ✅ |  |
| 会话/对话数据存储 |  | M7 |
| 提示词模板定义 |  | M4 |
| LLM 调用 |  | M3 |

---

## 3. 核心数据结构

### 3.1 导出配置

```ts
// modules/export/types.ts
export interface ExportConfig {
  /** 默认保存行为 */
  defaultSaveBehavior: 'direct-obsidian' | 'local-file' | 'clipboard';
  /** Obsidian 配置 */
  obsidian: {
    vault: string;
    path: string;
    template: string;
    /** 是否使用 Remotely Save 同步 */
    remotelySave?: boolean;
  };
  /** 远程备份配置 */
  remote: {
    type: 'webdav' | 's3';
    webdav?: { url: string; username: string; password: string };
    s3?: { bucket: string; endpoint: string };
  };
  /** 导出格式 */
  format: 'md' | 'html';
  /** 是否自动备份 */
  autoBackup: boolean;
  /** 资产备份 */
  assetBackup: {
    enabled: boolean;
    /** 同时保存离线 HTML 快照 */
    saveMhtml: boolean;
  };
}

export interface ExportResult {
  success: boolean;
  /** 输出文件路径列表（本地导出时） */
  filePaths?: string[];
  /** Obsidian URI */
  uri?: string;
  /** 备份位置 */
  backupUrl?: string;
  error?: { code: string; message: string };
}

export interface ExportPayload {
  /** 对话标题 */
  title: string;
  /** 对话内容（Markdown） */
  content: string;
  /** 来源 URL */
  sourceUrl: string;
  /** 标签 */
  tags?: string[];
  /** 上下文页面快照（MHTML 用于资产备份） */
  mhtmlSnapshot?: Blob;
}
```

### 3.2 同步配置

```ts
export interface SyncableSettings {
  /** 版本号，用于冲突解决 */
  version: number;
  /** 最后修改时间戳 */
  lastModified: number;
  /** Provider 配置列表 */
  providers: ProviderConfig[];
  /** 模板列表 */
  templates: PromptTemplate[];
  /** 导出配置 */
  exportConfig: ExportConfig;
  /** 全局用户偏好 */
  preferences: Record<string, unknown>;
}
```

---

## 4. 多种保存行为

借鉴 obsidian-clipper 的 `ObsidianSettingsProvider` 三种保存模式：

### 4.1 直接写入 Obsidian（默认）

- 通过 `obsidian://adv-uri?vault=VAULT&filepath=PATH&data=CONTENT` 协议。
- 用户可配置 vault、文件夹路径。
- 写入模板使用 M4 的提示词模板变量系统，支持 `{{content}}` `{{title}}` `{{url}}` 等。

### 4.2 保存为本地文件

- 调用浏览器 `<a download="filename.md" href="blob:...">` 触发下载。
- 文件名模板：`{{title}}_{{date}}.md` 或 `{{title}}_{{date}}.html`。
- 支持 Markdown 和 HTML 两种格式。

### 4.3 复制到剪贴板

- 使用 `navigator.clipboard.writeText()` 以 Markdown 格式写入剪贴板。
- 用户可选择性粘贴到任意编辑器。
- 借鉴 obsidian-clipper 的 `sendToClipboard()` 函数（处理 Promise 回退兼容性）。

### 4.4 UI

- Side Panel 消息操作区提供三个按钮：发送到 Obsidian / 下载文件 / 复制到剪贴板。
- 默认行为可通过 Options 设置。

---

## 5. Obsidian URI 直写

### 5.1 URI 协议

```
obsidian://adv-uri?vault=<vault_name>&filepath=<path/to/note>&data=<encoded_content>
```

借鉴 obsidian-clipper 的 `createUri(vault, filePath, data)` 实现：

```ts
// modules/export/obsidian.ts
export function createObsidianUri(config: ExportConfig, payload: ExportPayload): string {
  const vault = encodeURIComponent(config.obsidian.vault);
  const filePath = encodeURIComponent(`${config.obsidian.path}/${sanitizeFileName(payload.title)}`);
  const data = encodeURIComponent(applyTemplate(config.obsidian.template, payload));
  return `obsidian://adv-uri?vault=${vault}&filepath=${filePath}&data=${data}`;
}

export function sendToObsidian(uri: string): void {
  window.open(uri, '_self');
}
```

### 5.2 安全约束

- 文件名校验：自动清理非法字符（`/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`），借鉴 obsidian-clipper 的 `sanitizeFileName()`。
- URI 长度限制：Chrome 限制 ≈ 2M，长内容使用剪贴板 + 粘贴中转方案。

---

## 6. 远程备份

### 6.1 WebDAV

- 用户配置 WebDAV URL、用户名、密码（存于 `chrome.storage.local`）。
- 调用 `fetch` + `PUT` 方法写入 Markdown/HTML 文件。
- 自动按日期分目录：`/ai-reader-backup/YYYY-MM/`.

### 6.2 S3

- 通过 AWS Signature V4 签名 fetch 直连，不依赖 AWS SDK。
- 最小化依赖：仅 `crypto.subtle` + 日期/签名算法。

### 6.3 Remotely Save 插件

- 建议用户安装 Obsidian Remotely Save 插件。
- 系统写入 Obsidian 后，插件自动触发 OneDrive / Dropbox / S3 同步。
- 扩展本身不重复实现 Remotely Save 逻辑。

---

## 7. Zip 打包导出

### 7.1 触发场景

- 用户选择多段对话批量导出。
- 导出内容包含：对话 Markdown 文件、页面快照（可选 MHTML）、关联资产说明。

### 7.2 实现

```ts
// modules/export/zip.ts
import JSZip from 'jszip';

export async function exportAsZip(
  conversations: Conversation[],
  options: { includeMhtml: boolean }
): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder('ai-reader-export');

  conversations.forEach((conv) => {
    folder.file(`${sanitizeFileName(conv.title)}.md`, conv.content);
  });

  if (options.includeMhtml) {
    const snapshots = await loadMhtmlSnapshots(conversations);
    snapshots.forEach((s) => folder.file(`${s.title}.mhtml`, s.data));
  }

  return zip.generateAsync({ type: 'blob' });
}
```

---

## 8. 双轨资产备份

### 8.1 概念

- **轨道 A**：网页离线快照（`.mhtml` 格式），使用 `chrome.pageCapture.saveAsMHTML()` 保存。
- **轨道 B**：Obsidian Markdown 笔记，包含原文引用链接，指向轨道 A 的本地路径或 Web 地址。

### 8.2 触发

- 对话创建时，后台静默保存 MHTML 快照到 M7 的 IndexedDB。
- 导出时将其打包为 `.mhtml` 文件。

---

## 9. 浏览器间设置同步

### 9.1 实现方案

- 使用 `chrome.storage.sync` API（限制 100KB / 512 项）作为跨设备同步通道。
- 关键设置（Provider 列表、模板、导出配置、用户偏好）使用 `lz-string` 压缩后存储，以容纳更多数据。
- 大型数据（对话历史、上下文缓存）不同步，仅同步轻量配置。

### 9.2 同步流程

```ts
// modules/export/settings-sync.ts
import { compressToUTF16, decompressFromUTF16 } from 'lz-string';

const SYNC_KEY = 'ai_reader_settings_pack';

export async function syncSettingsToCloud(settings: SyncableSettings): Promise<void> {
  const packed = compressToUTF16(JSON.stringify(settings));
  await chrome.storage.sync.set({ [SYNC_KEY]: packed });
}

export async function loadSettingsFromCloud(): Promise<SyncableSettings | null> {
  const data = await chrome.storage.sync.get(SYNC_KEY);
  if (!data[SYNC_KEY]) return null;
  return JSON.parse(decompressFromUTF16(data[SYNC_KEY]));
}
```

### 9.3 冲突处理

- LWW（Last-Write-Wins）：`lastModified` 时间戳更高的覆盖低者。
- Options 中显示「本地时间 / 云端时间」，提供「强制推送 / 拉取」手动操作按钮。
- 历史版本保留最近 3 份快照于本地 IndexedDB。

---

## 10. 导出格式

### 10.1 Markdown

- 标准 CommonMark 语法。
- 支持 YAML front matter（标题、日期、标签、来源 URL）。
- 支持 Obsidian 扩展语法（Callout、Wiki 链接、Dataview 字段）。

### 10.2 HTML

- 使用 markdown-it 将 Markdown 转为 HTML。
- 嵌入基本 CSS 样式（响应式、代码高亮）。
- 可独立在浏览器中打开阅读。

---

## 11. 组件拆分

```
modules/export/
├── index.ts              # 对外暴露统一导出接口
├── types.ts              # 数据类型
├── adapters/
│   ├── obsidian.ts       # Obsidian URI 直写（借鉴 obsidian-clipper）
│   ├── local-file.ts     # 本地文件下载
│   ├── clipboard.ts      # 剪贴板复制
│   ├── webdav.ts         # WebDAV 上传
│   ├── s3.ts             # S3 上传
│   ├── zip.ts            # Zip 打包
│   └── mhtml.ts          # 离线页面快照
├── settings-sync.ts      # 浏览器间设置同步
├── lz-string/
│   └── compress.ts       # lz-string 压缩工具
└── templates/
    └── format.ts         # 导出模板格式化
```

---

## 12. 错误处理

| 错误场景 | 处理策略 |
|---|---|
| Obsidian 未安装 | 提示用户安装 Obsidian 及 Advanced URI 插件，或改用本地文件 |
| URI 超长（>2M） | 自动降级为剪贴板 + 粘贴方案 |
| WebDAV/S3 连接失败 | 重试 3 次（指数退避），仍失败则提示且跳过 |
| 本地文件下载被拦截 | 提示用户检查浏览器下载设置 |
| chrome.storage.sync 配额超限 | 提示用户清理旧配置，优先同步最重要的 Provider 设置 |
| MHTML 快照失败 | 静默跳过，不阻塞主导出流程 |
| 剪贴板写入失败 | 降级为显示文本 + 手动复制提示 |

---

## 13. 测试策略

- **单元测试**：
  - `createObsidianUri()` 输出正确性。
  - `sanitizeFileName()` 非法字符过滤。
  - `lz-string` 压缩/解压往返一致性。
  - LWW 冲突解决逻辑。
- **集成测试**：
  - WebDAV mock server 验证写入。
  - Zip 打包文件列表完整性。
  - chrome.storage.sync mock 验证同步。
- **回归测试**：
  - 各 Adapter 的错误边界与降级路径。

---

## 14. 依赖契约

| 依赖模块 | 契约 |
|---|---|
| M4 Chat Workspace | 提供提示词模板变量解析；导出消息的格式化为 Markdown |
| M7 Storage & Data | 提供导出数据（对话、模板、Provider 配置）；存储 MHTML 快照 |
| chrome.storage.sync | 浏览器间同步通道（限制 100KB） |
