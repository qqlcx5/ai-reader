# 处理层：多模型配置管理 (Model Management)

## 目标
统一采用 OpenAI 兼容格式（`/v1/chat/completions`），通过自定义 Base URL 接入不同供应商，支持多模型配置、启用/禁用、测试连接、系统提示词。

## 最小可执行任务

### 1. 模型配置数据层
- [ ] 定义 `ModelProviderConfig` 接口（参考 `types.ts` 的 `Provider` 和 `ModelConfig` 结构）
  - `id`, `name`, `provider: 'openai-compatible'`
  - `enabled`, `apiKey`, `baseUrl`, `model`
  - `systemPrompt?`, `createdAt`, `updatedAt`
- [ ] 创建 `models` 表（参考 `storage-utils.ts` 的 `generalSettings.models` 数组存储模式）
- [ ] 实现 `modelRepository.ts`（CRUD + 查询启用列表，参考 `storage-utils.ts` 的设置读写模式）

### 2. Options 页面：模型配置 UI
- [ ] 创建 `entrypoints/options/ModelSettings.vue`（参考 `settings.html` 和 `managers/general-settings.ts` 的设置页面结构）
- [ ] 模型列表展示（名称、Base URL、模型 ID、启用状态，参考 `storage-utils.ts` 的 `models` 数组）
- [ ] 添加模型表单（名称、Base URL、API Key、模型 ID，参考 `types.ts` 的 `Provider` 接口）
- [ ] 编辑模型（回填表单，参考 `import-export.ts` 的数据回填逻辑）
- [ ] 删除模型（确认弹窗，参考 `modal-utils.ts`）
- [ ] 启用/禁用开关（`enabled` 字段，参考 `generalSettings` 的配置模式）
- [ ] 设置默认模型（单选，参考 `interpreterModel` 的存储方式）

### 3. API Key 安全存储
- [ ] 实现 `shared/crypto/secret-store.ts`（参考 `storage-utils.ts` 的 `browser.storage.local` 存储模式）
- [ ] ✅ **使用 `chrome.storage.local` 存储 API Key**（参考 `storage-utils.ts` 的 `setLocalStorage` / `getLocalStorage`，比 IndexedDB 更适合存小密钥）
  - ⚠️ 不要在 `chrome.storage.sync` 中存储（避免跨设备同步泄露）
  - 可选：使用 `crypto.subtle` 进行简单加密（额外保护层）
- [ ] 界面输入框类型为 `password`，支持显示/隐藏切换（参考 `settings.html` 的表单样式）

### 4. 测试连接（Ping）
- [ ] 实现 `openai-compat.adapter.ts` 的 `ping()` 方法（参考 `interpreter.ts` 的 `sendToLLM` 函数）
- [ ] 发送最小请求（如 `max_tokens: 1` 的 chat completion，参考 `interpreter.ts` 的请求体构造）
- [ ] ✅ **使用 AbortController 设置超时控制**（30s，参考 `interpreter.ts` 的错误处理）：
  ```ts
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 30000);
  ```
- [ ] 处理成功/失败/超时（30s）状态（参考 `interpreter.ts` 的错误处理）
- [ ] UI 展示连接状态指示灯（绿/红/黄，参考 `settings.html` 的样式系统）

### 5. 系统提示词配置
- [ ] 创建 `entrypoints/options/PromptSettings.vue`（参考 `settings.html` 和 `managers/interpreter-settings.ts`）
- [ ] 全局默认系统提示词编辑（textarea，参考 `defaultPromptContext` 的存储方式）
- [ ] 支持按模型单独配置系统提示词（覆盖全局，参考 `models` 数组中的模型配置）
- [ ] 提示词模板变量（如 `{{date}}`、`{{url}}`，参考 `shared.ts` 的变量构建系统）

### 6. 模型选择器组件
- [ ] 创建共享组件 `ModelSelector.vue`
- [ ] 下拉列表展示所有启用模型
- [ ] 显示模型名称 + 提供商简称
- [ ] 支持在 Chat 界面快速切换模型

---

## 验收标准
- [ ] 可配置 ≥3 个不同供应商模型（DeepSeek / 通义 / OpenRouter，参考 `interpreter.ts` 的多 provider 支持）
- [ ] API Key 不以明文暴露在 UI（参考 `interpreter.ts` 的 `apiKey` 使用方式）
- [ ] Ping 测试 3 秒内返回结果（参考 `interpreter.ts` 的请求超时处理）
- [ ] 禁用模型不出现在 Chat 模型选择器中（参考 `generalSettings.models` 的过滤逻辑）
- [ ] 系统提示词修改后即时生效（新对话，参考 `storage-utils.ts` 的实时存储更新）

## 依赖模块
- `db/dexie.ts`（settings 表，参考 `storage-utils.ts` 的存储模式）
- `core/models/openai-compat.adapter.ts`（Ping 实现，参考 `interpreter.ts`）
- `entrypoints/options/`（配置页面，参考 `settings.html` 和 `managers/`）

## 参考资料
- [chrome-extensions] skill - API 调用模式
- `obsidian-clipper/interpreter.ts` - 多 provider 实现
- `obsidian-clipper/managers/interpreter-settings.ts` - 设置页结构
