# SuperBrain 开发进度总览

> 最后更新：2026-06-26  
> 项目路径：`/Users/another/Documents/OpenSource/SuperBrain/`

---

## 模块进度表

| # | 模块 | 文件 | 优先级 | 状态 | 依赖 |
|---|---|---|---|---|---|
| 1 | 底座：项目框架搭建 | `foundation.md` | P0 | [ ] 未开始 | — |
| 2 | 捕获层：网页提取与 Markdown 生成 | `perception.md` | P0 | [ ] 未开始 | #1 |
| 3 | 弹窗 UI 层：Popup Shell 与四大视图 | `popup-ui.md` | P0 | [ ] 未开始 | #1, #2 |
| 4 | 处理层：多模型配置管理 | `model-management.md` | P0 | [ ] 未开始 | #1 |
| 5 | 处理层：沉浸式侧边栏对话 | `chat-with-doc.md` | P0 | [ ] 未开始 | #1, #4, #2 |
| 6 | 记忆层：本地存储与同步 | `persistence.md` | P1 | [ ] 未开始 | #1 |
| 7 | 唤醒层：本地全文检索 | `search.md` | P1 | [ ] 未开始 | #6 |
| 8 | 唤醒层：历史时间轴 | `timeline.md` | P2 | [ ] 未开始 | #6 |

---

## 里程碑

### M1 MVP（P0 全部完成）
- [ ] #1 foundation — WXT 项目骨架可构建、可加载
- [ ] #2 perception — 网页提取 + Markdown 生成 Pipeline 完整
- [ ] #3 popup-ui — 四大视图 UI 完整，提取保存闭环可用
- [ ] #4 model-management — 多模型配置可用
- [ ] #5 chat-with-doc — AI 消化对话功能可用
- **验证**：用户可打开 Popup → 提取当前网页 → 保存到 IndexedDB → 在阅读器中查看 → 用 AI 消化文章

### M2 功能完整（P0 + P1 全部完成）
- [ ] #6 persistence — 数据导入/导出 + WebDAV 同步可用
- [ ] #7 search — 全文检索 + 搜索高亮可用
- **验证**：用户可搜索历史文章、导出/导入数据、跨设备同步

### M3 体验优化（全部完成）
- [ ] #8 timeline — 时间轴视图 + 贡献热力图 + 统计面板
- **验证**：全部功能可用，UX 打磨完成，可发布 Chrome Web Store

---

## 依赖关系图

```text
foundation (#1)
├── perception (#2)
│   └── popup-ui (#3)
├── model-management (#4)
│   └── chat-with-doc (#5)
├── persistence (#6)
│   ├── search (#7)
│   └── timeline (#8)
└── (popup-ui 也依赖 perception)
```

---

## 统计

- P0 模块：5 个
- P1 模块：2 个
- P2 模块：1 个
- 总计：8 个模块
