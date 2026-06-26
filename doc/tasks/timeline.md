# 唤醒层：历史时间轴 (P2)

> **模块名称**: timeline  
> **优先级**: P2（体验优化）  
> **依赖关系**: 依赖 persistence.md（IndexedDB 数据访问）  
> **目标**: 实现文章收藏的时间轴视图，包括时间轴聚合、贡献热力图和统计信息展示

---

## 子任务

### 时间轴数据聚合
- [ ] 创建 `core/timeline/timeline-aggregator.ts`
- [ ] 实现 `aggregateByDay(articles: SavedArticle[]): DayGroup[]` — 按天分组
- [ ] 实现 `aggregateByWeek(articles: SavedArticle[]): WeekGroup[]` — 按周分组
- [ ] 实现 `aggregateByMonth(articles: SavedArticle[]): MonthGroup[]` — 按月分组
- [ ] 分组数据包含：日期标签、文章列表、统计数量
- [ ] 实现「今天 / 昨天 / 本周 / 上周 / 更早」的语义化分组标签

### 贡献热力图
- [ ] 创建 `components/ContributionGraph.vue`：类似 GitHub Contribution Graph
- [ ] 实现日历热力图：横轴为周，纵轴为周几，共 52 周
- [ ] 实现颜色映射：0 篇（灰色）→ 1-2 篇（浅绿）→ 3-5 篇（中绿）→ 5+ 篇（深绿）
- [ ] 实现 Tooltip：hover 时显示日期 + 保存文章数 + 文章标题列表
- [ ] 实现点击某天 → 过滤显示该天的文章列表
- [ ] 响应式设计：Popup 宽度 400px 内适配

### 统计信息展示
- [ ] 创建 `components/StatsPanel.vue`：统计信息卡片
- [ ] 显示总捕获数（全部文章数量）
- [ ] 显示今日捕获数
- [ ] 显示本周捕获数
- [ ] 显示连续天数 Streak（最长连续捕获天数）
- [ ] 计算 Streak 逻辑：从今天往回统计连续有保存的天数
- [ ] 显示最长 Streak 记录

### 时间轴 UI
- [ ] 创建 `views/TimelineView.vue`：时间轴视图主容器
- [ ] 顶部 StatsPanel 统计卡片
- [ ] 中间 ContributionGraph 热力图
- [ ] 底部时间轴文章列表：
  - 按月/周分组标题
  - 文章卡片（简化版，标题 + siteName + 时间）
  - 点击卡片 → 进入 ReaderView
- [ ] 无限滚动 / 虚拟滚动优化（文章 > 500 篇时）
- [ ] 在 LibraryView 中集成时间轴切换按钮

### 数据查询优化
- [ ] 时间轴数据从 IndexedDB 按 `createdAt` 索引批量查询
- [ ] 缓存聚合结果：仅在文章变更时重新计算
- [ ] 热力图数据预计算：每次保存/删除文章后更新

---

## 验收标准

- [x] 时间轴按天/周/月正确分组显示
- [x] 贡献热力图颜色映射正确，Tooltip 信息完整
- [x] Streak 统计准确（含跨天/跨月边界）
- [x] 点击热力图日期可过滤文章列表
- [x] 500 篇文章时滚动流畅不卡顿

## 依赖模块

- `persistence.md` — IndexedDB 数据访问

## 关联文件

- `design.html` Tab 3 我的大脑的时间轴分组展示
