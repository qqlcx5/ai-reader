---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: d270bcd3df6a2cd27c2792fa9a0b45ef_0351a44f6d8f11f18805525400d9a7a1
    ReservedCode1: kMXn2minhVeG2BGXf/4Yr32EOvdIMKKiCLLYmsaeCCfwAMJ1UhBtjWw0XDitEihGHqC/JshW7koMTTwgVSH2cCvafEfm/Gv6gsB3ziftAMQTxs5Yz/lk+7ElkH8D710q6MP6kbhOWpHD0qsRdaw6DH9cLI55VYIKqVcdns92VIOQ7wULtXdRUGtGm38=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: d270bcd3df6a2cd27c2792fa9a0b45ef_0351a44f6d8f11f18805525400d9a7a1
    ReservedCode2: kMXn2minhVeG2BGXf/4Yr32EOvdIMKKiCLLYmsaeCCfwAMJ1UhBtjWw0XDitEihGHqC/JshW7koMTTwgVSH2cCvafEfm/Gv6gsB3ziftAMQTxs5Yz/lk+7ElkH8D710q6MP6kbhOWpHD0qsRdaw6DH9cLI55VYIKqVcdns92VIOQ7wULtXdRUGtGm38=
---

# 模块 07：存储与数据架构

> 对应设计文档：design-07-storage-data.md

## 子任务清单

- [ ] 子任务 1：定义 `AiReaderDB` Dexie Schema（v1），含 8 张表：`conversations`（主表，元数据）、`messagesSummary`（主表，前 200 字符预览）、`messageContents`（副表，完整内容懒加载）、`extractedContexts`（副表，按 URL 索引）、`apiResponseCache`（副表，LRU）、`settings`（键值对）、`highlights`（按域名+URL 索引）、`mhtmlSnapshots`（按 URL 索引）
- [ ] 子任务 2：实现主副表分离设计：主表 `Conversations` 仅存 id/title/date/models 轻量字段；副表 `MessageContents` 存储超长对话 JSON（几十万至百万 Token）；列表页只查主表，点击进入阅读模式时才按 ID 懒加载副表
- [ ] 子任务 3：实现 `dao/conversations.ts` / `dao/messages.ts` / `dao/settings.ts` 三层 DAO：提供 CRUD 接口，消息批量写入使用 `db.transaction('rw', ...)` 单次事务（限制 < 1000 条，超出分批）
- [ ] 子任务 4：实现 L1 内存缓存 `l1-memory.ts`：`Map<string, CachedItem>`，LRU 淘汰策略（最多 10 条），缓存当前页面提取结果 + 最近 API 响应，页面关闭释放
- [ ] 子任务 5：实现 L2 持久化缓存 `l2-persistent.ts`：基于 IndexedDB `extractedContexts` 表，按 `url` 索引，TTL 默认 24h 可配，过期后台静默刷新，命中时跳过 defuddle 提取（节省 2~8s），容量上限 500MB
- [ ] 子任务 6：实现 L3 API 响应缓存 `l3-api.ts`：基于 IndexedDB `apiResponseCache` 表，Key 为 `hash(query + url + content_hash)`，永不过期手动清理，容量上限 200MB，命中时 M4 底栏标注 `⚡ Cached`
- [ ] 子任务 7：实现 `memoize.ts` `memoizeWithExpiration` 工具函数：对模板编译（URL 敏感 Key，5s 过期）、对话历史查询（conversationId 敏感 Key）、Provider 配置读取等高频调用做短期缓存
- [ ] 子任务 8：集成 `pinia-plugin-persistedstate`：将轻量 UI 状态（Side Panel/Popup 模式、最后活动 Tab、UI 偏好、模型选择器勾选状态）持久化到 `localStorage`，排除流式 delta/AbortController 列表/临时 toast
- [ ] 子任务 9：实现 `search.worker.ts` Web Worker 全文检索：使用 MiniSearch 建立倒排索引，从 `messageContents` 表全量加载建索引，新消息增量更新；搜索通过 `postMessage` 异步进行，返回 `messageId[]`，UI 从主表渲染预览（`fuzzy: 0.2` 模糊搜索）
- [ ] 子任务 10：实现虚拟滚动与 rAF 节流联合优化：`MessageList.vue` 内置 rAF 节流确保高频滚动不引起过度重渲染；上限 50K 条消息（Dexie 游标分页 + 虚拟滚动联合）
- [ ] 子任务 11：编写 Dexie schema 迁移与 CRUD 测试（fake-indexeddb mock）、L1/L2/L3 缓存命中/过期/淘汰测试、memoizeWithExpiration 过期与命中测试、Pinia 持久化 round-trip 测试、Web Worker 索引建立与搜索延迟测试、50K 消息虚拟滚动帧率性能测试
*（内容由AI生成，仅供参考）*
