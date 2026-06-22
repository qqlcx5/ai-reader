# AI Reader — 产品需求文档 (PRD)

> **版本**: v2.0 (全功能融合版)
> **最后更新**: 2026-06-20
> **架构栈**: WXT + Vue 3 + Pinia + UnoCSS + highlight.js
> **技术参考**: [Obsidian Web Clipper](reference/obsidian-clipper)
· [NextAI Translator](reference/nextai-translator)
> **核心亮点**: 正文提取 · 多模型 SSE 并排流式 · 进阶工作流（圆桌/接力链）· RSS 静默总结

---

## 0. 产品定位

**AI Reader** 是一个 Chrome MV3 浏览器扩展，让用户对任意网页一键调用多个 LLM 并排对比输出结果，辅助阅读、摘要、翻译和决策。所有数据本地化、零服务依赖、零 API Key 滥用风险。

**目标用户**：重度信息消费者（产品经理、研究员、技术博主），需要快速消化长文或对照多模型观点。

---

## 1. 架构总览

### 1.1 三维入口 (Three Surfaces)

| 入口 | 尺寸 | 作用 | 入口方式 |
|------|------|------|---------|
| **Popup** | 360×450 px | 快捷轻量操作入口 | 点击工具栏图标 |
| **Side Panel** | 沉浸式 100vh | 主工作区（标签切换+网格+命令台） | Popup 触发 / `Alt+Shift+S` |
| **Options** | 全屏 | 4-Tab 配置中心 | Side Panel header 设置按钮（modal）/ 独立页签 |

**共享状态机**：所有入口都通过同一个 Pinia Store 池（`comparison` / `conversations` / `content` / `settings` / `templates` / `history` / `rss` / `workflow` / `ui`）协作。

### 1.2 模块依赖图

```
┌──────────────────────────────────────────────────────────┐
│                       UI Layer                           │
│ ┌──────────┐ ┌──────────────┐ ┌────────────┐ ┌────────┐  │
│ │ Popup    │ │ Side Panel   │ │ Options    │ │ Toast  │  │
│ │ (轻量)   │ │ (主视图)     │ │ (配置)     │ │ (全局) │  │
│ └─────┬────┘ └──────┬───────┘ └─────┬──────┘ └───▲────┘  │
└───────┼─────────────┼───────────────┼────────────┘       │
        │             │               │                    │
        ▼             ▼               ▼                    │
┌──────────────────────────────────────────────────────────┐
│                Pinia Stores (状态机)                      │
│  content · comparison · conversations · settings ·       │
│  templates · history · rss · workflow · ui               │
└─────┬────────────────────────────────────┬───────────────┘
      │                                    │
      ▼                                    ▼
┌──────────────────────┐         ┌──────────────────────┐
│  Content Extractor   │         │  LLM Providers       │
│  (defuddle 3-tier)   │         │  (OpenAI · Anthropic │
│   + Readability      │         │   · Gemini · DeepSeek│
│   + innerText        │         │   · Ollama · Custom) │
└──────────────────────┘         └──────────────────────┘
                                       │
                                       ▼
                              ┌──────────────────────┐
                              │  Service Worker      │
                              │  (RSS 后台轮询)      │
                              └──────────────────────┘
```

### 1.3 文件目录

```
ai-reader/
├── entrypoints/
│   ├── popup/App.vue          # 360×450 快捷入口
│   ├── sidepanel/App.vue      # 沉浸式主工作区（3 tabs）
│   ├── options/App.vue        # 独立全屏设置页
│   └── background.ts          # Service Worker（RSS）
├── components/                # 30+ Vue 组件
│   ├── base/                  # 9 个基础原子组件
│   ├── ModelSlot.vue          # 单模型卡片
│   ├── ComparisonGrid.vue     # 1/2/4/横向滚动网格
│   ├── ActionBar.vue          # 浮动命令台
│   ├── SettingsModal.vue      # 1.html 风格模态框
│   └── ...
├── stores/                    # 9 个 Pinia store
├── utils/
│   ├── llm/                   # Provider 抽象 + SSE
│   ├── extract/               # 三层降级提取器
│   ├── cost.ts                # Token 估算
│   ├── config-io.ts           # 导入导出
│   ├── network.ts             # 离线检测
│   └── markdown.ts            # 渲染管线
├── assets/
│   ├── theme.css              # 设计令牌（Obsidian 风格）
│   ├── provider-icons.css
│   └── code-blocks.css
└── tests/                     # 158+ 单元测试
```

