---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: d270bcd3df6a2cd27c2792fa9a0b45ef_0228a3e56d8f11f1aa625254006c9bbf
    ReservedCode1: REljyikXTg8Zx8zvC7uj+EyC9BZE5Ow4gjjHr5cjc9OUiD6bGQbwCgloMKPtJO4DUDHSmFD8VjEuWZC7Mm6QWmuG1r4YVd7M0fsi+DRuuwdLjFvWZAXhvBaP29OkNdZ+kL8z6EtA+7VIlQMcGqBssrnrR0SGsf7BMPmgNCmJm57WsWJp1Wg/lqpbxlM=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: d270bcd3df6a2cd27c2792fa9a0b45ef_0228a3e56d8f11f1aa625254006c9bbf
    ReservedCode2: REljyikXTg8Zx8zvC7uj+EyC9BZE5Ow4gjjHr5cjc9OUiD6bGQbwCgloMKPtJO4DUDHSmFD8VjEuWZC7Mm6QWmuG1r4YVd7M0fsi+DRuuwdLjFvWZAXhvBaP29OkNdZ+kL8z6EtA+7VIlQMcGqBssrnrR0SGsf7BMPmgNCmJm57WsWJp1Wg/lqpbxlM=
---

# 模块 05：高阶 AI 工作流

> 对应设计文档：design-05-workflows.md

## 子任务清单

- [ ] 子任务 1：定义 `WorkflowSession` / `WorkflowConfig` / `WorkflowNode` / `WorkflowTemplate` 核心数据模型，工作流会话 `mode` 字段复用 M4 的 `Conversation` 模型
- [ ] 子任务 2：实现 `compare.ts` 多模型并排对比编排器：用户一次输入广播给所有勾选模型纯前端并发执行，每个模型卡片独立配置 System Prompt（红方挑刺/蓝方辩护等角色视角），结果并排展示
- [ ] 子任务 3：实现 `ComparePanel.vue` 对比 UI：支持拖拽调整 1/2/3/4 栏布局，每个卡片独立操作（重试/中止/复制/追问），对话可保存为只读历史快照
- [ ] 子任务 4：实现 `relay.ts` 串行对比编排器（形式 B）：配置 2 个模型串行执行，先跑 A 模型，A 完成后自动触发 B 模型，B 收到 A 完整输出作为额外上下文；使用 `topologicalSort` 对节点按 `order` 排序，`Promise` 链串起两段异步调用
- [ ] 子任务 5：实现追问接力（形式 A）：通过 M4 的「以此继续」机制，点选某模型卡片将输出作为新上下文切换到另一模型继续提问
- [ ] 子任务 6：实现 `interpreter.ts` AI 页面解释器：用户定义 Prompt 变量，将页面上下文 + Prompt 打包为单次 API 请求；支持批量 Prompt（一次请求处理多个，模型 JSON 格式返回并自动回填到模板对应位置），输出支持 Filter 管道后处理
- [ ] 子任务 7：实现 `InterpreterPanel.vue` 解释器配置 UI：Prompt 变量定义、批量 Prompt 管理、结果 JSON 回填展示
- [ ] 子任务 8：实现翻译模式：55+ 语言互译，语言自动检测，Quote 智能处理；沉浸式双语翻译支持双语对照/仅译文切换，通过自定义 CSS 调整译文样式，翻译结果分批插入 DOM 不阻塞页面渲染
- [ ] 子任务 9：实现智能批量请求合并：全文翻译时将页面内多个翻译块合并为单次 API 请求，通过 Prompt 拼接 + JSON 结构化返回一次性获取所有结果，API 调用成本最高节省 70%；同样适用于批量划词解释
- [ ] 子任务 10：实现润色模式：语法修正（拼写/时态/标点）、风格优化（正式/口语/学术/商务切换）、学术写作辅助（措辞 + 引用格式规范）
- [ ] 子任务 11：实现总结模式：支持四种输出格式——段落（自然语言）、要点（Bullet Points）、表格（结构化对比/分类）、思维导图大纲（Markdown 层级大纲）
- [ ] 子任务 12：实现 Big-Bang 模式：用户自定义组合指令（翻译+总结+分析），各子任务并发执行，结果按模块展示
- [ ] 子任务 13：实现 `TranslatePanel.vue` 三合一配置 UI：翻译（源语言/目标语言/双语开关）、润色（风格选择）、总结（输出格式选择）、Big-Bang（组合指令编辑）
- [ ] 子任务 14：实现 `tts.ts` 语音朗读：集成 Web Speech API（EdgeTTS），30+ 语言朗读，`langCode2TTSLang` 映射表自动匹配语言；触发方式：选中文本右键 → 朗读 / 模型输出卡片底部「朗读」按钮
- [ ] 子任务 15：实现 `WorkflowLauncher.vue` 工作流启动入口、`WorkflowRunner.vue` 执行状态监控、`WorkflowResultView.vue` 结果展示（复用 M4 的 ModelCard）
- [ ] 子任务 16：编写拓扑排序与循环依赖检测单元测试、对比模式多角色 Prompt 注入测试、Relay Chain 输入拼接格式测试、Interpreter 批量 Prompt JSON 解析测试、语言映射表完整性测试、沉浸式翻译 DOM 注入与样式隔离集成测试
*（内容由AI生成，仅供参考）*
