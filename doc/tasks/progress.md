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
| domain | [domain.md](domain.md) | P0 | - [x] ✅ 已完成 |
| storage | [storage.md](storage.md) | P0 | - [x] ✅ 已完成 |
| content-script | [content-script.md](content-script.md) | P0 | - [x] ✅ 已完成 |
| messaging | [messaging.md](messaging.md) | P0 | - [x] ✅ 已完成 |
| popup-shell | [popup-shell.md](popup-shell.md) | P0 | - [x] ✅ 已完成 |
| capture-view | [capture-view.md](capture-view.md) | P0 | - [x] ✅ 已完成 |
| library-view | [library-view.md](library-view.md) | P0 | - [x] ✅ 已完成 |
| reader-view | [reader-view.md](reader-view.md) | P1 | - [x] ✅ 已完成 |
| delete | [delete.md](delete.md) | P1 | - [x] ✅ 已完成 |
| settings | [settings.md](settings.md) | P1 | - [x] ✅ 已完成 |
| toast | [toast.md](toast.md) | P1 | - [x] ✅ 已完成 |

---

## 里程碑

### Milestone 1 — MVP 采集闭环

> 目标：用户可在任意网页提取正文并保存到本地

- [x] domain
- [x] storage
- [x] content-script
- [x] messaging
- [x] popup-shell
- [x] capture-view（核心：提取 → 保存 → 显示）
- [x] toast（基础：success/error）

### Milestone 2 — 文章管理

> 目标：文章库浏览、搜索、阅读、删除

- [x] library-view
- [x] reader-view
- [x] delete
- [x] capture-view 完善（RecentSaves、复制、预览）

### Milestone 3 — 设置与完善

> 目标：设置持久化、交互细节打磨

- [x] settings
- [x] toast 完善（info 类型、静默模式）
- [x] reader-view 完善（代码高亮、frontmatter 设置联动）

### Milestone 4 — 测试与打包

> 目标：Chrome Web Store 可发布

- [x] 单元测试覆盖 domain、storage、content-script（157 个测试全部通过）
- [x] 组件测试覆盖所有 View（CaptureView 43 / SettingsView 21 / LibraryView 15 / ReaderView + extractor + shadow-dom + metadata 78）
- [x] Manifest V3 打包验证（name/description/version 更新，manifest.json 权限正确）
- [x] Content Script bundle 体积优化（双 Content Script 架构：content.js 1.3KB gzip + extract.js 283KB gzip 按需注入）
- [x] Chrome Web Store 提交准备（图标：书本+箭头 PageMind 品牌图标，16/32/48/96/128；Store Listing：doc/tasks/store-listing.md）
- [x] 集成验证报告（doc/tasks/integration-report.md）

---

## 已有代码状态

| 部件 | 状态 | 说明 |
|---|---|---|
| entrypoints/sidepanel/ | ✅ 已实现 | UI 壳完整，全部接入真实数据 |
| entrypoints/background.ts | ✅ 已实现 | 消息路由 + Script 注入泵（content + extract 双注入） |
| entrypoints/content.ts | ✅ 已实现 | 轻量监听（PING），1.3KB gzip |
| entrypoints/extract.content.ts | ✅ 已实现 | 按需注入提取脚本，含 defuddle pipeline |
| components/views/ | ✅ 已实现 | 四个 View 全部完成 | 79 个组件逻辑测试 |
| components/common/ | ✅ 已实现 | ArticleItem, Favicon, SectionHead, SourceInfo, Toast, ConfirmModal |
| components/layout/ | ✅ 已实现 | TopBar, BottomNav |
| Pinia stores | ✅ 已创建 | article.store 和 settings.store 已实现 |
| IndexedDB | ✅ 已创建 | Dexie 实例和 article.repository 已实现 |
| messaging | ✅ 已创建 | 跨上下文消息通道已实现 |
| defuddle 接入 | ✅ 已接入 | extract.content.ts 按需注入 + shadow-dom 扁平化 |
| marked + DOMPurify | ✅ 已接入 | reader-view 使用 marked 渲染 + DOMPurify 消毒 |

---

## 最近更新

- 2026-06-27: Milestone 4 完成 — (1) 组件测试：CaptureView 43 测试 + SettingsView 21 测试，全部 157 通过 (2) Manifest 更新：name/description/version (3) Content Script 双架构优化：content.js 1.3KB gzip + extract.js 283KB gzip 按需注入 (4) 图标：PageMind 书本+箭头品牌图标 16/32/48/96/128 (5) Store Listing：doc/tasks/store-listing.md
- 2026-06-27: content-script 模块完成 — 修复 TS 问题，编写 41 个单元/集成测试并通过，vue-tsc 零 PageMind 类型错误，构建成功
- 2026-06-26: 基于 detail.md v0.2 技术评审重构任务列表（PageMind Popup 架构）
- 2026-06-25: 初始化任务列表
