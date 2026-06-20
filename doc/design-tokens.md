# AI Reader 设计稿视觉规范（来自 design.html）

> **来源**：`/Users/another/Documents/OpenSource/ai-reader/doc/design.html`
> **用途**：所有 UI 实现必须遵循此设计风格。子 Agent 实现前端模块前必须通读 design.html 与本文件。
> **状态**：与 design.html 一一对应，design.html 为权威源；本文件为快速索引。

---

## 1. 色彩系统

```css
--bg: #f7f7f3;                 /* 页面背景 */
--card: #ffffff;                /* 卡片底色 */
--card2: #fbfaf6;               /* 次要卡片/导航悬停背景 */
--line: #e6e1d8;                /* 边框、分割线 */
--line2: #d7d0c4;               /* 边框 hover 色 */
--text: #2e2d29;                /* 主文字 */
--muted: #7b766c;               /* 次要文字 */
--muted2: #a09a90;              /* 更弱提示文字 */
--primary: #6d75f6;             /* 主强调色（紫） */
--primary2: #eef0ff;            /* 主色浅背景 */
--green: #2f9e67;                /* 成功/绿点 */
--orange: #d18a22;               /* 警告/本地模型 */
--red: #d9534f;                  /* 危险/停止 */
--blue: #3b82f6;                 /* 信息/GPT */
```

### 渐变与背景
- 页面背景：双重径向渐变 + `var(--bg)`
- 左上方：紫色弱光晕 `rgba(109,117,246,.09)`
- 右上方：绿色弱光晕 `rgba(47,158,103,.06)`
- Logo：`linear-gradient(135deg, #6d75f6, #99d7ff)` + 紫色阴影

---

## 2. 字体

```css
--font: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
--mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
```

- 中文优先 PingFang SC / Microsoft YaHei
- 指标数字使用 `var(--mono)`

---

## 3. 布局

### 桌面三栏

```css
.app {
  height: 100vh;
  padding: 12px;
  display: grid;
  grid-template-columns: 250px 1fr 355px;
  gap: 12px;
}
```

- 左栏：250px（品牌 + 导航 + 策略卡片 + 快捷键）
- 中栏：自适应
- 右栏：355px（Tab 内容区）

### 面板通用样式

```css
.panel, .main, .right {
  background: rgba(255,255,255,.88);
  border: 1px solid var(--line);
  border-radius: 22px;
  box-shadow: 0 5px 15px rgba(45,42,35,.055);
  backdrop-filter: blur(14px);
  overflow: hidden;
}
```

---

## 4. 圆角与间距

| Token | 值 | 用途 |
|-------|------|------|
| `--r` | 16px | 卡片、box 默认圆角 |
| `--r2` | 11px | 按钮、输入框圆角 |
| 面板 | 22px | 三大主面板 |
| 卡片 | 18px | 模型卡片、用户消息 |
| 小按钮 | 9px | `.btn.small` |
| 导航按钮 | 13px | `.nav button` |
| 药丸 | 999px | chips、pills |
| 间距 | 12px | 通用 gap、padding 基础 |

---

## 5. 阴影

```css
--shadow: 0 12px 32px rgba(45,42,35,.08);   /* 悬浮元素、modal、popup */
--shadow2: 0 5px 15px rgba(45,42,35,.055);  /* 卡片、面板 */
```

---

## 6. 组件规范

### 6.1 品牌区

- 高度：68px
- Logo：35×35px，12px 圆角，紫色渐变
- 标题：16px 加粗
- 副标题：小字，muted 色

### 6.2 导航按钮

```css
.nav button {
  border: 1px solid transparent;
  background: transparent;
  text-align: left;
  border-radius: 13px;
  padding: 10px 11px;
  font-size: 14px;
  display: flex;
  gap: 9px;
  align-items: center;
}
.nav button.active {
  background: var(--primary2);
  border-color: #dce0ff;
  color: #4148d4;
  font-weight: 700;
}
```

### 6.3 策略小卡片（.mini）

- 背景：`var(--card2)`
- 边框：`1px solid var(--line)`
- 圆角：16px
- 标题：13px 加粗
- 描述：12px，muted 色，行高 1.55

### 6.4 顶部上下文栏（.top）

