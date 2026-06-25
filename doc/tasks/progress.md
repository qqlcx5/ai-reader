# 总体进度 (Project Progress)

## 项目：AI Reader Chrome Extension MV3

---

## 模块进度总览

| 模块 | 状态 | 优先级 | 依赖 |
|------|------|--------|------|
| [底座：Chrome Extension MV3 框架搭建](./foundation.md) | ⬜ 未开始 | P0 | 无 |
| [捕获层：网页解析与数据提取](./perception.md) | ⬜ 未开始 | P0 | 底座 |
| [处理层：多模型配置管理](./model-management.md) | ⬜ 未开始 | P0 | 底座 |
| [处理层：沉浸式侧边栏对话](./chat-with-doc.md) | ⬜ 未开始 | P0 | 底座、模型管理、捕获层 |
| [记忆层：本地存储与同步](./persistence.md) | ⬜ 未开始 | P1 | 底座、捕获层 |
| [唤醒层：本地全文检索](./search.md) | ⬜ 未开始 | P1 | 底座、捕获层 |
| [唤醒层：历史时间轴](./timeline.md) | ⬜ 未开始 | P2 | 底座、捕获层 |

---

## 模块详细检查清单

### 底座：Chrome Extension MV3 框架搭建 (Foundation)
- [ ] 项目初始化（WXT + Vue + TS）
- [ ] 目录结构初始化
- [ ] 样式系统搭建（UnoCSS + Reka UI）
- [ ] 状态管理（Pinia + chrome.storage.local）
- [ ] 跨上下文通信封装
- [ ] 图标与资源
- [ ] 开发工具配置（Vitest + ESLint + Prettier）
- [ ] 构建与打包

### 捕获层：网页解析与数据提取 (Perception)
- [ ] Content Script 入口搭建
- [ ] defuddle 集成与正文提取
- [ ] 元数据自动提取
- [ ] 捕获结果标准化
- [ ] 跨上下文通信
- [ ] 持久化到 IndexedDB
- [ ] 通知搜索索引更新
- [ ] 打开 Side Panel 展示

### 处理层：多模型配置管理 (Model Management)
- [ ] 模型配置数据层
- [ ] Options 页面：模型配置 UI
- [ ] API Key 安全存储
- [ ] 测试连接（Ping）
- [ ] 系统提示词配置
- [ ] 模型选择器组件

### 处理层：沉浸式侧边栏对话 (Chat with Doc)
- [ ] Chat 页面 UI 搭建
- [ ] Prompt 构建器
- [ ] SSE 流式通信
- [ ] 流式消息渲染
- [ ] Markdown 渲染器
- [ ] Chat 历史管理
- [ ] 对话状态管理

### 记忆层：本地存储与同步 (Persistence)
- [ ] IndexedDB 数据层搭建
- [ ] 大字段压缩（rawHtml）
- [ ] 手动导出
- [ ] 手动导入
- [ ] WebDAV 配置
- [ ] WebDAV 上传（整包覆盖）
- [ ] WebDAV 拉取（整包覆盖）
- [ ] 同步状态管理

### 唤醒层：本地全文检索 (Search)
- [ ] MiniSearch 集成
- [ ] Web Worker 搭建
- [ ] 主线程搜索客户端
- [ ] 搜索页面 UI
- [ ] 索引增量更新机制
- [ ] 搜索降级策略

### 唤醒层：历史时间轴 (Timeline)
- [ ] 时间轴数据聚合
- [ ] 时间轴页面 UI
- [ ] 日期详情弹窗
- [ ] 统计信息展示
- [ ] 数据刷新机制

---

## 里程碑

### Milestone 1：MVP 可运行（P0 完成）
- [ ] 底座搭建完成
- [ ] 可捕获网页并展示
- [ ] 可配置模型并对话
- [ ] 数据持久化到 IndexedDB

### Milestone 2：功能完整（P0 + P1 完成）
- [ ] 搜索功能可用
- [ ] WebDAV 同步可用
- [ ] 导入导出可用

### Milestone 3：体验优化（全部完成）
- [ ] 时间轴可用
- [ ] 性能优化（万级文档）
- [ ] 错误处理完善
- [ ] 打包发布

---

## 最近更新

- 2026-06-25: 初始化任务列表
- 2026-06-25: **技术评审完成**（详见 [tech-review_2026-06-25.md](./tech-review_2026-06-25.md)）
  - 发现 11 个问题：3 个 Critical + 4 个 High + 4 个 Medium
  - 修复：调整 `activeTab` → `tabs` + `host_permissions`，增加 `action` 字段，添加 Side Panel 触发器任务
  - 创建：[.manifest-checklist.md](../../.manifest-checklist.md) + [CHROMEWEBSTORE.md](../../CHROMEWEBSTORE.md)
  - 修复了 `world: 'MAIN'` 风险、`return true` 异步响应、SW 状态存储等关键问题
- 2026-06-25: **第二阶段实现完成** ✅ **构建验证通过**
  - **底座层 (Foundation)**：WXT + Vue 3 + TS 项目骨架，WXT config 双 Vue 插件问题修复，tsconfig 排除 reference/，Side Panel 触发器（chrome.action.onClicked + setPanelBehavior）
  - **捕获层 (Perception)**：Content Script + defuddle 集成 + 元数据提取 + IndexedDB 持久化
  - **模型管理 (Model Management)**：模型配置数据层 + Options 页面 + API Key 安全存储（chrome.storage.session 加密）+ 测试连接
  - **对话层 (Chat)**：Chat 页面 + SSE 流式（OpenAI/Anthropic 兼容）+ 流式消息渲染 + Markdown 渲染器 + Chat 历史管理
  - **搜索 (Search)**：MiniSearch 集成 + Web Worker + 主线程客户端 + 搜索降级 + 增量更新
  - **时间轴 (Timeline)**：时间轴数据聚合 + 热力图 UI + 日期详情 + 统计
  - **构建状态**：`pnpm build` ✅，`pnpm compile` ✅（vue-tsc 无错误），参考代码 46 个测试文件通过
  - **未实现**：WebDAV 同步（P1 部分）、Options/Side Panel 完整 UI 集成、E2E 测试
