# AI Reader UI Design Tokens

> 从 `doc/design.html` 提取的视觉规范快速索引。所有前端模块必须按此文档实现，不确定时以 `design.html` 为准。

## 1. 色彩系统

设计稿采用基于 Obsidian/PKM 风格的浅色暖灰主题。

| Token | 值 | 用途 |
|-------|------|------|
| `bg` | `#fcfcf9` | 页面背景底色 |
| `panel` | `#ffffff` | 主面板背景 |
| `card` | `#faf9f5` | 卡片/次级面板背景 |
| `border` | `#e6e2d8` | 常规边框、分隔线 |
| `borderStrong` | `#cfc9bc` | 强边框（Popup、高对比边框） |
| `text` | `#2e2d2a` | 主文本 |
| `muted` | `#7a7568` | 辅助文本、标签 |
| `mutedLight` | `#a39d8f` | 更淡的辅助文本 |
| `primary` | `#5b60e5` | 主按钮、激活态、品牌色 |
| `primarySoft` | `#f0f1fe` | 悬停/激活背景、选中态 |
| `green` | `#248a52` | 成功状态、Gemini 等模型指示 |
| `greenSoft` | `#eefaf2` | 成功/绿色提示背景 |
| `orange` | `#ca7a15` | 警告、本地模型指示 |
| `orangeSoft` | `#fff9ee` | 橙色提示背景 |
| `red` | `#d14343` | 错误、中断、危险操作 |
| `redSoft` | `#fdf4f4` | 红色提示背景 |
| 搜索高亮 | `#fff299` / `#5c4a00` | 搜索结果高亮背景/文字 |
| 滚动条 | `#dedad0` | 自定义滚动条 thumb |
| Toast 背景 | `#2d2c29` | 底部通知深色背景 |
| Modal 遮罩 | `rgba(0,0,0,0.35)` | 弹窗遮罩 + backdrop-blur |

## 2. 字体与排版

- 字体栈：系统无衬线（`font-sans`），默认使用 Tailwind 无衬线栈。
- 代码/等宽：用于 Token、长度、时间、状态指标等。
- 标题层级：
  - 品牌标题：`font-black text-sm leading-none`
  - 页面子标题：`text-xs font-bold`
  - 卡片标题：`text-xs font-bold`
  - 辅助标签：`text-[10px] font-bold uppercase tracking-wider`
  - 正文：`text-xs` / `text-[11px]` / `text-[10px]`
- Markdown 内容区：
  - H1: `text-base font-extrabold`
  - H2: `text-sm font-bold`
  - P/List: `text-xs leading-relaxed`
  - Pre: `text-[11px] font-mono`
  - Code: `text-[11px] font-bold`

## 3. 布局

### 桌面端三栏

```css
grid-template-columns: 250px 1fr 360px;
gap: 12px;
padding: 12px;
height: 100vh;
```

- 左栏：品牌 + 主导航 + 技术上下文（固定 250px）
- 中栏：主工作区（1fr，可切换 Chat / Panel 视图）
- 右栏：选项与工具面板（固定 360px），含标签页切换

### 响应式断点

- `lg`: 桌面三栏 `250px 1fr 360px`
- 小于约 1250px：隐藏右栏（右栏内容可并入中栏 Panel 视图）
- 小于约 820px：隐藏左栏（左栏导航可折叠为顶部抽屉/按钮）
- 移动端：单列布局

## 4. 圆角与间距

| 元素 | 圆角 | 备注 |
|------|------|------|
| 主面板 | `rounded-2xl` (16px) | 白色/95% 透明 + 毛玻璃 `backdrop-blur-md` |
| 左/右/主面板 | `rounded-2xl` | 统一 16px |
| 卡片/内部面板 | `rounded-xl` (12px) | `card` 色背景 |
| 小按钮/标签 | `rounded-lg` (8px) | 小操作按钮 |
| 全圆药丸 | `rounded-full` | 选中态、Toast、计数 badge |
| 模型并发卡片 | `rounded-2xl` | 带 footer，内部 `rounded-xl` 小卡片 |
| 搜索/输入框 | `rounded-xl` | 边框聚焦态：`focus:border-primary/50` + `focus:ring-4 focus:ring-primary/10` |
| 弹窗 Modal | `rounded-2xl` | 阴影 `shadow-2xl` |

