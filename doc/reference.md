## 4. 技术架构

### 4.1 技术栈

| 层级 | 技术选型 |
|------|---------|
| 样式 | SCSS |
| 测试 | Vitest + jsdom |
| 内容提取 | defuddle |
| 日期处理 | dayjs |
| 本地存储压缩 | lz-string（大字段压缩，如 rawHtml） |
| 图标 | Lucide |
| HTML 净化 | DOMPurify |
| 代码高亮 | highlight.js |
| 技术维度 | 选型方案 | 引入理由与技术优势 |
| **样式与 UI 库** | `UnoCSS` + `Reka UI` | UnoCSS 极致的按需编译，零 runtime 开销；Reka UI 提供无样式原语，便于像素级还原冷淡风视觉。 |
| **状态跨端同步** | `Pinia` + `PersistedState` | 基于 `chrome.storage.local` 实现 Pinia 序列化器，保障 Popup 与 Side Panel 的状态秒级互通。 |
| **流式解析(核心)** | `eventsource-parser` | 替代不稳定原生解析，彻底解决多字节字符（中文）在网络 Chunks 截断时产生的乱码与格式断裂问题。仅需支持 OpenAI 兼容格式（`/v1/chat/completions`）。 |
| **备份压缩** | `CompressionStream('gzip')` | 原生 API（Chrome 80+），零依赖，替代 JSZip/pako。 |
| **海量数据库** | `Dexie.js` / `idb-keyval` | 规避 5MB 限制，完美承载 **百万 Token 级别 (1M+ Tokens)** 的超长文本与上万条历史记录检索，支持 GB 级存储。 |
| **客户端防御** | `DOMPurify` | 在渲染大段模型输出及 RSS 抓取的外部 HTML 时，强制在内存中净化 DOM，彻底阻断跨站脚本攻击 (XSS)。 |
| **浏览器兼容** | `webextension-polyfill` | 统一 Chrome / Firefox 的 `browser.*` API 差异，WXT 内置支持。 |
---

## 5. 文件路径规范

> ReadChat 的目录结构遵循 **WXT 框架约定**，详见 `detail.md` 第 11 节。
> 以下为 obsidian-clipper 的参考目录结构（仅作借鉴，非 ReadChat 结构）。

```
obsidian-clipper/src/              # 参考：obsidian-clipper 目录结构
├── content.ts                     # Content Script（defuddle 用法参考）
├── background.ts                  # Background Service Worker
├── utils/
│   ├── content-extractor.ts       # 内容提取封装（extractPageContent）
│   ├── date-utils.ts              # 日期工具（dayjs）
│   └── filters/                   # Markdown 过滤器
├── managers/
│   ├── template-manager.ts        # 模板管理
│   └── highlights-manager.ts      # 高亮管理
└── types/
    └── types.ts                   # 核心类型定义
```
