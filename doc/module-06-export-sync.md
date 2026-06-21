---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: d270bcd3df6a2cd27c2792fa9a0b45ef_02ac33886d8f11f18805525400d9a7a1
    ReservedCode1: eDO29IpG/qlFnrKSxHjffaJ0VF6hHZfPX797mamnXxS8DS5iULld0u057541pJACCJj6RTdLgVRip9zKvurP/0WWmelIsXxLedarXzXujRqhZbUJ5PNZTWK5YhGinhHAxbH7NkuSNQpMnYiu0vgy9++wleSCDUqySxyZ8IIKEYjvaJaPZ5lcMAzyxfI=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: d270bcd3df6a2cd27c2792fa9a0b45ef_02ac33886d8f11f18805525400d9a7a1
    ReservedCode2: eDO29IpG/qlFnrKSxHjffaJ0VF6hHZfPX797mamnXxS8DS5iULld0u057541pJACCJj6RTdLgVRip9zKvurP/0WWmelIsXxLedarXzXujRqhZbUJ5PNZTWK5YhGinhHAxbH7NkuSNQpMnYiu0vgy9++wleSCDUqySxyZ8IIKEYjvaJaPZ5lcMAzyxfI=
---

# 模块 06：跨端输出与灾备同步

> 对应设计文档：design-06-export-sync.md

## 子任务清单

- [ ] 子任务 1：定义 `ExportConfig` / `ExportResult` / `ExportPayload` / `SyncableSettings` 核心数据类型，包含三种保存行为、Obsidian 配置、远程备份、资产备份、同步配置等子结构
- [ ] 子任务 2：实现 `obsidian.ts` Obsidian URI 直写 Adapter：构建 `obsidian://adv-uri?vault=&filepath=&data=` URI；实现 `sanitizeFileName()` 清理非法字符（`/ \ : * ? " < > |`）；URI 超长（>2M）时自动降级为剪贴板 + 粘贴中转方案
- [ ] 子任务 3：实现 `local-file.ts` 本地文件下载 Adapter：调用 `<a download>` 触发浏览器下载，文件名模板 `{{title}}_{{date}}.md` 或 `.html`，支持 Markdown 和 HTML 两种格式
- [ ] 子任务 4：实现 `clipboard.ts` 剪贴板复制 Adapter：`navigator.clipboard.writeText()` 以 Markdown 写入剪贴板，处理 Promise 回退兼容性
- [ ] 子任务 5：实现 Side Panel 消息操作区三个保存按钮 UI：发送到 Obsidian / 下载文件 / 复制到剪贴板；默认行为可在 Options 中配置
- [ ] 子任务 6：实现 `webdav.ts` WebDAV 远程备份：用户配置 URL/用户名/密码（存于 `chrome.storage.local`），`fetch + PUT` 写入 Markdown/HTML，自动按 `YYYY-MM/` 分目录
- [ ] 子任务 7：实现 `s3.ts` S3 远程备份：AWS Signature V4 签名 fetch 直连，最小化依赖仅 `crypto.subtle` + 日期/签名算法
- [ ] 子任务 8：实现 `zip.ts` Zip 打包导出：使用 `jszip` 将多段对话 Markdown + 可选 MHTML 快照打包为 `.zip` 下载
- [ ] 子任务 9：实现 `mhtml.ts` 双轨资产备份：对话创建时后台调用 `chrome.pageCapture.saveAsMHTML()` 静默保存页面离线快照到 M7 IndexedDB；导出时打包为 `.mhtml` 文件
- [ ] 子任务 10：实现 `settings-sync.ts` 浏览器间设置同步：使用 `chrome.storage.sync` + `lz-string` 压缩（`compressToUTF16`），将 Provider 配置/模板/导出配置/用户偏好打包同步；LWW（Last-Write-Wins）策略基于 `lastModified` 时间戳解决冲突
- [ ] 子任务 11：实现 Options 中同步管理 UI：显示本地/云端时间对比，提供「强制推送」「强制拉取」按钮，保留最近 3 份历史快照于本地 IndexedDB
- [ ] 子任务 12：实现导出模板格式化 `format.ts`：Markdown 输出含 YAML Frontmatter（标题/日期/标签/来源 URL）+ Obsidian 扩展语法（Callout/Wiki 链接/Dataview 字段）；HTML 输出使用 markdown-it 渲染 + 嵌入响应式 CSS + 代码高亮
- [ ] 子任务 13：编写 `createObsidianUri()` 输出正确性测试、`sanitizeFileName()` 非法字符过滤测试、`lz-string` 压缩/解压往返一致性测试、LWW 冲突解决测试、WebDAV mock server 集成测试、各 Adapter 错误边界与降级路径回归测试
*（内容由AI生成，仅供参考）*
