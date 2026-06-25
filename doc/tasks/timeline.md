# 唤醒层：历史时间轴 (Timeline)

## 目标
显示用户按天/周/月的捕获足迹，类似 GitHub Contribution Graph。

## 最小可执行任务

### 1. 时间轴数据聚合
- [ ] 实现 `core/timeline/timeline.service.ts`
- [ ] 按 `createdAt` 聚合 documents：
  - 日维度：`YYYY-MM-DD` → count + documentIds[]
  - 周维度：`YYYY-Www` → count + documentIds[]
  - 月维度：`YYYY-MM` → count + documentIds[]
- [ ] 使用 Dexie `orderBy('createdAt')` 读取数据
- [ ] 聚合函数性能：万级文档 < 100ms

### 2. 时间轴页面 UI
- [ ] 创建 `entrypoints/sidepanel/pages/TimelinePage.vue`
- [ ] 贡献热力图（Contribution Graph）：
  - 每个格子代表一天
  - 颜色深浅表示捕获数量（0 / 1-3 / 4-7 / 8+）
  - 最近 1 年数据
- [ ] 时间范围筛选器：日 / 周 / 月
- [ ] 月份标签（X 轴）
- [ ] 星期标签（Y 轴，可选）

### 3. 日期详情弹窗
- [ ] 点击某一天 → 弹出当天文档列表
- [ ] 列表项：标题 + URL + 捕获时间
- [ ] 点击列表项跳转 Chat 页面查看文档
- [ ] 支持多选删除（可选）

### 4. 统计信息展示
- [ ] 总捕获文档数
- [ ] 今日捕获数
- [ ] 本周捕获数
- [ ] 连续捕获天数（Streak）
- [ ] 最活跃的一天

### 5. 数据刷新机制
- [ ] 进入 Timeline 页面时重新聚合
- [ ] 捕获新文档后自动刷新（Pinia store 监听）
- [ ] 使用 `computed` 缓存聚合结果（响应式）

---

## 验收标准
- [ ] 热力图渲染流畅，无卡顿
- [ ] 万级文档聚合 < 100ms
- [ ] 点击日期 3 秒内展示文档列表
- [ ] 统计信息实时准确
- [ ] 移动端适配（可选）

## 依赖模块
- `db/dexie.ts`（documents 表）
- `entrypoints/sidepanel/`（时间轴页面）
- `core/documents/document.service.ts`（读取文档）