- 高度：66px
- 左侧：favicon 容器 + small 提示 + 标题（ellipsis，最大 560px）
- 右侧：操作按钮组
- 底部：subbar（chips + 技术标签）

### 6.5 按钮（.btn）

```css
.btn {
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 11px;
  padding: 8px 11px;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: .15s;
}
.btn:hover { background: #f8f6f1; border-color: var(--line2); }
.btn.primary { background: var(--primary); border-color: var(--primary); color: #fff; }
.btn.red { background: #fff6f6; border-color: #efcfcc; color: var(--red); }
.btn.green { background: #eefbf4; border-color: #cfeede; color: #247b50; }
```

### 6.6 用户消息气泡（.user）

```css
.user {
  max-width: 78%;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 18px 18px 18px 7px;
  padding: 13px 15px;
  font-size: 14px;
  line-height: 1.65;
  box-shadow: var(--shadow2);
}
```

### 6.7 模型卡片（.card）

- 2 列网格：`grid-template-columns: repeat(2, minmax(0, 1fr))`
- 卡片头部：浅背景 `#fbfaf7`，底部边框
- 模型名 + 状态 dot
- 内容区：最小高度 170px，14px，行高 1.72，保留换行
- 底部：指标 + 操作按钮
- 流式中：`.typing:after { content: "▋"; animation: blink .8s infinite }`

### 6.8 Chips 与 Pills

- `.chip`：12px，圆角 999px，默认白底 + 边框；激活态紫底；绿色为成功；黄色为警告
- `.pill`：模型选择器，内含 checkbox，边框圆角

### 6.9 输入框与文本域

```css
textarea {
  resize: none;
  min-height: 58px;
  max-height: 130px;
  border: 1px solid var(--line);
  border-radius: 15px;
  padding: 12px 13px;
  font-size: 14px;
  line-height: 1.55;
}
textarea:focus {
  border-color: #c0c5ff;
  box-shadow: 0 0 0 3px rgba(109,117,246,.12);
}
```

### 6.10 右侧面板 Tab

- 6 等分：`grid-template-columns: repeat(6, 1fr)`
- 激活态：底部 2px 紫线 + 浅背景
- 内容区：`.right-body` 滚动

### 6.11 Box 容器

```css
.box {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 12px;
  box-shadow: 0 4px 12px rgba(45,42,35,.035);
}
.box h3 { font-size: 14px; margin: 0 0 9px; }
```

### 6.12 列表项（.item）

- 白底、边框、16px 圆角
- hover：浅紫背景 + 紫边框
- 未读：左侧 4px 紫边 `.unread`

### 6.13 开关（.sw）

- 42×24px 胶囊
- 关闭：灰色 `#ddd7cc`
- 开启：紫色 `var(--primary)`
- 白色圆点 + 过渡动画

### 6.14 Modal / Toast / Popup

- Modal：深色半透明遮罩 + 模糊，最大 620px，22px 圆角
- Toast：底部居中，深色胶囊
- Popup：固定左上角，330px，22px 圆角，白色

---

## 7. 响应式断点

```css
@media (max-width: 1250px) {
  .app { grid-template-columns: 220px 1fr; }
  .right { display: none; }
  .grid { grid-template-columns: 1fr; }
}

@media (max-width: 820px) {
  .app { grid-template-columns: 1fr; padding: 8px; }
  .panel { display: none; }
  .ctx b { max-width: 230px; }
  .top { padding: 0 12px; }
  .grid { grid-template-columns: 1fr; }
  .user { max-width: 100%; }
}
```

---

## 8. 交互与动画

- 按钮 hover：0.15s 过渡
- 开关圆点：0.15s 过渡
- 打字光标：0.8s 闪烁
- 进度条：0.2s 过渡
- 滚动条：9px 宽，#ddd7cc 圆角

---

## 9. 实现要求

1. 在 WXT + Vue 3 项目中使用 CSS 变量（或 Tailwind/UnoCSS 配置）实现上述 token。
2. 三大面板（左/中/右）必须按桌面三栏布局实现。
3. 组件命名可参考本文件中的 class 名，但允许根据 Vue 组件规范调整。
4. 所有颜色、圆角、阴影、间距必须与设计稿一致，不得随意更改。
5. 实现完成后，应在常见分辨率（1920、1440、1250、820、375）下验证布局。
