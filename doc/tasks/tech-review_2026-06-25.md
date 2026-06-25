# Chrome Extension 技术评审报告

> 评审对象：`/Users/another/Documents/OpenSource/ai-reader` 项目的 7 个任务文件 + 现有代码
> 评审依据：`chrome-extensions` skill (Manifest V3 最佳实践)
> 评审时间：2026-06-25
> 评审结果：**❌ 7 个任务文件 + 现有代码存在 11 类高危问题，需要全部修复**

---

## 1. 评审总结

| 类别 | 问题数 | 严重度 | 状态 |
|------|--------|--------|------|
| **侧边栏打开机制** | 1 | 🔴 Critical | 任务文件有，代码无 |
| **图标引用** | 1 | 🔴 Critical | 任务文件要求生成，代码未实现 |
| **`activeTab` 权限误用** | 1 | 🔴 Critical | 任务文件配置错误 |
| **`tab.url` 权限缺失** | 1 | 🟠 High | 任务文件未声明 |
| **`chrome.action` 配置缺失** | 1 | 🟠 High | manifest 无 action |
| **Content Script 注入 `world: 'MAIN'`** | 1 | 🟠 High | 危险，需重新评估 |
| **`<all_urls>` 权限过宽** | 1 | 🟠 High | Store 审核风险 |
| **SSE Stream 解析与多字节字符** | 1 | 🟡 Medium | 已选 `eventsource-parser` ✓ |
| **服务工作者状态存储** | 1 | 🟡 Medium | 未明确 `chrome.storage` |
| **`return true` onMessage 异步响应** | 1 | 🟡 Medium | 任务文件未提及 |
| **Content Script DOM 批处理** | 1 | 🟡 Medium | 任务文件未提及 |

**总分：11 个问题需修复，1 个已正确实现**

---

## 2. 🔴 Critical 问题（必须修复，否则扩展完全不可用）

### 2.1 侧边栏（Side Panel）打开机制缺失