- 通用 padding/gap: 12px, 16px
- 小间距：4px, 6px, 8px
- 列表项间距：8px - 16px

## 5. 阴影

- 面板：`shadow-sm`
- 卡片/列表项 hover：`shadow-sm` / `shadow-md`
- 主按钮：`shadow-sm shadow-obsidian-primary/15`
- Popup / Modal：`shadow-2xl`
- Toast：`shadow-2xl`

## 6. 组件规范

### 6.1 品牌区

- 左栏顶部 64px 高 header
- 品牌图标：40px 圆角矩形，渐变 `from-primary to-[#8fa6ff]`，白色文字 "AR"
- 品牌标题：`font-black text-sm`，版本号 `text-[10px] text-muted`

### 6.2 主导航按钮

- 左栏垂直按钮列表
- 激活态：
  - 背景 `primarySoft`
  - 文字 `primary`
  - 边框 `border-[#d2d6ff]`
  - 字体 `font-extrabold`
  - 圆角 `rounded-xl`
- 未激活态：
  - 透明背景
  - 文字 `text`
  - 边框透明
  - hover: `bg-obsidian-bg`
- 图标：左侧 16px SVG，文字 `text-xs`
- RSS 未读计数：右侧 `rounded-full` badge，背景 `primary`，文字白色 `text-[9px]`

### 6.3 中栏顶部上下文锚定栏

- 高度 64px
- 左侧：favicon 图标（40px 圆角，边框背景）+ 标题 + 状态标签
- 右侧："模拟切换网页" 按钮 + "提取当前 Tab" 主按钮
- 主按钮：紫色背景、白色文字、圆角 `rounded-xl`、带阴影

### 6.4 全局提取状态条

- 中栏上下文栏下方
- 背景 `bg-obsidian-bg/60`
- "No Truncation" badge：绿色系 `greenSoft` 背景 + `green` 文字
- 右侧：提取引擎、数据库信息

### 6.5 对话消息区

- 用户气泡：白色背景、边框、圆角 `rounded-2xl rounded-tr-sm`，最大宽度 78%，`text-xs`
- 模型并发网格：
  - 默认单列，响应式 `md:grid-cols-2`
  - 卡片：白色背景、边框、`rounded-2xl`、`shadow-sm`
  - Header：左侧色点 + 模型名 + 状态 badge
  - Body：Markdown 渲染区，最小高度 140px
  - Footer：TTFT / TPS / Cost 指标 + 操作按钮（以此继续 / 中止 / 重试）
- 流式光标：`.typing-cursor::after` 显示 `▋` 并 `animate-pulse`

### 6.6 输入区

- 底部 composer，border-t 分隔
- 并发模型路由选择：横向换行 chips，每个 chip 为 `rounded-full` 药丸，包含复选框 + 模型名
- 文本域：圆角 `rounded-xl`，高度约 56px，最大高度 128px，自动 resize-y，placeholder 12px
- 发送按钮：紫色主按钮，右侧垂直排列：发送 + Esc 中断
- 快捷指令栏：底部 `text-[10px]`，带下划线按钮：圆桌交锋、串联接力

### 6.7 右栏标签页

- 顶部 6 等分标签栏（历史 / RSS / 工作流 / 导出 / 设置 / 架构）
- 激活态：
  - 下边框 `primary`
  - 文字 `primary`
  - 背景白色
- 未激活态：
  - 下边框透明
  - 文字 `muted`
  - hover: `text-obsidian-text`
- 字体 `text-[11px] font-extrabold`

### 6.8 右栏卡片

- 统一使用白色背景 + `border` + `rounded-xl` + `space-y-2.5`
- 标题：`text-xs font-bold text-obsidian-text`
- 描述：`text-[10px] text-obsidian-muted leading-relaxed`
- 输入框：边框 `border-obsidian-border`，圆角 `rounded-lg`，padding 约 6-10px，字体 `text-xs`
- 按钮组：白色/紫色边框按钮，小尺寸

### 6.9 RSS 列表项

