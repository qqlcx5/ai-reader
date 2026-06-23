# M5 AI 工作流 — Vibe Coding 任务清单 (v1)

> **目标**：实现串行接力（Relay Chain）、多角色圆桌（Roundtable）、提示词模板系统（含变量 + URL 触发规则）与 Filter 管道（40+ 后处理器）。
> **输入**：`doc/proposal_v1.md` §2.4
> **依赖**：M3（Provider 客户端）、M4（多模型调度器）、M8（存储层，Templates 表）

---

## 1. 核心类型定义

- [x] 在 `lib/workflow/types.ts` 中定义：
  ```typescript
  interface WorkflowNode {
    id: string
    inputSource: 'page' | 'variable' | 'merge'
    inputVars: string[]       // 引用上游输出变量名
    providerId: string
    model: string
    systemPrompt: string
    promptTemplate: string   // 含 {{变量}} 语法
    outputVar: string        // 本节点输出变量名
    mode: 'serial' | 'parallel'
  }
  interface WorkflowSession {
    id: string
    nodes: WorkflowNode[]
    variables: Record<string, string>  // 运行时变量池
    nodeStatuses: Record<string, 'pending' | 'running' | 'done' | 'aborted' | 'error'>
  }
  ```

---

## 2. 串行接力引擎（Relay Chain）

- [x] 实现 `lib/workflow/relay.ts`
  - 按节点顺序执行 Promise 链（`for...of` 顺序 await）
  - 每个节点完成后将 `outputVar` 写入 `session.variables`
  - 下游节点的 Prompt 中使用 `{{变量名}}` 引用上游输出
  - 任一节点失败立即中断后续节点（`throw` 向上传播）
  - 支持手动中断：`AbortController` 注入每个节点，中断后下游标记 `'aborted'`
- [x] 节点执行时实时流式渲染到对应 `ModelCard`（复用 M4 `StreamingText`）
- [x] 单元测试：3 节点接力链，mock 3 个 Provider，验证变量传递正确

---

## 3. 多角色圆桌（Roundtable）

- [x] 实现 `lib/workflow/roundtable.ts`
  - 接收角色配置数组：`[{ role: '红方挑刺', systemPrompt, providerId, model }]`
  - 为每个角色并发启动独立 `chatStream`（复用 M3 `IEngine`）
  - 单节点错误不中断其他角色（try/catch 局部处理）
  - 所有角色完成后收集输出，供用户查看
- [x] `stores/roundtable.store.ts`：管理各角色状态与输出
- [x] 内置 3 个预设角色：
  - 🟥 **红方挑刺**（system: "请以批判性思维挑出文章的逻辑漏洞..."）
  - 🟩 **蓝方辩护**（system: "请以支持者角度补充文章的合理之处..."）
  - 🟧 **产品落地**（system: "请从产品经理角度分析文章的落地价值..."）
- [x] 单元测试：3 角色并发，mock 第 2 个 Provider 抛错，验证第 1、3 角色继续完成

---

## 4. 变量解析器（Template Compiler）

- [x] 实现 `lib/workflow/variable-resolver.ts`
  - 解析 `{{变量名}}` 语法，从 `session.variables` + 页面上下文中查找替换
  - 支持变量链：`{{content}}` / `{{title}}` / `{{author}}` / `{{url}}` / `{{selection}}`
  - 支持 Meta 变量：`{{meta:property:og:title}}`
  - 支持 Schema.org 变量：`{{schema:@Article.headline}}`
  - **编译期静态分析**：提取模板中所有变量名，校验是否已定义，未定义的变量输出警告而非运行时崩溃
  - **严禁** `eval()` 或 `Function()` 动态执行
- [x] 单元测试：覆盖普通变量、Meta 变量、未定义变量三种场景

---

## 5. 提示词模板系统

- [x] 实现 `lib/workflow/template-manager.ts`
  - CRUD：`createTemplate` / `updateTemplate` / `deleteTemplate` / `listTemplates`
  - 数据通过 M8 `Templates` 表持久化
  - 支持导入 `.json` 文件（解析 `Template[]` 数组）
  - 支持导出选中模板为 `.json`