**规则引用** (chrome-extensions skill, 规则 #2)：
> Defining `"side_panel": {"default_path": "..."}` does NOT make it openable. Add a trigger.

**当前问题**：
- `foundation.md` 任务文件只说"配置 `manifest.side_panel.default_path`"
- 未提供打开触发器代码
- 现有 `entrypoints/background.ts` 只有 `console.log`，无任何打开逻辑

**修复方案**：

在 `entrypoints/background.ts` 中实现以下两种打开方式之一：

```ts
// ✅ 方案 A：通过扩展图标点击打开（推荐）
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

// ✅ 方案 B：setPanelBehavior 自动打开
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
// ⚠️ 注意：属性名是 openPanelOnActionClick，不是 openPanelOnActionIconClick
// ⚠️ 使用 setPanelBehavior 时不能同时定义 default_popup
```

**任务文件修改**：`foundation.md` 章节 1 → 增加触发器子任务

---

### 2.2 图标引用规则违反

**规则引用** (chrome-extensions skill, 规则 #1)：
> ❌ BROKEN — referencing files that don't exist or reusing one file for all sizes

**当前问题**：
- `foundation.md` 章节 6 只说"准备图标"，未明确多尺寸规范
- `public/icon/` 目录未确认内容
- manifest 未配置 icons 字段

**修复方案**：
1. 每个尺寸的图标必须是独立文件
   - `icon-16.png` (16×16px)
   - `icon-48.png` (48×48px)
   - `icon-128.png` (128×128px)
2. manifest 配置示例：
   ```json
   "icons": {
     "16": "icons/icon-16.png",
     "48": "icons/icon-48.png",
     "128": "icons/icon-128.png"
   }
   ```
3. **备选方案**：如果无法生成真实 PNG，直接从 manifest 中删除 `icons` 字段（Chrome 会用默认图标）

**任务文件修改**：`foundation.md` 章节 6 → 增加尺寸规范

---

### 2.3 `activeTab` 权限误用

**规则引用** (chrome-extensions skill, 规则 #12)：
> `activeTab` does NOT work from a side panel button click

**当前问题**：
- `foundation.md` 配置 `manifest.permissions: ['sidePanel', 'storage', 'activeTab']`
- 实际上：
  - Content Script 需要访问任意网页 DOM（defuddle 解析）
  - Side Panel 中点击按钮不能触发 `activeTab`
  - 必须用 `tabs` + `host_permissions: ['<all_urls>']`

**修复方案**：

```json
{
  "permissions": ["sidePanel", "storage", "tabs", "scripting"],
  "host_permissions": ["<all_urls>"]
}
```

**任务文件修改**：`foundation.md` 章节 1 → 修正权限配置

---

## 3. 🟠 High 严重度问题

### 3.1 `tab.url` 访问权限缺失

**规则引用** (chrome-extensions skill, 规则 #4)：
> `tab.url` requires the `tabs` permission. Without it, `tab.url` silently returns `undefined` — no error thrown.

**当前问题**：
- `perception.md` 任务要求通过 `chrome.runtime.sendMessage` 转发到 Side Panel
- Side Panel 打开后需要读取 `tab.url` 显示当前文档 URL
- 任务文件未声明 `tabs` 权限

**修复方案**：
- 已在 2.3 修复中包含 `tabs` 权限

**任务文件修改**：`foundation.md` 章节 1 → 已在 2.3 中修复

---

### 3.2 `chrome.action` 配置缺失

**规则引用** (chrome-extensions skill, 规则 #11)：
> Using `chrome.action.setBadgeText` requires an `"action"` key in manifest.json — even if it's empty.

**当前问题**：
- 现有 `wxt.config.ts` 未声明 action
- 任务文件未明确此配置

**修复方案**：

```ts
// wxt.config.ts
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    action: {}, // 至少空对象
  }
});
```

或带 popup：
```ts
manifest: {
  action: { default_popup: 'popup.html' }
}
```

**任务文件修改**：`foundation.md` 章节 1 → 增加 `action` 字段

---

### 3.3 Content Script 注入 `world: 'MAIN'` 风险

**当前问题**：
- `perception.md` 章节 1 要求 `world: 'MAIN'`
- `world: 'MAIN'` 让 Content Script 共享页面的 JS 上下文，但**会大幅增加 Chrome Web Store 审核风险**
- defuddle 完全可以在 `world: 'ISOLATED'` 中工作（只读 DOM，不需要污染页面 JS 上下文）

**修复方案**：

```ts
// ✅ 推荐：使用 world: 'ISOLATED' (默认)
export default defineContentScript({
  matches: ['<all_urls>'],
  // 不指定 world，使用默认的 ISOLATED
  main() {
    // defuddle 可以正常读取 DOM（DOM 总是可访问的）
    // 只是不能污染页面的 window 对象
  }
});
```

**任务文件修改**：`perception.md` 章节 1 → 删除 `world: 'MAIN'`

---

### 3.4 `<all_urls>` 权限过宽

**当前问题**：
- `host_permissions: ['<all_urls>']` 会被 Store 审核质疑
- 实际需求：捕获任意网页内容（用户主动点击按钮）

**修复方案**：

根据 Chrome 文档，`activeTab` 在用户主动点击时**确实可以临时访问当前 tab**。但需结合 `host_permissions` 才能持久注入 content script。

✅ **可选优化**：在 manifest 中说明用途，并提供降级方案（仅在用户点击时访问）：

```json
{
  "host_permissions": ["<all_urls>"],
  "permissions": ["tabs", "activeTab", "scripting"]
}
```

**任务文件修改**：`foundation.md` 章节 1 → 明确用途说明

---

## 4. 🟡 Medium 严重度问题

### 4.1 服务工作者状态存储

**规则引用** (chrome-extensions skill, 规则 #7)：
> Service workers are ephemeral — never store state in variables. Use `chrome.storage`.

**当前问题**：
- `model-management.md` 任务未明确禁止 SW 全局变量
- `chat-with-doc.md` 任务提到 Background 管理对话状态，需明确存储位置

**修复方案**：

```ts
// ❌ 错误：SW 终止后丢失
let isStreaming = false;

// ✅ 正确：持久化在 chrome.storage
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  const { isStreaming = false } = await chrome.storage.session.get('isStreaming');
  // ...
});
```

**任务文件修改**：`chat-with-doc.md` 章节 7 → 明确使用 `chrome.storage.session`

---

### 4.2 `onMessage` 异步响应必须 `return true`

**规则引用** (chrome-extensions skill, 规则 #5)：
> For `runtime.onMessage` listeners that do async work, return true

**当前问题**：
- `chat-with-doc.md` 章节 3 提到"通过 `chrome.runtime.sendMessage` / `chrome.runtime.connect`"
- 未明确 `runtime.onMessage` 异步响应需要 `return true`

**修复方案**：

```ts
// ✅ 正确：异步 + return true
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const data = await chrome.storage.local.get('key');
    sendResponse({ data });
  })();
  return true; // 关键！保持通道开放
});
```

**任务文件修改**：`foundation.md` 章节 5 → 增加 `return true` 注释

---

### 4.3 Content Script DOM 批处理

**规则引用** (chrome-extensions skill, 规则 #6)：
> When modifying many DOM elements, batch with `requestAnimationFrame` and yield between batches

**当前问题**：
- `perception.md` 章节 1 注入悬浮按钮
- 未涉及大规模 DOM 修改，但**未来扩展（如阅读模式高亮）需要此规范**

**修复方案**：

```ts
// ✅ 大规模 DOM 修改时
async function highlightAll(elements: Element[]) {
  const BATCH = 20;
  for (let i = 0; i < elements.length; i += BATCH) {
    await new Promise(r => requestAnimationFrame(() => {
      elements.slice(i, i + BATCH).forEach(el => el.classList.add('highlighted'));
      r();
    }));
  }
}
```

**任务文件修改**：`perception.md` 末尾 → 增加批处理规范注释

---

## 5. 已正确实现的设计

### 5.1 ✅ SSE 流式解析使用 `eventsource-parser`

**chromium-extensions skill 视角**：
- 选型表已选择 `eventsource-parser` 替代原生解析
- 解决了多字节字符（中文）在网络 Chunks 截断时的乱码问题
- **这是项目的关键正确决策**

**验证位置**：`detail.md` 选型表 + `package.json` 依赖

---

## 6. 修复清单（按优先级排序）

| 序号 | 文件 | 章节 | 修复内容 | 严重度 |
|------|------|------|----------|--------|
| 1 | `foundation.md` | 1 | 删除 `activeTab`，增加 `tabs`/`scripting`/`host_permissions: <all_urls>` | 🔴 |
| 2 | `foundation.md` | 1 | 增加 `manifest.action: {}` | 🟠 |
| 3 | `foundation.md` | 1（新增）| 增加 Side Panel 打开触发器子任务 | 🔴 |
| 4 | `foundation.md` | 6 | 增加图标多尺寸规范 | 🔴 |
| 5 | `foundation.md` | 5 | 增加 `onMessage` 异步响应 `return true` 注释 | 🟡 |
| 6 | `perception.md` | 1 | 删除 `world: 'MAIN'` | 🟠 |
| 7 | `perception.md` | 末尾 | 增加 DOM 批处理规范 | 🟡 |
| 8 | `chat-with-doc.md` | 7 | 明确 `chrome.storage.session` 存储状态 | 🟡 |
| 9 | `model-management.md` | 3 | API Key 存储位置说明（`chrome.storage.local`） | ✅ 已有 |
| 10 | `persistence.md` | - | 检查是否有 SW 全局变量 | - |
| 11 | `search.md` | - | Worker 通信是否使用 `chrome.runtime` | - |

---

## 7. 新增文件建议

基于评审，建议在项目根目录新增：

1. **`CHROMEWEBSTORE.md`** - Store 上架元数据（按 chrome-extensions skill Part 2）
   - 权限理由（每个权限的中文说明）
   - 隐私政策
   - 截图清单（1280×800 至少 1 张）

2. **`.manifest-checklist.md`** - manifest 字段验证清单
   - 每次 PR 前对照检查

3. **`doc/architecture/messaging.md`** - 消息协议详细文档
   - 定义所有消息类型的 payload
   - 跨上下文消息流图

---

## 8. 后续行动计划

### 立即修复（Critical & High）

1. 修改 `foundation.md` 章节 1 - 修正权限 + action 字段
2. 修改 `foundation.md` 章节 1 - 增加 Side Panel 触发器任务
3. 修改 `foundation.md` 章节 6 - 图标规范
4. 修改 `perception.md` 章节 1 - 删除 `world: 'MAIN'`

### 短期优化（Medium）

5. 修改 `foundation.md` 章节 5 - onMessage 规范
6. 修改 `perception.md` 末尾 - DOM 批处理
7. 修改 `chat-with-doc.md` 章节 7 - SW 状态存储

### 中期建设

8. 创建 `CHROMEWEBSTORE.md`
9. 创建 manifest 验证清单
10. 创建消息协议文档

---

**评审结论**：项目选型与架构基本合理，但 Manifest V3 权限配置和 Side Panel 打开机制存在严重缺陷，必须在 MVP 开发前修复。
