# 🗺️ 第一部分：AI Reader v2.0 认知地图与交互架构

在动手写代码前，我们必须通过 **MECE 原则** 理清这款复杂扩展的空间结构。整个扩展由三个维度（Popup、Side Panel、Options）组成，它们共享同一个状态机（Pinia Store），但承载不同的交互密度：

```
                              [ AI Reader 2.0 ]
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         ▼                            ▼                            ▼
  【 Popup (轻量入口)】       【 Side Panel (沉浸工作区)】     【 Options (配置大盘)】
  ┌──────────────────┐       ┌────────────────────────┐   ┌────────────────────────┐
  │ 1. 简易页面抓取   │       │ 1. 三层降级正文状态区   │   │ 1. General: 历史用量大盘│
  │ 2. 快捷一键总结   │       │ 2. Prompt 模板滑动条    │   │ 2. Providers: 多服务配置│
  │ 3. 唤醒 SidePanel│       │ 3. 动态多模型 SSE 网格  │   │ 3. Templates: 增删改查  │
  └──────────────────┘       │ 4. 智能追问 & 链式流    │   │ 4. Data: 脱敏导入导出   │
                             │ 5. RSS 自动化静默简报   │   └────────────────────────┘
                             └────────────────────────┘
```

---

# 🎨 第二部分：设计系统与视觉规范 (Obsidian-inspired Light Theme)

我们致敬 **Obsidian** 的经典质感，采用**非纯白（Slate-tinted Off-white）**的纸张视觉体验。通过细微的边框阴影、单色调（Monochrome）加高饱和度功能色，来传达极高专业度与极低的视觉疲劳。

### 1. UnoCSS 语义化色彩与样式变量

```js
// unocss.config.ts / Tailwind Theme Extends
export const theme = {
  colors: {
    bg: {
      canvas: '#F9F9FB',    // 整个面板的底色（微冷浅灰，舒缓视觉）
      surface: '#FFFFFF',   // 卡片、输入框、容器的前景色（纯白）
      sunken: '#F3F4F6',    // 灰色凹陷背景（如：未激活选项卡、代码块）
    },
    border: {
      subtle: '#E5E7EB',    // 极细分割线（类似 Obsidian 默认 border）
      focus: '#6366F1',     // 聚焦状态（经典 Indigo 靛蓝）
    },
    text: {
      primary: '#1F2937',   // 正文、标题（深炭灰，比纯黑更柔和）
      secondary: '#4B5563', // 次要说明、元数据、字数
      muted: '#9CA3AF',     // 禁用、占位符
    },
    brand: {
      primary: '#4F46E5',   // 品牌色（Indigo-600）
      accent: '#0F172A',    // 强调色（Slate-900，黑白极简风）
    },
    status: {
      success: '#10B981',   // 绿色（耗时低、费用计算、成功）
      warning: '#F59E0B',   // 橙色（Stale 过期标记、警告）
      danger: '#EF4444',    // 红色（中止、错误拦截、清空）
    }
  },
  boxShadow: {
    'subtle-card': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
    'tactile': '0 1px 2px 0 rgba(0,0,0,0.02), inset 0 1px 0 0 rgba(255,255,255,0.8)',
  }
}
```

---

# 🛠️ 第三部分：全套前端 UI 提示词

以下提示词专为快速生成高质量 Vue 3 + UnoCSS 页面而设计。

## 💡 提示词 1：Side Panel 核心工作流面板 (主视图)

> **Copy & Paste to AI Code Generator:**

