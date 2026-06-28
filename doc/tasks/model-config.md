# 模型配置 (model-config)

- [x] 模型池 UI — 模型列表卡片：`src/components/settings/ModelPool.vue` + `ModelCard.vue`，每张卡片展示 name / provider / modelId / baseUrl（截断）/ 启用状态 Switch / 默认标识 Badge / 测试状态指示灯（untested/testing/success/failed）+ 编辑/删除按钮
- [x] 添加模型弹窗：`src/components/settings/ModelEditorDialog.vue`，表单字段：name (text) / provider (select: openai-compatible / anthropic / ollama) / modelId (text) / baseUrl (text, 仅 openai-compatible 和 ollama 显示) / apiKey (password) / contextWindow (number, 默认 1050000) / temperature (slider 0-2, 默认 0.9) / systemPrompt (textarea) / enabled (switch, 默认 true) / isDefault (switch, 默认 false)
- [x] 添加模型校验：name 非空；provider 必选；modelId 非空；baseUrl 若填写需合法 URL（允许 localhost）；temperature 范围 0-2；contextWindow > 0；若 isDefault 为 true 则其他模型取消默认；若是第一个模型自动设为默认
- [x] 编辑模型弹窗：复用 ModelEditorDialog，打开时预填当前模型所有字段数据，保存时更新 `updatedAt`
- [x] 删除模型：点击删除按钮 → `ConfirmDialog` 二次确认，若删除的是默认模型则提示"请先设置其他模型为默认"，删除后更新 `modelStore.models`
- [x] 启用/禁用模型 Switch：ModelCard 上 Switch 切换调用 `modelStore.toggleEnabled(id)`，若禁用的是默认模型则弹窗提示选择新默认模型
- [x] 默认模型设置：`modelStore.setDefault(id)` 先将所有模型 `isDefault = false`，再将目标 `isDefault = true`，写入 IndexedDB
- [x] 每模型 systemPrompt：ModelEditorDialog 中 textarea 字段，保存到 `ModelConfig.systemPrompt`；优先级 > 全局 `globalSystemPrompt`
- [x] 全局 systemPrompt：SettingsView 中独立 textarea，保存到 `AppSettings.globalSystemPrompt`；仅当模型 systemPrompt 为空时兜底
- [x] 模型测试连接 — OpenAI Compatible：POST `{baseUrl}/chat/completions`，body 含 `model: modelId` + 一条短消息，读取响应 status 和 latency
- [x] 模型测试连接 — Anthropic：POST `{baseUrl}/v1/messages`，Headers 含 `x-api-key`，body 含 `model: modelId` + 短消息
- [x] 模型测试连接 — Ollama：GET `{baseUrl}/api/tags` 检查服务可达；或 POST `{baseUrl}/api/chat` 发送短消息
- [x] 测试结果展示：success → 绿色指示灯 + latency 显示；failed → 红色指示灯 + error message；更新 `ModelConfig.lastTestStatus / lastTestLatency / lastTestError`
