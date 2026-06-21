---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: d270bcd3df6a2cd27c2792fa9a0b45ef_00c38f726d8f11f18805525400d9a7a1
    ReservedCode1: gxvExDwWqp++JcqwXuhFeouzlsK1oQ2htDq4WjGTJRoUmMmYrp5P5Af3+yITXUAYTVHyUthk0T1jqAvRuPcgXMr9Dxt9KA1sfK1w/lOsSBolhDZA8c5wUu8nznTCgDs+wWvOQ5/WMJsHZ0ghs1enyTVaP+U8Cw00VmDJt5KJJA3J9BBB693BB42dvxA=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: d270bcd3df6a2cd27c2792fa9a0b45ef_00c38f726d8f11f18805525400d9a7a1
    ReservedCode2: gxvExDwWqp++JcqwXuhFeouzlsK1oQ2htDq4WjGTJRoUmMmYrp5P5Af3+yITXUAYTVHyUthk0T1jqAvRuPcgXMr9Dxt9KA1sfK1w/lOsSBolhDZA8c5wUu8nznTCgDs+wWvOQ5/WMJsHZ0ghs1enyTVaP+U8Cw00VmDJt5KJJA3J9BBB693BB42dvxA=
---

# 模块 04：Cherry 风格工作区

> 对应设计文档：design-04-workspace.md

## 子任务清单

- [ ] 子任务 1：定义 `Conversation` / `Message` / `ModelResponse` / `ConversationBranch` 核心数据模型，包含多模型回复集合、分支追问、生成状态等字段
- [ ] 子任务 2：实现 `scheduler.ts` 多模型并发调度器：根据用户勾选的 1~4 个 Provider，调用 `Promise.all` 并发执行各模型 `chatStream`，各 Provider 独立 SSE 连接互不阻塞
- [ ] 子任务 3：实现 `MessageList.vue` 消息列表组件：集成 `vue-virtual-scroller` 虚拟滚动，消息超 100 条自动激活，节点回收距离视口 ±2 屏；通过 `ResizeObserver` 动态计算消息高度
- [ ] 子任务 4：实现 `UserMessage.vue` 用户提问气泡与 `ModelGrid.vue` 多模型并排栏目组件，支持 1/2/3/4 栏自适应布局
- [ ] 子任务 5：实现 `ModelCard.vue` 单模型输出卡片：显示模型名 + 流式文本 + 独立操作按钮（重试/中止/复制/以此继续）
- [ ] 子任务 6：实现 `StreamingText.vue` 增量流式渲染：每收到 delta 追加到对应 `ModelResponse.content`，仅对最新文本块执行 `markdown-it.render()`，缓存已渲染 HTML；利用 `requestAnimationFrame` 节流（~16ms 延迟），确保生成时滚动帧率 ≥ 45fps
- [ ] 子任务 7：实现 `ModelCardFooter.vue` 数据透视底栏，硬编码显示：耗时(ms) | TTFT | Tokens/s | 消耗量预估，数据由 M3 实时返回
- [ ] 子任务 8：实现单分支追问机制：点击「以此继续」创建新分支会话，`parentId` 指向原消息，仅保留该模型回复作为上下文
- [ ] 子任务 9：实现 `TemplateEditor.vue` 提示词模板编辑器：支持创建/编辑/删除/导入导出（`.json`）模板；模板内容使用 `{{variable}}` 占位符语法
- [ ] 子任务 10：实现模板变量系统，支持五类变量解析：预设变量（`{{content}}`/`{{title}}`/`{{author}}`/`{{url}}`）；选区变量（`{{selection}}`）；Meta 变量（`{{meta:property:og:title}}`）；Schema.org 变量（`{{schema:@Article.headline}}`）；筛选器变量（`{{selectorHtml:#main}}`）
- [ ] 子任务 11：实现 AST-based 模板编译器 + 渲染器：变量解析走编译期静态分析而非运行时 `eval()`，杜绝代码注入；Filter 链严格白名单控制
- [ ] 子任务 12：实现 URL 触发规则系统：基于当前页面 URL 的 simple 匹配/regex 正则匹配/schema-type 匹配，自动切换对应模板
- [ ] 子任务 13：实现模板行为模式（new-note / append-to-existing / append-to-daily），与 M6 导出 Adapter 对接
- [ ] 子任务 14：实现 `FilterManager.vue` Filter 管道：40+ Filter 按四类注册——文本转换（capitalize/upper/lower/trim/replace/strip_tags/strip_md/safe_name）、结构转换（blockquote/callout/table/link/footnote）、列表操作（slice/reverse/merge/join/map/template）、日期处理（date/date_modify），支持 `{{variable|filter1|filter2}}` 链式调用
- [ ] 子任务 15：实现三级智能缓存：L1 内存缓存（LRU Map，最多 10 条，页面关闭释放）；L2 IndexedDB 持久化（按 URL 缓存提取结果，TTL 24h 可配，过期自动刷新）；L3 API 响应缓存（按 `hash(query+url+content_hash)` 为 Key，永不过期手动清理，命中时底栏标注 `⚡ Cached`）
- [ ] 子任务 16：实现 `memoizeWithExpiration` 工具函数：对模板编译/对话查询/Provider 配置读取等高频调用做短期缓存（5s 过期 + context-sensitive Key）
- [ ] 子任务 17：编写调度器并发行为单元测试、ModelResponse 状态机转换测试、增量渲染节流测试、模板变量解析与 Filter 链测试、三级缓存命中/过期/淘汰测试、100K tokens 文本生成滚动帧率性能测试
*（内容由AI生成，仅供参考）*
