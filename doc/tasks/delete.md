# delete — 删除模块 (ConfirmModal + 删除流程)

> 详细设计参考：doc/detail.md §3.9 (删除模块)
> 现有代码：components/common/ConfirmModal.vue（已有 UI，confirm handler 为空）

依赖：storage (articleStore)

---

## 任务清单

### 1. ConfirmModal 组件完善

- [ ] 保持现有 ConfirmModal.vue 的 UI 不变
- [ ] 添加 `loading` prop：确认删除时显示加载状态，防止重复点击
- [ ] 添加 `aria-label` 提升可访问性
- [ ] 点击遮罩层关闭弹窗（`@click.self` on mask）
- [ ] ESC 键关闭弹窗（`@keydown.esc`）

### 2. 删除流程接入

- [ ] 在 App.vue 中维护 `deleteTargetId: string | null` 状态
- [ ] 「确认删除」handler：调用 `articleStore.deleteArticle(deleteTargetId)` → 关闭弹窗 → Toast
- [ ] 删除成功 Toast：`文章已删除 · {title}`
- [ ] 删除失败 Toast：`删除失败，请重试`

### 3. 删除后导航策略

| 当前页面 | 删除目标 | 删除后行为 |
|---|---|---|
| LibraryView | 列表文章 | 留在文章库，列表自动刷新 |
| ReaderView | 当前文章 | 返回文章库 |
| CaptureView | 最近文章 | 留在采集页，最近列表自动刷新 |
| ReaderView | 非当前文章 | 留在当前阅读页 |

- [ ] 实现上述导航策略：删除后根据 `currentView` 和 `deleteTargetId === activeArticleId` 判断

### 4. 测试

- [ ] 确认弹窗：点击取消 → 弹窗关闭，文章不变
- [ ] 确认弹窗：点击确认 → 文章从 IndexedDB 和列表中移除
- [ ] 在 ReaderView 删除当前文章 → 自动返回 LibraryView
- [ ] 在 CaptureView 删除最近文章 → 最近列表更新

## 验收标准

- 任何位置点击删除都弹出确认弹窗
- 确认删除后 IndexedDB 中记录已移除
- 删除当前阅读文章后自动返回文章库
- 防重复点击：确认按钮在删除进行中 disabled
