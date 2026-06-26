# 总体进度 (Project Progress)

## 项目：AI Reader Chrome Extension MV3

---

## 模块进度总览

| 模块 | 状态 | 优先级 | 依赖 |
|------|------|--------|------|
| [底座：Chrome Extension MV3 框架搭建](./foundation.md) | ✅ 已完成 | P0 | 无 |
| [捕获层：网页解析与数据提取](./perception.md) | ✅ 已完成 | P0 | 底座 |
| [处理层：多模型配置管理](./model-management.md) | ✅ 已完成 | P0 | 底座 |
| [处理层：沉浸式侧边栏对话](./chat-with-doc.md) | ✅ 已完成 | P0 | 底座、模型管理、捕获层 |
| [记忆层：本地存储与同步](./persistence.md) | ✅ 已完成 | P1 | 底座、捕获层 |
| [唤醒层：本地全文检索](./search.md) | ✅ 已完成 | P1 | 底座、捕获层 |
| [唤醒层：历史时间轴](./timeline.md) | ✅ 已完成 | P2 | 底座、捕获层 |

---

## 模块详细检查清单

### 底座：Chrome Extension MV3 框架搭建 (Foundation)
- [x] 项目初始化（WXT + Vue + TS）
- [x] 目录结构初始化
- [x] 样式系统搭建（UnoCSS + Reka UI）
- [x] 状态管理（Pinia + chrome.storage.local）
- [x] 跨上下文通信封装
- [x] 图标与资源
- [x] 开发工具配置（Vitest + ESLint + Prettier）
- [x] 构建与打包

### 捕获层：网页解析与数据提取 (Perception)
- [x] Content Script 入口搭建
- [x] defuddle 集成与正文提取
- [x] 元数据自动提取
- [x] 捕获结果标准化
- [x] 跨上下文通信
- [x] 持久化到 IndexedDB
- [x] 通知搜索索引更新
- [x] 打开 Side Panel 展示

### 处理层：多模型配置管理 (Model Management)
- [x] 模型配置数据层
- [x] Options 页面：模型配置 UI
- [x] API Key 安全存储
- [x] 测试连接（Ping）
- [x] 系统提示词配置
- [x] 模型选择器组件

### 处理层：沉浸式侧边栏对话 (Chat with Doc)
- [x] Chat 页面 UI 搭建
- [x] Prompt 构建器
- [x] SSE 流式通信
- [x] 流式消息渲染
- [x] Markdown 渲染器
- [x] Chat 历史管理
- [x] 对话状态管理

### 记忆层：本地存储与同步 (Persistence)
- [x] IndexedDB 数据层搭建
- [x] 大字段压缩（rawHtml）
- [x] 手动导出
- [x] 手动导入
- [x] WebDAV 配置
- [x] WebDAV 上传（整包覆盖）
- [x] WebDAV 拉取（整包覆盖）
- [x] 同步状态管理

### 唤醒层：本地全文检索 (Search)
- [x] MiniSearch 集成
- [x] Web Worker 搭建
- [x] 主线程搜索客户端
- [x] 搜索页面 UI
- [x] 索引增量更新机制
- [x] 搜索降级策略

### 唤醒层：历史时间轴 (Timeline)
- [x] 时间轴数据聚合
- [x] 时间轴页面 UI
- [x] 日期详情弹窗
- [x] 统计信息展示
- [x] 数据刷新机制

---

## 里程碑

### Milestone 1：MVP 可运行（P0 完成）
- [x] 底座搭建完成
- [x] 可捕获网页并展示
- [x] 可配置模型并对话
- [x] 数据持久化到 IndexedDB

### Milestone 2：功能完整（P0 + P1 完成）
- [x] 搜索功能可用
- [x] WebDAV 同步可用
- [x] 导入导出可用

### Milestone 3：体验优化（全部完成）
- [x] 时间轴可用
- [x] 性能优化（万级文档）
- [x] 错误处理完善
- [x] 打包发布

---

## 最近更新

- 2026-06-26: 全部 7 个模块完成。UI 迁移至 Reka UI 基础组件，UnoCSS 品牌色系统对齐 design.html。194 测试全部通过，构建成功。
- 2026-06-25: 初始化任务列表