```markdown
Role: Senior Frontend Engineer & UI/UX Specialist
Stack: Vue 3 (Composition API), Pinia, UnoCSS (Tailwind-compatible)
Task: Build the "Side Panel" interface for "AI Reader Browser Extension" using an Obsidian-inspired Light Theme.

[Layout Structure]
1. Header Section:
   - Sticky top. Show current article title (truncated with ellipsis), domain icon, and original URL.
   - Word count pill (e.g., "1,245 words") and a "Status Indicator" pill showing either:
     - "Defuddle-Async" (Green text/bg, success)
     - "Defuddle-Sync" (Blue text/bg)
     - "Raw DOM Text" (Amber text/bg, fallback)
   - "Stale Detector" Indicator: If metadata is older than 5 mins, show a subtle amber banner at the top: "⚠️ Content may be stale. [Recapture Page]" (styled like Obsidian notice).
   - "RSS Panel Toggle" button (icon-only, book/bell icon) on the top right.

2. ActionBar (Prompts Selector):
   - Horizontal scrolling list of pill-buttons with smooth fading indicators on left/right ends.
   - Built-in templates as pills (with icons): "Summarize", "Explain Simply", "Key Takeaways", "Action Items".
   - A toggle to switch from "Standard Mode" to "Advanced Mode" (Roundtable / Relay Chain).

3. Advanced Workflow Configurator (Collapsible panel, visible when Advanced Mode is active):
   - Option A (Role Roundtable): Add/remove role tags (e.g., "Red Team Critic", "Supportive fan") and bind them to active models.
   - Option B (Model Relay Chain): Shows a workflow line `[Model A: Extract Keys] ──► [Model B: Translate]`.

4. Main SSE Grid (Multi-Model Output):
   - A dynamic CSS Grid that adapts layout based on active model count (1 model = col-1, 2-4 models = cols-2, >4 models = horizontal scrollable track).
   - Each model card is white (`bg-surface`), has a 1px border (`border-subtle`), and a tactile shadow (`shadow-subtle-card`).
   - Card Header: Model Name (e.g., "Claude 3.5 Sonnet"), Status (Spinning loader / Done / Stopped), and actions (Individual Retry button, Stop button).
   - Card Body: SSE stream rendered output. Clean typography, monospace font for numbers/codes, subtle line-height (1.6).
   - Card Footer: Micro-metadata with high information density:
     - Time Elapsed: "420ms" (using green/amber depending on speed).
     - Tokens Count: "~2.4k tokens" (using dark gray text).
     - Estimated Cost: "$0.0034" (muted gray).
   - Global Control floating bar at the bottom: "Stop All" (Red outline button), "Regenerate All" (Indigo solid button).

5. Chat Input (Bottom Sticky):
   - Textured off-white background (`bg-canvas`) matching the sidebar.
   - A clean textarea with auto-growing height, a placeholder "Ask follow-up questions to all active models...", and an action bar at the bottom right containing the "Send" button (paperplane icon) and an "Enter to Send / Shift+Enter to newline" micro-hint.

[Visual Style details]
- Fonts: Sans-serif system font for UI, Monospace (`font-mono`) for metrics (Token, cost, timing, status).
- Scrollbar: Thin, rounded, minimalist.
- Ensure all borders are exactly 1px, colors matching `#E5E7EB` (Light Gray) to keep the flat, elegant Obsidian look. Use light system icons (Lucide or Heroicons).
```

---

## 💡 提示词 2：Popup 快速悬浮窗

> **Copy & Paste to AI Code Generator:**

```markdown
Role: Senior UI Designer
Stack: Vue 3, UnoCSS
Task: Build the browser extension "Popup" UI. Maximum size: 360px width, 450px height. Light Obsidian-inspired Theme.

[Layout Design]
1. Header:
   - Small, tactile header. Show Logo (AI Reader in Monospace) and current connection status (a green pulsing dot next to "Local Engine Active").
   - A gear icon pointing to the Options page on the top right.

2. Current Page Capture Card (Upper half):
   - Bordered box (`border-subtle`, `bg-surface`) representing the currently active tab.
   - Show Tab Favicon, Tab Title (2 lines max, clamped), and total estimated word count.
   - Quick action button: "Summarize Now" (Large solid Black/Dark Indigo button, text "Run Default summary"). Clicking this triggers the summary and immediately opens the browser Side Panel.

3. Quick Presets / History Snapshot (Lower half):
   - A section titled "Recent Captures".
   - Render a list of the 3 most recent history records with quick metadata: Title, URL, and the models used.
   - Include a "View Full History" button at the bottom of the list that deep-links into the Side Panel history tab.

[Visual Polish]
- Utilize Tailwind classes to style beautiful hover transitions (e.g., `hover:bg-sunken`, `transition-all duration-200`).
- Border-radius should be exactly `rounded-md` (6px) or `rounded-lg` (8px) for cards to match Obsidian's strict UI architecture.
```

---

## 💡 提示词 3：Options 页面 (配置与大盘)

> **Copy & Paste to AI Code Generator:**

```markdown
Role: Lead Frontend UI Engineer
Stack: Vue 3, Pinia, UnoCSS
Task: Build the "Options Page" (Full screen) with 4-Tab navigation. Obsidian-inspired Light Theme.

[Structure & Layout]
1. Sidebar Navigation (Left 240px wide):
   - Logo at the top: AI Reader Options.
   - Navigation vertical menu:
     - Tab 1: General (Dashboard & Stats)
     - Tab 2: Providers (AI Engine Matrix)
     - Tab 3: Templates (Prompt Manager)
     - Tab 4: Data (Import/Export & Maintenance)

2. Main Settings Canvas (Right panel, scrollable):
   - White surface container with subtle shadows and border lines separating sections.

[Tab Components Details]
- **Tab 1: General (Dashboard & Stats)**:
  - System Theme Toggle: 3-segmented control (Light / Dark / System) with a smooth sliding indicator.
  - Usage Statistics Cards (Grid of 3 cards):
    - Card A: Total Summaries Saved (e.g., "142 records").
    - Card B: API Cost Burn (e.g., "$12.43" with green subtitle "Estimated local savings").
    - Card C: Models Active (e.g., "3 of 6 providers enabled").
  - Underneath, show a stylized horizontal bar graph representing "Most Used Models".

