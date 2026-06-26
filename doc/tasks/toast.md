# toast — Toast 通知模块

> 详细设计参考：doc/detail.md §3.11 (Toast 模块)
> 现有代码：components/common/Toast.vue（已有 UI，通过 props watch 触发）

---

## 任务清单

### 1. Toast 机制重构

- [ ] 创建 `composables/useToast.ts`，提供 `showToast(type, title, desc?, duration?)` 函数
- [ ] 使用 provide/inject 或 Pinia store 管理全局 Toast 状态（避免 props 层层传递）
- [ ] 支持队列：多个 Toast 时依次显示（或替换当前 Toast）

### 2. Toast 类型支持

| 类型 | 图标 | 背景色 |
|---|---|---|
| success | ✓ | green (#16a34a) |
| error | ✕ | red (#dc2626) |
| info | ℹ | blue (#2563eb) |

- [ ] 更新 Toast.vue：根据 `type` prop 动态切换图标和背景色
- [ ] 保持现有的 auto-dismiss（默认 2.2 秒）和 slide-up 动画

### 3. 使用场景覆盖

| 场景 | 类型 | 标题 | 描述 |
|---|---|---|---|
| 保存成功 | success | 已保存到本地文章库 | 正文、元数据和 Markdown 已写入 IndexedDB |
| 复制成功 | success | Markdown 已复制 | 可以粘贴到 Notion、Obsidian 或其他编辑器 |
| 删除成功 | success | 文章已删除 | {title} 已从本地库移除 |
| 检测成功 | info | 页面检测完成 | 已识别标题、URL、作者、站点名和发布时间 |
| 权限不足 | error | 需要当前站点访问权限 | 请在扩展设置中授权 |
| 提取失败 | error | 正文提取失败 | 请重试或检查页面是否可读 |
| 存储失败 | error | 本地存储不可用 | IndexedDB 写入失败 |
| 复制失败 | error | 复制受限 | 当前浏览器环境不允许直接访问剪贴板 |
| 设置保存 | info | 设置已保存 | 偏好已更新 |

### 4. 设置集成

- [ ] `showToast: false` 时 `useToast()` 调用不显示 UI（静默模式）
- [ ] 保持代码中的 `showToast()` 调用不变，仅 UI 层判断是否显示

### 5. 测试

- [ ] Toast 显示测试：调用后立即可见，2.2 秒后自动消失
- [ ] Toast 类型测试：success/error/info 分别显示正确图标和颜色
- [ ] 静默模式测试：`showToast: false` 时不弹出

## 验收标准

- 所有操作完成后有对应 Toast 反馈
- Toast 2.2 秒自动消失，不阻断操作
- success/error/info 三种类型视觉区分明确
- 设置中关闭 Toast 后不再显示