---

## 2. 模块 1：内容提取 (Content Extraction)

### 2.1 三层级联降级策略 (核心鲁棒性)

确保任何网页都不翻车的级联降级：

— `defuddle` → Markdown

### 2.2 元数据捕获

每次提取必须返回：
- `title` — 文章标题
- `url` — 原始 URL
- `content` — 提取的正文（Markdown 或纯文本）
- `wordCount` — 精准字数统计
- `extractedAt` — 时间戳
- `method` — 命中层级（`defuddle-async` / `defuddle-sync` / `innerText`）

### 2.3 更新重新抓取

- 顶部更新按钮图标
---

## 3. 模块 2：AI 引擎 (Core AI Engine)

### 3.1 多模型并排对比 (核心差异化)

**流程**：
1. 用户在 ActionBar 选择模板 / 输入自定义 prompt
2. 点击 Run → 通过 `browser.runtime.connect({ name: 'llm-stream' })` **并发**连接到所有启用的 provider
3. 后台建立独立 SSE 通道 → 逐字增量推送到前端
4. 每个模型一张 `ModelSlot` 卡片，独立渲染、独立取消

**网格布局自适应**（`ComparisonGrid.vue`）：
- 1 个模型 → 单列
- 2-10个 → 横向布局/标签页展示

**卡片底部数据条**（monospace 字体）：
- `⏱️ 1240 ms` — 实时计时
- `🪙 420 tkn` — Token 估算
- `💰 $0.0012` — 成本估算
- 复制按钮 / 重试 / 停止

### 3.2 智能追问 (Follow-up)

- 每个卡片底部独立输入框
- 后台构建上下文链：`[文章内容] + [历史对话] + [新问题]`
- 不同模型的对话历史**互相隔离**（互不污染）

### 3.3 进阶 A：多角色圆桌 (Roundtable)

允许将同一篇文章分别绑定不同的 **Role Prompt**（"红队挑刺"、"狂热粉丝"、"学术派"）下发给多个模型：

- 角色在网格卡片左上角显示**角色徽章**（Role Badge + 颜色）
- 不同角色使用不同系统 prompt，但输入原文相同
- 适合观点对比、立场对照

### 3.4 进阶 B：模型接力链 (Relay Chain)

配置**串行任务链**（Model A → Model B → Model C）：

- 拦截 Model A 的 `done` 信号 → 自动将其输出作为 Model B 的输入上下文
- 卡片之间用**流式动画连接线**（`.flow-wire` + `@keyframes stream-flow`）连接
- 卡片呈半透明"只读"态直到下一步开始
- 适用场景：A 提取术语 → B 翻译 → C 润色

---

## 4. 模块 3：Provider 与提示词系统

### 4.1 Provider 矩阵

| Provider | 默认 Base URL | 默认 Model | API Key |
|----------|---------------|------------|---------|
| **OpenAI** | `https://api.openai.com/v1` | `gpt-4o` | 必填 |
| **Anthropic** | `https://api.anthropic.com` | `claude-3-5-sonnet` | 必填 |
| **Gemini** | `https://generativelanguage.googleapis.com` | `gemini-2.0-flash` | 必填 |
| **DeepSeek** | `https://api.deepseek.com` | `deepseek-chat` | 必填 |
| **Ollama** | `http://localhost:11434/v1` | `llama3` | 不需要 |
| **Custom** | 用户自定义 | 用户自定义 | 视情况 |

