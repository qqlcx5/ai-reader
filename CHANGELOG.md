# Changelog

## 0.2.0

### 剪藏
- **PDF / arXiv 剪藏**：面板内 fetch + pdf.js 提取全文（按坐标重排段落、去页码）；arXiv 链接优先抓官方 HTML 版，无 HTML 回退 PDF
- **YouTube 字幕剪藏**：内容脚本提取字幕轨（优先中文），生成带时间戳的 Markdown，无字幕回退普通抓取
- **右键菜单**：「剪藏此页面到 AuraMind」/「保存选中文字到 AuraMind」（选区直接存为引用式快速笔记）
- **键盘快捷键**：`Alt+Shift+C` 抓取当前页、`Alt+Shift+R` 打开复习
- **AI 自动打标签**（可选）：抓取入库后自动生成 3-5 个主题标签
- **音频转写**：本地音频文件（≤25MB）经 Whisper 兼容端点转写入库；RSS 播客条目（`<enclosure>`）一键转写

### 复习（新子系统）
- **SM-2 间隔重复**：AI 从高亮生成**问答卡**或**挖空卡**，四档评分 + 键盘打分（空格/1234）
- **连续打卡 streak**、累计复习数、近 14 天热力图
- **到期角标**：浏览器图标显示待复习数（99+ 封顶）
- **每日新卡上限**（0=不限）、**闪卡挂起/恢复**、**闪卡编辑**
- **每日重温**：确定性挑选 30 天前的旧剪藏
- **Anki 导出**：TSV 文件或 **AnkiConnect 直推**（自动建牌组、重复跳过）
- **闪卡云同步**：并入 WebDAV/S3 数据集，按 updatedAt 三方合并

### 阅读 & 组织
- **[[双向链接]]** 与**知识图谱**（力导向布局，灰圈为未创建文档）
- **相关文档推荐**：字符二元组相似度（中英文通吃）
- **AI 对照翻译**：段落级对齐、分批翻译、代码块不译、缺段回退，译文缓存随同步走
- **TTS 听文档**：Web Speech API，长文分块，中文优先音色
- **阅读器目录 TOC**：≥4 标题时浮动目录按钮，点击平滑定位
- **阅读时长**：记忆库卡片显示「约 N 分钟」
- **命令面板**：`Ctrl/⌘+K` 全局搜文档 + 跳视图；`?` 快捷键速查表

### 获取
- **Newsletter 收件箱**：自托管 Cloudflare Email Worker（`doc/newsletter-worker/` 一键部署）+ 扩展定期拉取
- OPML 导入导出（已有，本轮确认）

### 导出 & 备份
- Obsidian 兼容 Markdown ZIP：YAML frontmatter + `==高亮==` 小节；支持全库 / 多选 / **合集**导出
- **高亮导出**：单篇高亮一键导出 Markdown
- 全库 JSON 备份/恢复补齐 flashcards（旧备份兼容）

### 平台
- **Firefox 构建**（`pnpm build:firefox`，MV2 + sidebar_action，编程式开侧栏有回退）；后台 RSS 刷新双引擎可用（Firefox 在持久后台页内直接解析，Chromium 走 offscreen）
- **实验性暗色模式**（亮/暗/跟随系统，全局 CSS 翻转，程序化验收通过）

### 内部
- 测试从 530 → 613+，全绿；lucide mock 改为 `importOriginal` 透传
- UnoCSS 误扫 `[mm:ss]` 字面量导致构建失败的修复
- 捕获管线统一 `captureTab` 分流（web/pdf/arxiv/youtube）

## 0.1.0

初始版本：剪藏、AI 对话、高亮、RSS、WebDAV/S3 同步、本地优先。
