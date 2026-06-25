# 技术评审 + 任务文件修复任务总结

**任务日期**：2026-06-25  
**任务目标**：基于 chrome-extensions skill 完善任务清单并执行技术评审

---

## 一、任务执行流程

### Step 1：读取 chrome-extensions skill
- 加载 `~/.agents/skills/chrome-extensions/SKILL.md` 获取 12 大领域、90+ 规则的 Manifest V3 最佳实践
- 重点关注的规则：#1 图标、#2 Side Panel、#5 onMessage、#6 DOM 批处理、#7 SW 状态、#11 action、#12 activeTab

### Step 2：评审 7 个任务文件 + 现有代码
- 现有 `entrypoints/background.ts` 仅有 `console.log`
- 现有 `entrypoints/content.ts` 使用了 `*://*.google.com/*`（过窄）
- `wxt.config.ts` 缺 `action` 字段
- 7 个任务文件 + 现有代码共发现 **11 个问题**：
  - 3 个 🔴 Critical（侧边栏打开机制、图标引用、activeTab 误用）
  - 4 个 🟠 High（tab.url 权限、action 字段、world: MAIN 风险、<all_urls> 范围）
  - 4 个 🟡 Medium（SW 状态、return true、DOM 批处理）

### Step 3：批量修复任务文件
修改 7 个任务文件：
1. **foundation.md**（137 行）：权限配置、action 字段、Side Panel 触发器、图标规范、return true
2. **perception.md**（119 行）：删除 world: MAIN、return true、DOM 批处理规范
3. **model-management.md**（72 行）：API Key 存储、AbortController 超时、参考资料
4. **chat-with-doc.md**（91 行）：chrome.storage.session、onMessage return true、长连接
5. **persistence.md**（102 行）：chrome.storage.session 同步状态、参考资料
6. **search.md**（72 行）：Worker 通信规范、参考资料
7. **timeline.md**（62 行）：参考资料

### Step 4：创建 3 个新文档
1. **`doc/tasks/tech-review_2026-06-25.md`**（369 行）- 完整技术评审报告
2. **`.manifest-checklist.md`**（3482 字节）- 每次 PR 前的 manifest 验证清单（16 项检查）
3. **`CHROMEWEBSTORE.md`**（6106 字节）- Chrome Web Store 上架元数据（权限理由、隐私政策、截图清单）

---

## 二、关键技术决策

### 已确认正确 ✅
- **SSE 流式解析使用 `eventsource-parser`**：解决多字节字符在网络 Chunks 截断时的乱码问题

### 已修复 ❌ → ✅
| 序号 | 原方案 | 新方案 | 理由 |
|------|--------|--------|------|
| 1 | `activeTab` 权限 | `tabs` + `host_permissions: <all_urls>` | activeTab 从 Side Panel 触发无效 |
| 2 | 无 `action` 字段 | `manifest.action: {}` | chrome.action API 需要 |
| 3 | `world: 'MAIN'` | `world: 'ISOLATED'` (默认) | Store 审核风险 |
| 4 | 无 Side Panel 触发器 | `chrome.action.onClicked` 或 `setPanelBehavior` | default_path 不会自动打开 |
| 5 | 图标未规范 | 16/48/128 三个独立 PNG | chrome-extensions 规则 #1 |
| 6 | 未提 `return true` | 文档化异步 onMessage 规范 | 规则 #5 |
| 7 | SW 状态未明确 | `chrome.storage.session` | 规则 #7 |

---

## 三、产出物清单

### 修改的文件
- `doc/tasks/foundation.md` (137 行)
- `doc/tasks/perception.md` (119 行)
- `doc/tasks/model-management.md` (72 行)
- `doc/tasks/chat-with-doc.md` (91 行)
- `doc/tasks/persistence.md` (102 行)
- `doc/tasks/search.md` (72 行)
- `doc/tasks/timeline.md` (62 行)
- `doc/tasks/progress.md` (115 行)

### 新增的文件
- `doc/tasks/tech-review_2026-06-25.md` (369 行) - 技术评审报告
- `.manifest-checklist.md` (3482 字节) - 验证清单
- `CHROMEWEBSTORE.md` (6106 字节) - 上架元数据

**总计**：8 个文件修改，3 个文件新建

---

## 四、后续行动建议

### 立即执行（开发前）
1. 按 `foundation.md` 任务清单开始实施
2. 严格遵守 `.manifest-checklist.md` 16 项检查

### 短期（开发期间）
3. 完成 MVP 后立即测试 Side Panel 打开流程
4. 在 Chrome 实际加载扩展，验证所有权限生效

### 中期（发布前）
5. 按 `CHROMEWEBSTORE.md` 准备截图和宣传图
6. 撰写隐私政策并托管到 GitHub Pages
7. 在 Chrome Web Store 开发者后台提交

---

## 五、总结

**技术评审结论**：项目选型与架构基本合理（WXT + Vue 3 + TS + Dexie + MiniSearch + eventsource-parser），但 Manifest V3 权限配置和 Side Panel 打开机制存在严重缺陷，已全部修复。

**关键修复点**：
- 权限精确声明（用 `tabs` + `host_permissions` 替代 `activeTab`）
- Side Panel 打开触发器（避免只定义 `default_path` 的常见错误）
- ISOLATED world 替代 `MAIN` world（降低 Store 审核风险）
- SW 状态持久化（`chrome.storage.session`）
- 异步 onMessage 规范（`return true`）

**文档完整度**：从 7 个基础任务文件 → 10 个专业文档（含评审报告、验证清单、上架元数据），为后续开发和发布奠定坚实基础。
