---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: d270bcd3df6a2cd27c2792fa9a0b45ef_a300c255718911f1b2f55254006c9bbf
    ReservedCode1: XK8DIeYl/N7PqsvvzhX+3ZGbn+ZeDUtpOfoopBfGxMJh56U3VGoL0mJE4w9yVndp1WLCnS7WHwK4+bLqK/jnC+P44JJ71Fu9Iy5rNRA7Ax8zofKWZMPLUYCsC0D9+myxka8lm4MI8wG8YgZdzuKL1bryoKT1cGN92D6Rjeb4s3RSzZY7MjILHj1cgeU=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: d270bcd3df6a2cd27c2792fa9a0b45ef_a300c255718911f1b2f55254006c9bbf
    ReservedCode2: XK8DIeYl/N7PqsvvzhX+3ZGbn+ZeDUtpOfoopBfGxMJh56U3VGoL0mJE4w9yVndp1WLCnS7WHwK4+bLqK/jnC+P44JJ71Fu9Iy5rNRA7Ax8zofKWZMPLUYCsC0D9+myxka8lm4MI8wG8YgZdzuKL1bryoKT1cGN92D6Rjeb4s3RSzZY7MjILHj1cgeU=
---

# PageMind — Chrome Web Store Listing

## 商店标题
**PageMind — 一键提取网页正文，保存为 Markdown**

## 简短描述（132 字符以内）
一键将任意网页转为干净 Markdown。本地存储、离线可用、无需注册。支持正文识别、元数据提取、全文搜索。

## 详细描述

PageMind 是一款极简的网页内容采集工具，帮助你在浏览网页时一键提取正文内容并保存为 Markdown 格式。

### 核心功能

- **一键提取**：点击扩展图标，自动识别网页正文（基于 defuddle 引擎），清除广告、导航、侧边栏等干扰元素
- **Markdown 输出**：提取结果自动生成结构化 Markdown，支持 frontmatter 元数据（标题、作者、来源、发布时间）
- **本地存储**：所有文章保存在浏览器 IndexedDB 中，完全离线可用，无需注册任何账号
- **文章管理**：内置文章库，支持标题/作者/站点名搜索，按时间排序浏览
- **阅读器模式**：内置 Apple 风格排版阅读器，支持代码高亮和沉浸式阅读体验
- **隐私优先**：所有数据保留在本地，不会上传到任何服务器

### 使用方式

1. 打开任意网页，点击工具栏中的 PageMind 图标
2. 扩展自动检测当前页面信息（标题、作者、站点等）
3. 点击「提取正文并保存」，等待正文识别和 Markdown 生成
4. 提取完成后自动保存到本地文章库，可随时阅读、搜索、复制 Markdown

### 适用场景

- 技术文章 / 文档归档
- 论文 / 研究报告采集
- 博客文章离线保存
- 笔记素材收集

### 技术架构

- 基于 WXT 框架开发的 Manifest V3 扩展
- 正文提取引擎：defuddle + Shadow DOM 扁平化
- 前端：Vue 3 + Pinia + UnoCSS
- 存储：IndexedDB (Dexie.js)

### 权限说明

- `activeTab`：读取当前标签页内容以提取正文
- `scripting`：注入内容脚本执行页面解析
- `storage`：保存用户设置偏好
- `sidePanel`：在浏览器侧边栏显示操作面板

## 截图说明

至少需要 3 张截图（建议 1280x800 或 640x400）：

### 截图 1：主页 — 当前页面检测与提取
展示 PageMind 侧边栏的首页视图（Capture View）。包含：
- 当前网页信息卡片（标题、URL、作者、发布时间）
- 「提取正文并保存」主按钮
- 复制 Markdown 和仅预览辅助按钮
- 提取流程三步指示器（网页提取 → Markdown → IndexedDB）

### 截图 2：文章库 — 搜索与浏览
展示文章库视图（Library View）。包含：
- 搜索框（支持标题/作者/站点名搜索）
- 已保存文章列表（含标题、站点名、日期、阅读时间）
- 每篇文章支持点击进入阅读器、删除操作
- 空状态友好提示

### 截图 3：阅读器 — Markdown 渲染与沉浸式阅读
展示阅读器视图（Reader View）。包含：
- Apple 风格排版（San Francisco 字体、舒适间距）
- Markdown 渲染结果（标题层级、代码块、链接等）
- 文章元数据展示（来源、作者、发布时间）
- 文章间前后导航

### 截图 4（可选）：设置面板
展示设置视图（Settings View）。包含：
- 四个设置项开关：自动保存、Toast 提示、Frontmatter 元数据、高级排版
- 恢复默认按钮
- 本地优先架构说明

## 分类
生产力工具 (Productivity)

## 语言
中文（简体）

## 开发者
PageMind Team
*（内容由AI生成，仅供参考）*