- [x] URL 触发规则：
  - 字段：`urlPattern?: string`（JavaScript 正则字符串）
  - `matchTemplate(url: string): Template | null`：遍历模板，返回第一个匹配的
  - Schema.org 类型匹配：当前页 `metadata.schemaType` 与模板 `schemaType` 字段匹配
- [x] 内置预设模板（seed 数据，首次安装写入 Templates 表）：
  - 📋 **总结摘要**：`请用三段话总结 {{title}} 的核心论点：\n\n{{content}}`
  - 🔬 **红队批判**：`以批判性思维指出以下文章的逻辑漏洞：\n\n{{content}}`
  - 🗺️ **脉络大纲**：`为以下文章生成完整章节级结构大纲：\n\n{{content}}`
  - 🌐 **翻译成中文**：`将以下内容翻译为地道简体中文，保留原有排版：\n\n{{content}}`
  - 💡 **解释关键概念**：`提取并解释以下文章中所有专业术语：\n\n{{content}}`
  - 🎯 **提取核心观点**：`提取作者在以下文章中最想表达的 3～5 个核心观点：\n\n{{content}}`
- [x] 实现模板压缩同步：
  - 使用 `lz-string` 将模板 JSON 压缩为 UTF16
  - 按 `CHUNK_SIZE=8000` 分片存入 `chrome.storage.sync`
  - 读取时解压拼接还原

---

## 6. Filter 管道

- [x] 实现 `lib/workflow/filters.ts`，40+ Filter 函数（纯函数，输入字符串/数组 → 输出字符串/数组）：
  - **文本转换**：`capitalize` / `upper` / `lower` / `trim` / `replace(from,to)` / `strip_tags` / `strip_md` / `safe_name`
  - **结构转换**：`blockquote` / `callout(type)` / `table` / `link(text)` / `footnote`
  - **列表操作**：`slice(start,end)` / `reverse` / `merge(separator)` / `join(separator)` / `map(template)` / `template(tpl)`
  - **日期处理**：`date(format)` / `date_modify(amount,unit)`
- [x] 实现 `lib/workflow/filter-pipeline.ts`
  - 解析 `{{变量名|filter1|filter2(arg)}}` 语法（Filter 链）
  - 按顺序执行 Filter，将输出传入下一个 Filter
  - Filter 白名单校验：不在白名单中的 Filter 名称抛出编译期错误
- [x] 单元测试：`'hello world' | capitalize | upper` → `'HELLO WORLD'`

---

## 7. 工作流 UI 面板

- [x] 实现 `components/workflow/WorkflowPanel.vue`（接入 M1 右栏"工作流"Tab）
  - 顶部：圆桌 / 接力链 / 模板三个子面板切换
- [x] 实现 `components/workflow/RoundtablePanel.vue`
  - 3 列角色卡片网格（`bg-obsidian-bg` + `border` + `rounded-lg`，居中）
  - 每个角色卡片：角色名 + 颜色圆圈 + 模型下拉 + System Prompt 输入框
  - 【启动圆桌】紫色主按钮 + 【重置】白色边框按钮
- [x] 实现 `components/workflow/RelayChainPanel.vue`
  - 节点列表（最多 4 个节点），每个节点：模型选择 + Prompt 输入 + 输出变量名
  - 节点间连线箭头（纯 CSS `border-left` 或 SVG）
  - 【启动接力】按钮
- [x] 实现 `components/workflow/TemplateList.vue`
  - 列表展示所有模板（图标 + 名称 + URL 规则预览）
  - 单击一键填入 M4 InputComposer
  - 长按 / 右键：编辑 / 删除 / 导出
- [x] 实现 `components/workflow/WorkflowResults.vue`
  - 展示各节点 / 角色的流式输出卡片（复用 M4 `ModelCard`）
  - 底部显示整体用时 + 各节点状态

---

## 验收标准

1. 配置 DeepSeek → Claude 接力链，DeepSeek 完成翻译后，Claude 自动收到 `{{translation}}` 并开始提取技术难点。
2. 启动圆桌：3 个角色同时流式输出，mock 第 2 个 Provider 失败不影响其他两个。
3. 模板 `{{meta:property:og:title}}` 在含 OG 元数据的页面正确替换为实际标题。
4. Filter `'  Hello World  ' | trim | lower` → `'hello world'`。
5. 模板压缩同步：导入 20 个模板后，`chrome.storage.sync` 分片写入不超过 8KB / chunk。