- 未读：左侧 4px 紫色边框条
- 已读：`opacity-85`
- 标题 + 未读 badge
- AI 总结区域：`bg-obsidian-bg` + `border` + `rounded-lg`，`text-[11px]`
- 底部：来源/时间 + "以此开启对话" 紫色软按钮

### 6.10 工作流面板

- 圆桌/接力/提示词模板各自成卡片
- 角色卡片：3 列网格，背景 `bg-obsidian-bg`，边框，`rounded-lg`，居中
- 启动按钮：紫色主按钮或白色边框按钮

### 6.11 导出/设置面板

- 多个设置卡片堆叠
- 开关（Toggle）：
  - 开启：背景 `primary`，圆形滑块靠右
  - 关闭：背景 `#dedad0`，圆形滑块靠左
  - 尺寸约 36x20px，圆形滑块 16px
- 复选框：使用 `accent-obsidian-primary` 原生样式
- 密码输入：模拟圆点占位符

### 6.12 弹窗 Modal

- 遮罩：黑色 35% + `backdrop-blur-sm`
- 弹窗容器：白色背景 + `border` + `rounded-2xl` + `shadow-2xl`
- 标题栏：背景 `card` + border-b
- 底部操作栏：背景 `obsidian-bg` + border-t
- 主按钮：紫色

### 6.13 Toast

- 底部居中
- 深色背景 `#2d2c29`
- 白色文字
- 圆角 `rounded-full`
- 左侧带 pulsing 色点

### 6.14 Popup 浮层（扩展轻量端）

- 固定位置，宽度 330px
- 背景白色 + 强边框 `borderStrong` + `shadow-2xl` + `rounded-2xl`
- 顶部标题栏：背景 `card` + border-b
- 内容区：当前页信息卡片 + 双操作按钮

## 7. 交互与动画

- 通用过渡：150ms ease-out 进入，100ms ease-in 离开
- Popup/Modal：scale 0.95 → 1 + opacity
- Toast：translate-y 3px → 0 + opacity
- 按钮 hover：背景变化/透明度变化
- 加载状态：
  - 旋转图标：`animate-spin`
  - 脉冲点：`animate-ping` / `animate-pulse`
  - 搜索加载：居中 spinner + 文字说明
  - 进度条：紫色填充，过渡 150ms

## 8. Markdown 渲染区样式

- 使用 `.markdown-content` 类
- H1 带底部边框
- 列表使用标准 disc/decimal
- 代码块：背景 `bg-obsidian-bg`、边框、`rounded-lg`、等宽
- 行内代码：背景 `bg-obsidian-bg`、紫色文字、圆角

## 9. 实现要求

- 使用 Vue 3 + Tailwind CSS（或在 WXT 项目中通过等效 CSS 变量实现）
- 在 WXT 环境中建议将 Obsidian 色板映射为 CSS 变量，如：
  - `--obsidian-bg: #fcfcf9`
  - `--obsidian-primary: #5b60e5`
  - 等
- 主面板使用 `bg-white/95 backdrop-blur-md` 效果
- 保持 12px 全局间距、16px 面板圆角、12px 卡片圆角
- 响应式：在 1250px/820px 断点做栏位隐藏，移动端单列
- 对话区模型卡片必须支持 1→2 列响应式网格
- 所有状态标签、指标、按钮尺寸需严格参照设计稿

## 10. 与旧版 Design Tokens 的差异

- 背景色从 `#f7f7f3` 调整为 `#fcfcf9`
- 主色从 `#6d75f6` 调整为 `#5b60e5`
- 右栏宽度从 `355px` 调整为 `360px`
- 新增完整 Obsidian 色彩系列（green/orange/red soft）
- 新增 Popup 浮层、标签切换网页、上下文锚定提示 Modal
- 右栏新增 "架构" 标签页展示工程实现说明
- 导航按钮样式更统一，激活态使用 `primarySoft` + `border-[#d2d6ff]`
- 搜索高亮新增黄底样式
- 移除旧版紫色/绿色渐变光晕背景，改为更克制的 Obsidian 暖灰风格

---

**注意**：本文件为 `design.html` 的提取索引。若本文件与 `design.html` 冲突，以 `design.html` 为准。
