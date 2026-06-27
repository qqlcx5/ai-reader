# 数据层 (data-layer)

- [ ] Dexie 表定义：`src/db/schema.ts`，v1 stores 声明 `documents: 'id, url, canonicalUrl, title, siteName, capturedAt, updatedAt, lastOpenedAt, contentHash'` / `conversations: 'id, documentId, createdAt, updatedAt'` / `models: 'id, provider, modelId, enabled, isDefault, updatedAt, lastUsedAt'` / `settings: 'id, updatedAt'`
- [ ] DocumentRepository：`src/db/repositories/document.ts`，实现 `create(doc: DocumentEntity)` / `findById(id)` / `findByUrl(url)` / `findAll(options: { orderBy?, limit? })` / `update(id, partial)` / `delete(id)` / `count()`
- [ ] ConversationRepository：`src/db/repositories/conversation.ts`，实现 `create(conv)` / `findById(id)` / `findByDocumentId(documentId)` / `update(id, partial)` / `delete(id)` / `count()`
- [ ] ModelRepository：`src/db/repositories/model.ts`，实现 `create(model)` / `findAll()` / `findEnabled()` / `findDefault()` / `findById(id)` / `update(id, partial)` / `delete(id)` / `setDefault(id)` / `count()`
- [ ] SettingsRepository：`src/db/repositories/settings.ts`，单例模式，`get(): AppSettings` 从 id='app-settings' 读取，`save(partial)` upsert；若不存在则自动创建默认值（PRD 第 4.7.2 / 4.8.2 节默认值）
- [ ] pinia-plugin-persistedstate 配置：在 `src/stores/` 下各 store 中配置 `persist`，仅 `app.store.ts` / `workspace.store.ts` 的 UI 状态持久化到 localStorage，业务数据走 IndexedDB
- [ ] document.store.ts：state 含 `currentDocument: DocumentEntity | null` / `isLoading` / `extractionStatus`；actions 含 `extractCurrentPage()`（发消息给 content script → 写入 IndexedDB → 更新 state）、`loadDocument(id)`、`saveDocument(doc)`、`deleteDocument(id)`
- [ ] chat.store.ts：state 含 `currentConversation` / `inputText` / `isStreaming`；actions 含 `sendMessage()`（校验 → PromptBuilder → Provider.streamChat → 保存）、`stopGeneration()`（AbortController.abort）、`regenerate()`（覆盖最后 assistant message 重新流式）
- [ ] model.store.ts：state 含 `models: ModelConfig[]` / `currentModelId`；getters 含 `currentModel` / `enabledModels`；actions 含 `fetchModels()` / `addModel()` / `updateModel()` / `deleteModel()` / `toggleEnabled()` / `setDefault()` / `testConnection()`
- [ ] settings.store.ts：state 含 `globalSystemPrompt` / `context: ContextSettings` / `capture: CaptureSettings`；init 时从 `SettingsRepository.get()` 加载；actions 含 `save()` 写入 IndexedDB
- [ ] app.store.ts：state 含 `currentView` / `activeTab` / `showPageChangeTip` / `toasts: Toast[]`；actions 含 `setView(v)` / `updateActiveTab(tab)` / `dismissPageChangeTip()` / `showToast()` / `dismissToast()`
- [ ] workspace.store.ts：state 含 `workspaceTab: 'chat' | 'context'` / `contextTab: 'markdown' | 'raw' | 'meta'` / `documentSource: 'current-page' | 'library'` / `extractionStatus: ExtractionStatus`