**Provider 抽象层**（`utils/llm/`）：
- `types.ts` — `ProviderConfig` / `StreamError` / `RoleConfig` / `ChainStepConfig`
- 每个 provider 一个文件，遵循统一接口
- 支持 SSE 流式解析 + 非流式 fallback
- 错误统一为结构化 `{ code, message, retryable }`

### 4.2 Prompt 模板系统

**内置 4 个经典模板**：
- `Summarize` (中文摘要)
- `Explain Simply` (简单解释)
- `Key Takeaways` (关键要点)
- `Action Items` (可执行建议)

**自定义模板 (Max 20 个)**：
- 增、删、改、查
- 锁定内置（不能删除，可编辑覆盖恢复）
- ActionBar 顶部**横向滑动 Pill 列表**（带渐变淡入淡出指示器）

**触发方式**：
- 点击 Pill → 自动填充到输入框
- 自定义输入后按 Enter / 点击发送
- 启动前显示**成本确认对话框**（`ActionBar` 中的 confirmation modal）

---

## 5. 模块 4：历史、存储与导出

### 5.1 本地存储

**分层策略**（`utils/storage.ts`）：

| 数据类型 | 存储方式 | 加密/压缩 |
|----------|----------|-----------|
| API Keys | `chrome.storage.local` | XOR 简单加密 |
| 历史快照 (`fullSnapshot`) | `chrome.storage.local` | **LZ-String 压缩** |
| 模板/会话状态 | `chrome.storage.local` + 内存 | 无 |
| UI 偏好（主题、tab） | `chrome.storage.local` | 无 |

**快照结构**（`history.entries[]`）：
```ts
interface HistoryEntry {
  id: string;                  // nanoid
  title: string;
  url: string;
  wordCount: number;
  prompt: string;
  responses: ModelResponse[];  // 每模型一个
  totalCost: number;
  totalTokens: number;
  createdAt: number;
}

interface ModelResponse {
  providerId: string;
  modelId: string;
  text: string;                // 完整回复
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}
```

**容量控制**：
- 上限 500 条 → 超出后 FIFO 淘汰
- 单条 snapshot 约 1.5KB（压缩后）→ 50 条 ~75KB

### 5.2 4 种导出格式

| 格式 | 用途 | 实现 |
|------|------|------|
| **Markdown** | `.md` 文件下载 | 纯字符串拼接 |
| **PDF** | 带页码的 PDF 文档 | `jsPDF` |
| **Obsidian URI** | 触发 `obsidian://` 协议 | URI 长度限制回退到剪贴板 |
| **Notion** | 适配 Notion 区块的 MD | 一键复制到剪贴板 |

**Markdown 模板**：
```markdown
# {原文章标题}

> Source: {URL} · {字数} words · {创建时间}

## 使用的 Prompt
{原 prompt}

---

## {Provider 1} - {Model 1}
{回答}

---

## {Provider 2} - {Model 2}
{回答}
```

### 5.3 配置导入/导出（不含 API Key）

- **导出**：JSON 格式，自动过滤 `apiKey` 字段
- **导入**：深合并，保留用户已有 key（避免覆盖）

---

## 6. 模块 5：配置中心 (Settings)

### 6.1 双入口设计

1. **Options 独立页签**（`options/App.vue`）— 全屏宽裕，左 240px 导航 + 右主区
2. **Side Panel 模态框**（`SettingsModal.vue`）— 720×600 居中弹窗（1.html 风格）

### 6.2 4-Tab 导航

| Tab | 内容 |
|-----|------|
| **General** | 主题（Light/Dark/Auto）、存储利用率、历史条数、累计费用、Provider 启用数、回答总数 |
| **Providers** | 6 大 provider 列表，每项：API Key（密码遮罩+显隐切换）、Base URL、Model、启用 toggle、Test Connection |
| **Templates** | 模板列表（CRUD）+ "Add" 折叠表单 + 内置/自定义标签 |
| **Data** | 导出/导入 + 高危区域 "清空历史"（红色 confirm） |

