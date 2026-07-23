# AI 分析模块重构设计

日期：2026-07-23

## 1. 目标与边界

本次重构同时处理 AI 分析服务边界和分析页面结构，采用低风险的外科手术式拆分。目标是让服务、store 和 UI 各自承担清晰职责，同时保持现有行为。

### 目标

- 服务层职责清晰且可独立测试。
- `ai-job` store 只保留队列领域状态与操作，不保存面板筛选和多选状态。
- `AnalysisView.vue` 拆成按可见区域组织的子组件。
- 保持自动入队、批量分析、workflow、串行 drain、取消、重试和优先级行为。
- 修复明显实现问题，但不引入新功能。

### 不在范围内

- 不统一交互式 Chat 与后台 Job 分析路径。
- 不引入并行 drain、多规则命中、RAG 或新的分析能力。
- 不改数据库 schema。
- 不大改 `AnalysisConfigCenter.vue` 及其配置子组件。

## 2. 目标分层

```text
UI 子组件
  -> useAiJobStore
      -> services/ai-job/queue.ts
      -> services/ai-job/processor.ts
          -> process-job.ts
          -> workflow-continue.ts
      -> services/ai-job/job-control.ts
      -> services/ai-job/rule-engine.ts
```

服务层对外 API 尽量保持兼容。若函数移动到新文件，原文件保留 re-export，避免一次性修改所有调用方。

## 3. 服务层设计

### 3.1 模块职责

- `queue.ts`：创建 pending job，处理自动、批量和 workflow step 0 入队。
- `rule-engine.ts`：纯条件匹配和查找第一条启用规则，不产生入队副作用。
- `process-job.ts`：解析文档、模型和模板，构造 prompt，调用 provider，保存 conversation，处理重试和最终状态。
- `workflow-continue.ts`：当前 workflow job 成功后 enqueue 下一步。
- `processor.ts`：对外提供 `drainAll`、`cancelJob`、`reclaimStaleJobs`；负责串行取队列、pause 检查和 in-flight abort。
- `job-control.ts`：集中处理 retry、pending cancel、批量 retry、删除、清理、优先级和排序等 job 状态操作。

不新增大而泛的 usecase 层，也不改变 provider 或 prompt builder 的职责。

### 3.2 行为约束

- 自动入队仍然一篇文档最多一个 job；batch 和 workflow 仍允许重复分析。
- `drainAll` 仍然串行执行，不引入并发。
- processing cancel 继续设置 `cancelRequested`、abort 请求并最终标记 `cancelled`；pending cancel 直接标记 `cancelled`。
- failed/cancelled retry 继续清除错误和取消标记，并递增 `retries`。
- 模型、文档、模板缺失等永久错误不重试；网络、超时和可重试服务错误继续指数退避。
- workflow 只在前一步成功后入队下一步。
- `reclaimStaleJobs` 继续把扩展重启后遗留的 processing job 标记为 failed。

### 3.3 Pause 修复

`drainAll` 的循环内不再使用循环外缓存的 settings 判断 pause。每次准备处理下一个 job 前重读队列暂停状态；暂停后不再领取新的 pending job，已经开始的 job 自然完成。

## 4. Store 设计

`stores/ai-job.store.ts` 保留 `jobs`、`stats`、`draining`、`queuePaused`、领域排序和批次派生数据，以及加载、排空、入队、重试、取消、删除、清理、优先级和排序操作。

所有 job 写操作通过 `job-control`、`processor` 或 `queue` 完成。store 不再直接拼装状态机写入 Repository。

以下面板状态移出 store，放到 `useAiJobPanel` 或分析组件本地：

- filter、filteredJobs、set/reset filter
- selectedIds、selectMode、selectedJobs、selectedCount
- toggle/select all/select none
- 展开详情、conversation 加载状态和轮询 timer

批量 API 从隐式读取 store 选择改为接收显式 ID，例如：

