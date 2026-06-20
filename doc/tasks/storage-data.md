# M7 存储与数据层 — Vibe Coding 任务清单

> **目标**：搭建 Dexie 数据库、Pinia 跨入口同步、虚拟滚动、Worker 检索与大文本缓存。
> **输入**：`doc/1.md` 技术选型 / 架构红线、`doc/design-07-storage-data.md`
> **建议执行顺序**：最先开始；其他模块均依赖此层。

---

## 1. 依赖安装与数据库初始化

- [ ] 安装 `dexie`、`pinia`、`pinia-plugin-persistedstate`、`vue-virtual-scroller`
- [ ] 创建 `modules/storage/db.ts`
- [ ] 定义 `AiReaderDB` 类，创建 `conversations`、`messages`、`rssItems`、`rssFeeds` 表
- [ ] 配置索引：`conversations.updatedAt`、`messages.conversationId` 等
- [ ] 在 WXT 入口中初始化数据库实例
- [ ] 验证 IndexedDB 成功创建

---

## 2. 数据类型定义

- [ ] 定义 `ConversationRecord`、`MessageRecord`、`ModelResponse`、`RssItemRecord`、`RssFeedRecord`
- [ ] 定义 `Settings`（含 `providers`、`prompts`、`exportConfig`、`rssConfig`、`ui`）
- [ ] 定义 `currentContext` 类型
- [ ] 确保所有模块通过 `modules/storage/types.ts` 统一引用类型

---

## 3. Repository 层

- [ ] 实现 `modules/storage/repositories/conversation.repo.ts`
- [ ] 实现 `modules/storage/repositories/message.repo.ts`
- [ ] 提供：增删改查、按 conversationId 查询、分页、最近更新排序
- [ ] 主表 `conversations` 只存元数据，不存长消息体
- [ ] 对 10,000 条测试数据验证查询性能

---

## 4. Pinia 持久化与跨入口同步

- [ ] 创建 `stores/ui.store.ts`、`stores/context.store.ts`、`stores/settings.store.ts`、`stores/conversation.store.ts`
- [ ] 配置 `pinia-plugin-persistedstate` 序列化到 `chrome.storage.local`
- [ ] 监听 `chrome.storage.onChanged`，在其他入口修改时同步刷新当前 store
- [ ] 在 Popup、Side Panel、Options 中同时打开，验证状态同步

---

## 5. API Key 明文存储（按用户要求）

- [ ] 在 `settingsStore.providers` 中以明文保存 `apiKey`
- [ ] 在 Options UI 中增加红色风险提示：「API Key 以明文存储在本地浏览器」
- [ ] 导出设置时默认排除 `apiKey`
- [ ] 保留加密存储扩展接口（注释或二期开关），不改动调用方

---

## 6. 历史记录虚拟滚动

- [ ] 实现 `components/history/HistoryList.vue`
- [ ] 使用 `vue-virtual-scroller` 的 `RecycleScroller`
- [ ] 绑定 `ConversationRecord` 主表数据
- [ ] 显示标题、预览、更新时间、模式图标
- [ ] 用 10,000 条测试数据验证 DOM 节点数稳定在 ~20 个

---

## 7. Web Worker 全文检索

- [ ] 实现 `modules/storage/search.worker.ts`
- [ ] 接收关键词与消息批次，返回匹配摘要
- [ ] 主线程分批从 `messages` 表读取数据发送给 Worker
- [ ] 实现 Debounce 300ms，避免频繁查询
- [ ] 在主线程做标题快速过滤，Worker 做正文深度检索
- [ ] 用 5,000 条长消息测试检索不阻塞 UI

---

## 8. 大文本分片缓存

- [ ] 实现 `modules/storage/chunk-cache.ts`
- [ ] 使用 `chrome.storage.session` 或 IndexedDB 临时表存储分片
- [ ] 提供 `setChunk` / `getAllChunks` / `clearTransfer` 接口
- [ ] 在 M2 传输完成后清理临时分片
- [ ] 用 100MB 文本测试分片缓存与组装

---

## 9. 数据库迁移

- [ ] 在 `db.ts` 中规划版本升级路径（`this.version(2).stores(...)`）
- [ ] 为 `messages` 增加 FTS 索引（可选，二期）
- [ ] 编写迁移测试用例

---

## 验收标准

1. 10,000 条会话元数据查询耗时 < 100ms。
2. Popup / Side Panel / Options 三处同时修改设置，彼此 1 秒内同步。
3. 100MB 长文本通过分片缓存组装后内容完整无截断。
4. Worker 全文检索 5,000 条长消息时，主线程保持可交互。

---

## 依赖提醒

- **阻塞项**：无，本模块为基础层。
- **后续接入**：所有业务模块（M1~M6、M8）均通过本模块读写数据。