## 8. 模块 7：RSS 自动化专区 (后台静默总结)

### 8.1 核心能力

- **Service Worker 后台运作**：注册 `chrome.alarms` 定时器（默认 30 分钟）
- 拉取配置的 RSS XML 源 → 解析 → 提取新条目
- 静默调用默认模型生成**简短摘要**（3 个 bullet points）
- 摘要 + 元数据存入 `chrome.storage.local`（带 LZ-String 压缩）

### 8.2 Side Panel 视图

独立的 `RSS Digest` 标签页（与 workspace / history 平级）：

- 顶部工具栏：返回 / 标题 / 筛选 / 未读数 Pill（绿色）
- 时间轴列表：按时间倒序
- 卡片元素：
  - 源名 + 发布时间 + 未读绿点
  - 文章标题（点击跳原页）
  - AI 摘要框（可折叠）
  - 操作：Full Conversation / Copy / Mark Read / Export

### 8.3 高级功能

- **分类筛选**：8 个分类（AI/技术/财经/产品/设计/...）
- **关键词过滤**：实时搜索
- **收藏/稍后读**
- **OPML 导入/导出**
- **AI 标签自动归类**
- **跨源去重**（按 URL hash）
- **Badge 提醒**：未读数显示在工具栏图标上

---


### 9.2 UI 验证

- Playwright 1.61 + Chrome for Testing
- 手动 `pnpm shoot` 截全屏图（popup / sidepanel 亮/暗 / settings modal）
- 仓库根目录 `shoot.mjs`

### 9.3 验证命令

```bash
pnpm test           # vitest
pnpm build          # wxt + vue-tsc + rolldown
npx vue-tsc --noEmit  # 纯类型检查
pnpm shoot          # Playwright 截图
```

---

## 10. 实现状态总览

| 模块 | 完成度 | 测试 | 备注 |
|------|--------|------|------|
| 模块 1：内容提取 | ✅ 100% | ✅ | 三层降级 + Stale 检测 |
| 模块 2：多模型并排 | ✅ 100% | ✅ | SSE + 网格自适应 + 卡片控制 |
| 模块 2：智能追问 | ✅ 100% | ✅ | 上下文链 + 隔离 |
| 模块 2：圆桌模式 | ✅ 100% | ✅ | 角色徽章 + 不同 prompt |
| 模块 2：接力链 | ✅ 100% | ✅ | 流式连接线动画 |
| 模块 3：6 Providers | ✅ 100% | ⚠️ 部分 | Custom 需用户配置 |
| 模块 3：Prompt 模板 | ✅ 100% | ✅ | 4 内置 + 20 自定义 |
| 模块 4：历史记录 | ✅ 100% | ✅ | LZ-String + 50 上限 |
| 模块 4：4 种导出 | ✅ 100% | ✅ | MD/PDF/Obsidian/Notion |
| 模块 5：Settings 4-Tab | ✅ 100% | ✅ | Modal + 独立页双入口 |
| 模块 6：设计系统 | ✅ 100% | - | Obsidian 风格 |
| 模块 6：快捷键 | ✅ 100% | - | 全局 + Esc 通用 |
| 模块 6：离线检测 | ✅ 100% | - | 真实 + 模拟 |
| 模块 7：RSS 基础 | ✅ 100% | ✅ | 10 默认源 + 8 分类 |
| 模块 7：RSS 高级 | ✅ 100% | ✅ | 收藏/OPML/AI 标签/去重 |

**整体状态**：所有核心功能已实现，测试通过率 100%。等待最终 `pnpm shoot` 视觉确认。

---

## 11. 已知问题与约束

| 约束 | 说明 | 影响 |
|------|------|------|
| Chrome for Testing 1228 | 在某些 macOS 沙箱中 Mach port 失败崩溃 | 截图脚本需用 system Chrome 149 |
| `structuredClone` 与 Vue reactive | `save()` 中需浅复制 `[...enabledProviders.value]` | Bug 已修复 |
| Service Worker 生命周期 | popup/sidepanel 截图时机需调整 | MV3 已知问题 |
| 扩展加载 content verification | 需要 `--disable-extensions-content-verification` 标记 | 开发模式 |
| `browser.runtime.openOptionsPage` | Chrome 149 行为不稳定 | 改用 `manifest.openInTab: true` |

