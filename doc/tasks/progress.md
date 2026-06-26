# progress — 总体进度

> 基于 doc/detail.md v0.2 详细设计
> 技术栈：WXT + Vue 3 + UnoCSS + Pinia + Dexie + defuddle + marked + DOMPurify + MiniSearch

---

## 模块依赖关系

```
domain (无依赖)
  ├── storage (依赖 domain)
  ├── content-script (依赖 domain)
  ├── messaging (依赖 domain)
  │     ├── popup-shell (依赖 messaging, storage)
  │     │     ├── capture-view (依赖 popup-shell, messaging, storage)
  │     │     ├── library-view (依赖 popup-shell, storage)
  │     │     ├── reader-view (依赖 popup-shell, storage)
  │     │     ├── delete (依赖 popup-shell, storage)
  │     │     └── settings (依赖 popup-shell, storage)
  │     └── toast (依赖 popup-shell, settings)
```

---

## 模块状态

| 模块 | 文件 | 优先级 | 状态 |
|---|---|---|---|
| domain | [domain.md](domain.md) | P0 | - [x] 🔄 进行中 |
| storage | [storage.md](storage.md) | P0 | - [x] 🔄 进行中 |
| content-script | [content-script.md](content-script.md) | P0 | - [ ] 未开始 |
| messaging | [messaging.md](messaging.md) | P0 | - [ ] 未开始 |
| popup-shell | [popup-shell.md](popup-shell.md) | P0 | - [ ] 未开始 |
| capture-view | [capture-view.md](capture-view.md) | P0 | - [ ] 未开始 |
| library-view | [library-view.md](library-view.md) | P0 | - [ ] 未开始 |
| reader-view | [reader-view.md](reader-view.md) | P1 | - [ ] 未开始 |
| delete | [delete.md](delete.md) | P1 | - [ ] 未开始 |
| settings | [settings.md](settings.md) | P1 | - [ ] 未开始 |
| toast | [toast.md](toast.md) | P1 | - [ ] 未开始 |

---

## 里程碑

### Milestone 1 — MVP 采集闭环

> 目标：用户可在任意网页提取正文并保存到本地

- [ ] domain
- [ ] storage
- [ ] content-script
- [ ] messaging
- [ ] popup-shell
- [ ] capture-view（核心：提取 → 保存 → 显示）
- [ ] toast（基础：success/error）

### Milestone 2 — 文章管理

> 目标：文章库浏览、搜索、阅读、删除

- [ ] library-view
- [ ] reader-view
- [ ] delete
- [ ] capture-view 完善（RecentSaves、复制、预览）

### Milestone 3 — 设置与完善

> 目标：设置持久化、交互细节打磨

- [ ] settings
- [ ] toast 完善（info 类型、静默模式）
- [ ] reader-view 完善（代码高亮、frontmatter 设置联动）

### Milestone 4 — 测试与打包

> 目标：Chrome Web Store 可发布

- [ ] 单元测试覆盖 domain、storage、content-script
- [ ] 组件测试覆盖所有 View
- [ ] Manifest V3 打包验证
- [ ] Content Script bundle 体积审计（< 50KB gzip）
- [ ] Chrome Web Store 提交准备（图标、截图、描述）

---

## 已有代码状态

| 部件 | 状态 | 说明 |
|---|---|---|
| entrypoints/sidepanel/ | ✅ 已实现 | UI 壳完整，使用 demo data |
| entrypoints/background.ts | 🔶 最小实现 | 仅 sidePanel 行为 |
| entrypoints/content.ts | ❌ 桩代码 | WXT 模板，仅 console.log |
| components/views/ | ✅ 已实现 | 四个 View 的 UI 已完成，需接入真实数据 |
| components/common/ | ✅ 已实现 | ArticleItem, Favicon, SectionHead, SourceInfo, Toast, ConfirmModal |
| components/layout/ | ✅ 已实现 | TopBar, BottomNav |
| Pinia stores | ❌ 未创建 | 需新建 article.store 和 settings.store |
| IndexedDB | ❌ 未创建 | 需新建 Dexie 实例和 Repository |
| messaging | ❌ 未创建 | 需新建跨上下文消息通道 |
| defuddle 接入 | ❌ 未接入 | content.ts 无提取逻辑 |
| marked + DOMPurify | ❌ 未接入 | reader-view 使用自写简单 parser |

---

## 最近更新

- 2026-06-26: 基于 detail.md v0.2 技术评审重构任务列表（PageMind Popup 架构）
- 2026-06-25: 初始化任务列表
