# 唤醒层：历史时间轴 (Timeline)

## 目标
显示用户按天/周/月的捕获足迹，类似 GitHub Contribution Graph。

## 最小可执行任务

### 1. 时间轴数据聚合
- [ ] 实现 `core/timeline/timeline.service.ts`（参考 `storage-utils.ts` 的 `history` 数组和 `stats` 统计模式）
- [ ] 按 `createdAt` 聚合 documents（参考 `date-utils.ts` 的日期处理）：
  - 日维度：`YYYY-MM-DD` → count + documentIds[]
  - 周维度：`YYYY-Www` → count + documentIds[]
  - 月维度：`YYYY-MM` → count + documentIds[]
- [ ] 使用 Dexie `orderBy('createdAt')` 读取数据（参考 `db/dexie.ts` 的索引定义）
- [ ] 聚合函数性能：万级文档 < 100ms（参考 `popup.ts` 的性能要求）

### 2. 时间轴页面 UI
- [ ] 创建 `entrypoints/sidepanel/pages/TimelinePage.vue`（参考 `side-panel.html` 和 `popup.ts` 的 UI 结构）
- [ ] 贡献热力图（Contribution Graph，参考 `styles/charts.scss` 或自建）：
  - 每个格子代表一天
  - 颜色深浅表示捕获数量（0 / 1-3 / 4-7 / 8+）
  - 最近 1 年数据
- [ ] 时间范围筛选器：日 / 周 / 月（参考 `popup.ts` 的筛选逻辑）
- [ ] 月份标签（X 轴，参考 `date-utils.ts`）
- [ ] 星期标签（Y 轴，可选，参考 `date-utils.ts`）

### 3. 日期详情弹窗
- [ ] 点击某一天 → 弹出当天文档列表（参考 `popup.ts` 的弹窗模式）
- [ ] 列表项：标题 + URL + 捕获时间（参考 `shared.ts` 的变量构建）
- [ ] 点击列表项跳转 Chat 页面查看文档（参考 `popup.ts` 的页面切换）
- [ ] 支持多选删除（可选，参考 `storage-utils.ts` 的数据清理）

### 4. 统计信息展示
- [ ] 总捕获文档数（参考 `storage-utils.ts` 的 `stats` 计数）
- [ ] 今日捕获数（参考 `date-utils.ts` 的日期比较）
- [ ] 本周捕获数（参考 `date-utils.ts` 的周计算）
- [ ] 连续捕获天数（Streak，参考 `stats` 的连续计数逻辑）
- [ ] 最活跃的一天（参考 `history` 数组的聚合）

### 5. 数据刷新机制
- [ ] 进入 Timeline 页面时重新聚合（参考 `popup.ts` 的初始化加载）
- [ ] 捕获新文档后自动刷新（参考 `storage-utils.ts` 的实时更新模式）
- [ ] 使用 `computed` 缓存聚合结果（响应式，参考 Vue 的响应式系统）

---

## 验收标准
- [ ] 热力图渲染流畅，无卡顿（参考 `styles/charts.scss` 或 CSS Grid 实现）
- [ ] 万级文档聚合 < 100ms（参考 `popup.ts` 的性能要求）
- [ ] 点击日期 3 秒内展示文档列表（参考 `popup.ts` 的加载性能）
- [ ] 统计信息实时准确（参考 `storage-utils.ts` 的实时更新）
- [ ] 移动端适配（可选，参考 `styles/mobile.scss`）

## 依赖模块
- `db/dexie.ts`（documents 表，参考 `storage-utils.ts`）
- `entrypoints/sidepanel/`（时间轴页面，参考 `popup.ts` 和 `side-panel.html`）
- `core/documents/document.service.ts`（读取文档，参考 `content-extractor.ts`）