---

## 12. 可复用成熟库（Library Reuse Strategy）

> **原则**：**能用社区库解决的不手写**。自研仅在"无成熟替代 / 替代品不满足需求"时才启动。下列清单按 **优先级** 与 **影响面** 排序。

### 12.1 优先级 P0（高影响 / 建议立即引入）

#### 12.1.1 VueUse 工具集 → 替代 70% 通用 composables

| 当前自研 | 建议库 | 收益 |
|----------|--------|------|
| `utils/network.ts` (`useNetworkStatus` 20 行) | `@vueuse/core` 的 `useOnline()` / `useNetwork()` | 减少 1 个文件，事件绑定/解绑/SSR 全自动 |
| 自研 `dayjs` wrapper | `@vueuse/core` 的 `useDateFormat` / `useNow` | 实时格式化免维护 |
| `sessionStorage` 临时态管理 | `useStorage` / `useLocalStorage` | 自动响应式 + 类型推断 + 多 tab 同步 |
| 自研 Theme Toggle 持久化 | `useColorMode` / `useDark` | 自动跟随系统 + 主题切换零代码 |
| 监听 `resize` / `intersection` 手动实现 | `useResizeObserver` / `useIntersectionObserver` / `useElementSize` | 性能优化，组件虚拟化用得上 |

**安装**：`pnpm add @vueuse/core`（~50KB gzip tree-shakeable）

#### 12.1.2 SSE 流解析 → 替换自研 `readSSEStream`

| 当前 | 建议 |
|------|------|
| `utils/llm/sse.ts` (35 行手写) | **`@microsoft/fetch-event-source`** 或 **`eventsource-parser`** |

- `eventsource-parser`：Vercel AI SDK 底层使用的解析器，兼容 SSE 规范的所有边界情况
- 自研版本在跨 chunk 边界、UTF-8 多字节字符、heartbeat 注释行上有边界 bug
- 收益：4 个 provider 的流式代码可统一，~30 行代码下降

#### 12.1.3 Token 计数 → 替换自研 `estimateTokens`

| 当前 | 建议 |
|------|------|
| `utils/cost.ts` (字符正则为中英文粗估) | **`gpt-tokenizer`** (OpenAI tiktoken 移植到浏览器/Worker) 或 **`tiktoken`** (WASM) |

- 自研按"中文 1.5 / 英文 0.25"估算误差 ±30%
- `gpt-tokenizer` 使用 BPE 算法，对 OpenAI/Anthropic/Gemini 都准确
- 成本估算（`estimateCost`）仍可保留，但 token 输入要更准
- 收益：成本预估从 ±30% 误差降至 ±5% 以内

#### 12.1.4 RSS 解析 → 替换自研 `parseRSSFeed` (458 行)

| 当前 | 建议 |
|------|------|
| `utils/rss.ts` (DOMParser + regex fallback) | **`rss-parser`** (50KB, 1.2M 周下载) |

- 自研在 CDATA、命名空间、Atom 兼容上踩坑无数
- `rss-parser` 支持 RSS 0.9x/2.0/Atom 1.0 + 命名空间 + 错误恢复
- 收益：删掉 ~400 行代码，bugfix 速度跟上游

### 12.2 优先级 P1（中影响 / 第二批引入）

#### 12.2.1 UI 原子组件 → 考虑 Radix Vue / Reka UI

`components/base/` 当前 9 个手写组件：BaseButton/BaseCard/BaseDialog/BaseIconButton/BaseInput/BaseSpinner/BaseState/BaseTextarea/BaseToggle。

