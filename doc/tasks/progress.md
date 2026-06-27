# SuperBrain 开发进度总览

> 最后更新：2026-06-27  
> 项目路径：`/Users/another/Documents/OpenSource/SuperBrain/`

---

## 模块进度表

| # | 模块 | 文件 | 优先级 | 状态 | 依赖 |
|---|---|---|---|---|---|
| 1 | 底座：项目框架搭建 | `foundation.md` | P0 | [x] 已完成 | — |
| 2 | 捕获层：网页提取与 Markdown 生成 | `perception.md` | P0 | [x] 已完成 | #1 |
| 3 | 弹窗 UI 层：Popup Shell 与四大视图 | `popup-ui.md` | P0 | [x] 已完成 | #1, #2 |
| 4 | 处理层：多模型配置管理 | `model-management.md` | P0 | [x] 已完成 | #1 |
| 5 | 处理层：沉浸式侧边栏对话 | `chat-with-doc.md` | P0 | [x] 已完成 | #1, #4, #2 |
| 6 | 导出与同步层：Obsidian/MDX/JSON 导出 | `export-sync.md` | P0 | [x] 已完成 | #1, #2 |
| 7 | 记忆层：本地存储与同步 | `persistence.md` | P1 | [ ] 未开始 | #1 |
| 8 | 唤醒层：本地全文检索 | `search.md` | P1 | [ ] 未开始 | #6 |
| 9 | 唤醒层：历史时间轴 | `timeline.md` | P2 | [ ] 未开始 | #6 |

---

## 里程碑

### M1 MVP（P0 全部完成）
- [x] #1 foundation — WXT 项目骨架可构建、可加载
- [x] #2 perception — 网页提取 + Markdown 生成 Pipeline 完整
- [x] #3 popup-ui — 四大视图 UI 完整，提取保存闭环可用
- [x] #4 model-management — 多模型配置可用
- [x] #5 chat-with-doc — AI 消化对话功能可用
- [x] #6 export-sync — Obsidian/MDX/JSON 导出 + Variants + I18n
- **验证**：用户可打开 Popup → 提取当前网页 → 保存到 IndexedDB → 阅读器中查看 → AI 消化文章 → 导出为 Obsidian/MDX/JSON

### M2 功能完整（P0 + P1 全部完成）
- [ ] #7 persistence — 数据导入/导出 + WebDAV 同步可用
- [ ] #8 search — 全文检索 + 搜索高亮可用
- **验证**：用户可搜索历史文章、导出/导入数据、跨设备同步

### M3 体验优化（全部完成）
- [ ] #9 timeline — 时间轴视图 + 贡献热力图 + 统计面板
- **验证**：全部功能可用，UX 打磨完成，可发布 Chrome Web Store

---

## 依赖关系图

```text
foundation (#1)
├── perception (#2)
│   └── popup-ui (#3)
├── model-management (#4)
│   └── chat-with-doc (#5)
├── export-sync (#6)
├── persistence (#7)
│   ├── search (#8)
│   └── timeline (#9)
└── (popup-ui 也依赖 perception)
```

---

## 构建大小变化曲线

| 日期 | 构建大小 | 变化 | 说明 |
|---|---|---|---|
| 2026-06-26 | ~1.15 MB | — | foundation + perception + popup-ui + model-management + chat-with-doc |
| 2026-06-27 | **1.38 MB** | +0.23 MB | +export-sync (Obsidian/MDX/JSON + Variants + I18n + ExportPanel) |

### 分模块体积 (2026-06-27)

| 模块 | 大小 | 占比 |
|---|---|---|
| sidepanel.js | 233.27 kB | 16.9% |
| extract.js | 1.00 MB | 72.5% |
| options.js | 8.71 kB | 0.6% |
| plugin-vue-helpers | 89.27 kB | 6.5% |
| background.js | 4.78 kB | 0.3% |
| content.js | 6.19 kB | 0.4% |
| CSS | 26.00 kB | 1.9% |
| Assets | 8.01 kB | 0.6% |

---

## 测试数量变化

| 日期 | 测试文件 | 测试用例 | 变化 |
|---|---|---|---|
| 2026-06-26 | 16 | 184 | foundation + perception + popup-ui + model-management + chat-with-doc |
| 2026-06-27 | **21** | **262** | +5 文件 / +78 用例 (export-sync) |

### export-sync 测试明细

| 文件 | 用例数 | 覆盖内容 |
|---|---|---|
| `core/export/obsidian-exporter.test.ts` | 27 | sanitizeFilename(7) / formatDate(3) / renderYamlFrontmatter(6) / buildFrontmatter(7) / exportArticleObsidian(4) |
| `core/export/mindmap-exporter.test.ts` | 18 | exportMindMapJson(5) / exportMindMapMdx(8) / exportMindMap(2) / parseHeadings(3) |
| `core/export/variants.test.ts` | 11 | listVariants(2) / getVariantExporter(6) / hasVariant(3) |
| `core/export/i18n/index.test.ts` | 13 | getLocale/setLocale(2) / t() simple(5) / t() interpolation(2) / t() missing(2) / t() multi-category(2) |
| `ExportPanel.test.ts` | 9 | rendering(5) / events(1) / batch(1) / content(2) |

---

## 统计

- P0 模块：6 个 — 全部完成
- P1 模块：2 个
- P2 模块：1 个
- 总计：9 个模块
- **MVP 已就绪** — 核心 P0 流程 (捕获 → 保存 → 阅读 → AI 消化 → 导出) 全部可用