- **Tab 2: Providers (API Engine Config)**:
  - List of 6 Providers (OpenAI, Anthropic, Gemini, DeepSeek, Ollama, Custom OpenAI API).
  - Each provider is an accordion. When expanded:
    - Input fields for: Base URL (with placeholders), API Key (password masking with show/hide eye icon), Default Model ID.
    - An active toggle switch on the right side of the accordion header (green when enabled).
    - An instant "Test Connection" button next to fields that triggers a small ping to the API and displays a subtle checkmark (Success) or error badge (Fail).

- **Tab 3: Templates (Prompt Manager)**:
  - Split view. Left side: list of prompt templates with drag-and-drop drag handles (built-in templates are locked, custom templates have "Edit" and "Delete" icons).
  - Right side: Template Editor (Input field for Title, Category tags, and large code-friendly Monospace textarea for the prompt body).

- **Tab 4: Data (Data & Privacy)**:
  - Safe Export Section: Large card with a "Export Config (De-sensitized)" button. Subtext: "API Keys will NOT be exported for your security."
  - Import Config: Drop zone or file-selector input to parse JSON.
  - High-Risk Area (Red bordered card): "Danger Zone". Button: "Purge All History & Settings". Requires confirming by typing "DELETE" in a confirmation modal.

[Visual Polish]
- Inputs should have `#F9F9FB` background, changing to white `#FFFFFF` on focus, with a thin focus ring of Indigo.
- Make all transitions buttery smooth. Use monospace font for billing details and API keys.
```

---

## 💡 提示词 4：RSS Digest 自动化专区 (全新静默总结面板)

> **Copy & Paste to AI Code Generator:**

```markdown
Role: Senior UX/UI Developer
Stack: Vue 3, Pinia, UnoCSS
Task: Create the "RSS Digest" view for the Side Panel, showing background summarization feed.

[Layout Design]
1. Top Toolbar:
   - "Back" button to return to Main Side Panel.
   - RSS configuration trigger (opens options).
   - "Unread badge" indicator (e.g., "8 unread summaries" in a green Pill).

2. Digest Feed (Scrollable Timeline):
   - Chronological vertical timeline of feeds.
   - Each feed item card has:
     - Header: RSS source name (e.g., "TechCrunch"), publication date, and an "Unread" green dot indicator.
     - Content Title: The article title (clickable link to open original page).
     - AI Summary Box: A collapsible box containing 3-bullet points of default summary generated in the background by the Service Worker.
     - Actions row: "Full Conversation" (turns this summary into an active multi-model chat inside the main sidepanel), "Copy Summary", "Mark as Read", "Export to Obsidian".

[Visual Accents]
- Timeline line: A subtle dashed vertical line (`border-dashed border-l-2 border-subtle`) running down the left side of cards.
- Ensure summaries are rendered in a slightly smaller font size (`text-sm`) with rich line spacing to improve readability on narrow screens.
```

---

# 🎨 第四部分：核心交互流 (UX State Transitions)

为了确保用户在使用多模型并排输出和工作流时的心智模型不混乱，我们设计了以下交互状态机制：

### 1. 多模型 SSE 网格流式输出状态 (The SSE Grid Stream)
如同 **Feynman 费曼技巧**：把 SSE 流式输出卡片想象成一排**“正在现场直播的打印机”**。

*   **正在打印（Streaming）**：卡片边框闪烁极细的蓝色光晕（`animate-pulse`），右下角计时器（`ms`）数字实时滚动，停止按钮可用。
*   **打印中断（Aborted）**：文字截断，底部显示 `[⚠️ Interrupted by User]` 标记，边框恢复灰色。
*   **打印完成（Done）**：卡片呈现宁静的浅绿底色微弱阴影，计时器静止，显示确切估算的 Token 消耗与花费金额。

```
[ 模型 A 卡片: Claude 3.5 ]
├─ 状态: 🔴 正在流式输出中... (边框淡蓝呼吸灯)
├─ 文本: "AI Reader 2.0 是一款革命性的..." ✍️
└─ 底部: ⏱️ 1240ms | 🪙 420 tkn | 💰 $0.0012 | [ ⏹️ 停止 ]

[ 模型 B 卡片: GPT-4o ]
├─ 状态: ✅ 输出完成 (卡片静止)
├─ 文本: "本项目基于 WXT 和 Vue3 架构开发..."
└─ 底部: ⏱️ 850ms | 🪙 390 tkn | 💰 $0.0019 | [ 🔄 重试 ]
```

### 2. 多角色圆桌讨论 (Roundtable) 与 模型接力链 (Relay Chain) 的视觉映射

*   **圆桌模式（Roundtable）**：
    *   在卡片左上角打上鲜明的角色标签（Role Badge）。
    *   *例如*：`[🔴 红队挑刺: DeepSeek R1]`，`[🟢 狂热粉丝: GPT-4o]`。这能让用户直观地看到各模型在特定 prompt 设定下的思维碰撞。
*   **接力链模式（Relay Chain）**：
    *   使用连接线和渐变遮罩。第一步（Model A）输出完成后，卡片呈半透明“只读”态，并拉出一条带有动态箭头的连接线指向第二步（Model B）卡片，直观提示用户“正在传递上下文”。

---