| 场景 | 建议 | 收益 |
|------|------|------|
| BaseDialog / Modal | **Reka UI** (`Dialog` 原语) | 自动 focus trap / Esc 关闭 / 滚动锁定 / ARIA 完备 |
| Tooltip / Popover | Reka UI `HoverCard` / `Tooltip` | 浮层定位 + 键盘可达性 |
| Dropdown Menu | Reka UI `DropdownMenu` | 与 lucide-vue-next 完美集成 |
| Switch / Toggle | Reka UI `Switch` | 受控/非受控 + form 集成 |
| Tabs | Reka UI `Tabs` | 键盘导航 + 路由联动 |
| RadioGroup | Reka UI `RadioGroup` | 单选群组 + 方向键导航 |

**核心价值**：手写组件的 a11y 总是差一截，Reka UI（Radix 的 Vue 移植）开箱即达到 WCAG AA。BaseButton 这种简单组件可以保留自研以贴合品牌色，但 Dialog/Popover/DropdownMenu 这类"行为复杂、a11y 敏感"的全部用 Reka UI。

**对比备选**：
- `shadcn-vue`：基于 Reka UI 的复制粘贴版，源码所有权在你手里，但要自己写 CSS
- `element-plus`：完整但太重（300KB+），设计语言是 Element 而非 Obsidian
- `naive-ui`：更轻量（~80KB），但 a11y 不如 Reka UI

**建议**：Reka UI（headless） + UnoCSS（样式） + 自研 1-2 个品牌专用组件

#### 12.2.2 表单校验 → 替换 Settings 页自研校验

| 当前 | 建议 |
|------|------|
| Settings 各字段手写 if-else 校验 | **`@vee-validate/zod` + `zod`** |

- `zod` 定义 schema → 复用 TS 类型 → 自动表单验证
- 特别适合 Provider 配置（API Key 格式 / URL 合法性 / Model ID 非空）

#### 12.2.3 Pinia 持久化 → 替换手写 chrome.storage 适配

| 当前 | 建议 |
|------|------|
| `utils/compress.ts` (LZ-String) + 手动 `chrome.storage.local` 调用 | **`pinia-plugin-persistedstate`** |

- 自动按 store 持久化（paths / serializer / key 自定义）
- 仍可保留 LZ-String 作为自定义 serializer
- 减少 ~80% 持久化样板代码

#### 12.2.4 Toast / 通知 → 替换自研 toast 队列

| 当前 | 建议 |
|------|------|
| `stores/ui.ts` 中的 `toastQueue` 手写 | **`vue-sonner`** (Vercel 风格的 toast) |

- 自研 toast 难做"滑动消失 / 队列上限 / Promise 集成"
- `vue-sonner` 仅 4KB，自动堆叠、a11y 友好、支持 promise 形式调用

### 12.3 优先级 P2（小影响 / 优化项）

| 场景 | 当前 | 建议库 | 收益 |
|------|------|--------|------|
| 虚拟滚动 | 50+ 历史记录全量渲染 | **`vue-virtual-scroller`** | 1000+ 条仍流畅 |
| 拖拽排序 | 模板顺序手写上下箭头 | **`vue-draggable-plus`** (Sortable.js Vue 包装) | 直观交互 |
| 文件下载 | `URL.createObjectURL` 手动 | **`file-saver`** | 边角情况全覆盖（IE 兼容、移动端） |
| OPML 导入导出 | 自研 | **`opml`** 包 | RSS 互操作标准 |
| IndexedDB | 未使用（chrome.storage 够用） | **`idb-keyval`** | 突破 5MB 限制，RSS 全量缓存 |
| HTTP 客户端 | 原生 fetch | **`ofetch`** (Nuxt 出品) | 自动重试 / 拦截器 / 类型化 body |
| 颜色 picker | 未提供 | **`@vueuse/color`** | 主题定制器 |
| 动效 | 自写 @keyframes | **`@vueuse/motion`** | v-motion 指令简化入场/出场 |
| 数字动画 | Token 计数突变 | **`@vueuse/core` 的 `useTransition`** | 数字 tween 动画 |
| 相对时间 | "5 分钟前" 手算 | **`dayjs` 的 `fromNow()`**（已装但没用） | 0 成本 |
| 图标库 | lucide-vue-next (已装 ✅) | —— | 保留 |
| Markdown | markdown-it + DOMPurify + highlight.js (已装 ✅) | —— | **已经是最优组合** |
| 压缩 | lz-string (已装 ✅) | —— | 保留 |

