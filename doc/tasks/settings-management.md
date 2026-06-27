# 设置管理 (settings-management)

- [ ] ContextSettings 面板：`src/components/settings/ContextSettings.vue`，使用 Slider 设置 `maxContextTokens`（范围 1000-200000，步长 1000），Toggle 控制 `includeMetadataInPrompt` / `includeUrlInPrompt` / `includeTitleInPrompt` / `includeCapturedAtInPrompt` / `includeConversationHistory`，Slider 设置 `maxHistoryMessages`（范围 1-50）
- [ ] CaptureSettings 面板：`src/components/settings/CaptureSettings.vue`，Toggle 控制 `autoExtractOnOpen` / `autoExtractOnTabChange` / `preferCache` / `saveRawHtml` / `compressRawHtml`
- [ ] 全局 systemPrompt textarea：SettingsView 中独立区域，`<textarea>` 绑定 `settingsStore.globalSystemPrompt`，placeholder 提示"留空则不注入 system prompt"
- [ ] 存储统计：`src/components/settings/StorageSettings.vue`，展示文档数量（`DocumentRepository.count()`）、对话数量（`ConversationRepository.count()`）、模型数量（`ModelRepository.count()`）、IndexedDB 估算占用（`navigator.storage.estimate()`）、搜索索引状态（`miniSearch.documentCount`）
- [ ] 导出 JSON：点击"导出 JSON"按钮 → 从 IndexedDB 读取所有 documents / conversations / models / settings → 序列化为 JSON → 触发下载（Blob + `URL.createObjectURL` + `<a>` 点击），文件名 `auramind-backup-{date}.json`；导出前 `ask_user` 提示"导出文件包含 API Key 等敏感数据"
- [ ] 导入 JSON：点击"导入 JSON"按钮 → `<input type="file" accept=".json">` → 解析 JSON 校验结构 → `ask_user` 确认覆盖 → 批量写入 IndexedDB（`db.transaction('rw', ...)` 事务写入）→ `miniSearch.removeAll()` + 逐一 `miniSearch.add()` 重建索引
- [ ] 重建搜索索引：点击"重建索引"按钮 → `miniSearch.removeAll()` → 遍历 `DocumentRepository.findAll()` → 逐一 `miniSearch.add(doc)`，显示进度
- [ ] 清空本地数据：点击"清空本地数据"按钮 → `ConfirmDialog` 二次确认（文案"此操作会删除所有本地文档、对话、模型配置和设置。该操作不可撤销。"）→ `db.delete()` 删除数据库 → `indexedDB.deleteDatabase('AuraMindDB')` → `miniSearch.removeAll()` → 重置所有 Pinia store → 刷新页面