```ts
store.retryMany(ids)
store.removeMany(ids)
store.setPriorityMany(ids, 'high')
```

`feed.store` 中直接修改 AI job 的 retry 写路径改用 job-control；其只读展示逻辑不在本次重构中扩展。

## 5. UI 设计

`AnalysisView.vue` 变为装配壳，负责初始化 model/template/job 数据、生命周期、对话框和页面布局。新增分析面板目录：

```text
components/auramind/analysis/
  AnalysisQueueHeader.vue
  AnalysisJobFilters.vue
  AnalysisJobList.vue
  AnalysisJobRow.vue
  AnalysisJobDetail.vue
  useAiJobPanel.ts
  useAnalysisPolling.ts
```

### 组件职责

- `AnalysisQueueHeader`：标题、统计、暂停/恢复、drain、清理、批量入口。
- `AnalysisJobFilters`：状态、模型和搜索筛选。
- `AnalysisJobList`：空态、列表、pending 拖拽区和批量操作条。
- `AnalysisJobRow`：单 job 展示、重试、取消、删除、优先级和展开操作。
- `AnalysisJobDetail`：只读加载 conversation 摘要及跳转文档/会话。
- `useAiJobPanel`：筛选、多选和列表派生状态，不访问 Repository。
- `useAnalysisPolling`：根据 pending/processing 状态启停现有轮询。

现有视觉结构、文案和交互保持不变，不做视觉重设计。`BatchAnalysisDialog`、`DocumentPickerDialog` 和配置中心继续由外壳装配。

## 6. 错误处理

保持现有错误语义，不新增错误类型体系或全局 toast 策略：

- 永久配置/资源错误直接 failed。
- transient provider 错误按模型 `maxRetries` 重试。
- 用户取消不转为 failed。
- pause 只阻止领取新 job。
- UI action 失败继续由现有调用方处理，成功后刷新 job 列表。

## 7. 测试策略

保留并迁移现有 `processor.test.ts`、`queue.test.ts` 和 `rule-engine.test.ts` 的语义断言。

新增或强化：

- drain 中途 pause 后不处理后续 pending job。
- job-control 的 retry、retryMany、cancelPending、setPriority、reorder 和 clear 状态转移。
- 若抽出纯过滤或排序函数，为其添加小型单测。

不强制新增大型 AnalysisView E2E 测试。拆分后手工验证自动入队、串行执行、pause/resume、processing/pending cancel、单条/批量 retry、多选删除、优先级、拖拽排序、batch/workflow、筛选、详情展开和跳转。

## 8. 实施顺序

1. 抽出 `process-job.ts` 和 `workflow-continue.ts`，让 processor 变薄；运行现有 processor 测试。
2. 修复 drain 的 pause 重读逻辑；增加中途 pause 测试。
3. 新增 `job-control.ts`，迁移 retry/cancel/priority/reorder/clear；运行相关测试。
4. 瘦 `ai-job.store`，把 selected/filter 状态移出，并更新显式 ID API；运行类型检查和相关测试。
5. 收口 `feed.store` 的 job retry 写路径；验证 feed job 展示不变。
6. 抽出 `useAiJobPanel` 和 `useAnalysisPolling`。
7. 按区域拆分 `AnalysisView.vue`；执行手工交互清单。
8. 清理未使用 import、保留必要 re-export，运行全量相关测试和类型检查。

每个步骤应保持可独立提交和回滚。

## 9. 验收标准

- 自动、batch、workflow 入队行为保持不变。
- 串行执行、重试、取消、优先级和 stale job 回收行为保持不变。
- pause 在 drain 中途正确阻止后续 job。
- store 不再持有 filter/multi-select，也不直接拼 job 状态写操作。
- `AnalysisView.vue` 仅负责装配和生命周期，列表、行、筛选、详情和轮询位于独立文件。
- AI job 相关现有测试和新增测试通过。
- 无数据库迁移、无 Chat 路径改造、无额外功能。