### 12.4 不建议引入（保持自研）

| 模块 | 原因 |
|------|------|
| **多模型 Provider 抽象层** | 6 个 provider 各家 API 行为差异大（Anthropic 是 SSE JSON-event，OpenAI 是 SSE `data: [DONE]`，Gemini 是分块 JSON），库反而增加适配层 |
| **Prompt 模板引擎** | 简单的 `{{variable}}` 替换够用，引入模板引擎（handlebars/liquid）过重 |
| **Cost 定价表** | Provider 价格表需要随时更新，自己维护更可控 |
| **样式系统** | UnoCSS + CSS 变量已是最佳实践，不需要 styled-components/emotion |
| **状态机** | Pinia 已经够用，XState 仅在 Roundtable/Chain 复杂编排时再考虑 |
| **Service Worker 工具** | WXT 已封装好，无需 workbox |

### 12.5 建议的最终依赖矩阵

```jsonc
// 新增
{
  "dependencies": {
    "@vueuse/core": "^11.x",              // P0 通用 composables
    "eventsource-parser": "^2.x",         // P0 SSE 解析
    "gpt-tokenizer": "^2.x",              // P0 Token 计数
    "rss-parser": "^3.x",                 // P0 RSS 解析
    "reka-ui": "^1.x",                    // P1 headless 组件
    "vee-validate": "^4.x",               // P1 表单
    "zod": "^3.x",                        // P1 schema
    "pinia-plugin-persistedstate": "^4.x",// P1 持久化
    "vue-sonner": "^1.x",                 // P1 toast
    "vue-virtual-scroller": "^2.x",       // P2 虚拟滚动
    "vue-draggable-plus": "^0.5.x",       // P2 拖拽
    "file-saver": "^2.x",                 // P2 文件下载
    "opml": "^1.x",                       // P2 OPML
    "idb-keyval": "^6.x",                 // P2 IndexedDB
    "ofetch": "^1.x"                      // P2 HTTP
  }
}
```

**包体估算**：新增依赖 +~280KB（tree-shake 后），但能删掉约 800 行自研代码，净 ROI 极高。

### 12.6 迁移路线图

| 阶段 | 内容 | 估时 |
|------|------|------|
| **Stage 1 (P0)** | 引入 VueUse + eventsource-parser + gpt-tokenizer + rss-parser | 1-2 天 |
| **Stage 2 (P1)** | 引入 Reka UI（先迁移 Dialog/DropdownMenu/Switch） + VeeValidate + persistedstate + sonner | 3-5 天 |
| **Stage 3 (P2)** | 虚拟滚动、拖拽、文件下载、OPML、IndexedDB 视需求引入 | 按需 |
| **Stage 4** | 删除自研代码、整理文档、更新 PRD | 1 天 |

---

## 13. 排除范围 (Out of Scope)

明确**不**包含在 v2.0 中的功能：
- 文本高亮 / 划词翻译
- 多语言 i18n（仅中英混排）
- 实时协作 / 多用户
- 云端同步
- 自动摘要触发（仅手动点击）
- 语音输入/输出

---

## 14. 文档索引

- **产品需求**: [PRD.md](PRD.md)（本文档）
- **设计规范**: [design.md](design.md)（CSS 变量 + 状态机）
- **变更日志**: [CHANGELOG.md](CHANGELOG.md)
- **贡献指南**: [CONTRIBUTING.md](CONTRIBUTING.md)
- **技术参考**: [reference/obsidian-clipper](reference/obsidian-clipper) · [reference/nextai-translator](reference/nextai-translator)
