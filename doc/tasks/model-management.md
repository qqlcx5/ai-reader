# 处理层：多模型配置管理 (Model Management)

## 目标
统一采用 OpenAI 兼容格式（`/v1/chat/completions`），通过自定义 Base URL 接入不同供应商，支持多模型配置、启用/禁用、测试连接、系统提示词。

## 最小可执行任务

### 1. 模型配置数据层
- [ ] 定义 `ModelProviderConfig` 接口（`core/models/model.types.ts`）
  - `id`, `name`, `provider: 'openai-compatible'`
  - `enabled`, `apiKey`, `baseUrl`, `model`
  - `systemPrompt?`, `createdAt`, `updatedAt`
- [ ] 创建 `models` 表（Dexie `settings` 表内存储或独立表）
- [ ] 实现 `modelRepository.ts`（CRUD + 查询启用列表）

### 2. Options 页面：模型配置 UI
- [ ] 创建 `entrypoints/options/ModelSettings.vue`
- [ ] 模型列表展示（名称、Base URL、模型 ID、启用状态）
- [ ] 添加模型表单（名称、Base URL、API Key、模型 ID）
- [ ] 编辑模型（回填表单）
- [ ] 删除模型（确认弹窗）
- [ ] 启用/禁用开关（`enabled` 字段）
- [ ] 设置默认模型（单选）

### 3. API Key 安全存储
- [ ] 实现 `shared/crypto/secret-store.ts`
- [ ] 使用 `chrome.storage.local` 加密存储 API Key（可选：简单 obfuscation 或 Web Crypto API）
- [ ] 界面输入框类型为 `password`，支持显示/隐藏切换

### 4. 测试连接（Ping）
- [ ] 实现 `openai-compat.adapter.ts` 的 `ping()` 方法
- [ ] 发送最小请求（如 `max_tokens: 1` 的 chat completion）
- [ ] 处理成功/失败/超时（30s）状态
- [ ] UI 展示连接状态指示灯（绿/红/黄）

### 5. 系统提示词配置
- [ ] 创建 `entrypoints/options/PromptSettings.vue`
- [ ] 全局默认系统提示词编辑（textarea）
- [ ] 支持按模型单独配置系统提示词（覆盖全局）
- [ ] 提示词模板变量（如 `{{date}}`、`{{url}}`）

### 6. 模型选择器组件
- [ ] 创建共享组件 `ModelSelector.vue`
- [ ] 下拉列表展示所有启用模型
- [ ] 显示模型名称 + 提供商简称
- [ ] 支持在 Chat 界面快速切换模型

---

## 验收标准
- [ ] 可配置 ≥3 个不同供应商模型（DeepSeek / 通义 / OpenRouter）
- [ ] API Key 不以明文存储在 IndexedDB
- [ ] Ping 测试 3 秒内返回结果
- [ ] 禁用模型不出现在 Chat 模型选择器中
- [ ] 系统提示词修改后即时生效（新对话）

## 依赖模块
- `db/dexie.ts`（settings 表）
- `core/models/openai-compat.adapter.ts`（Ping 实现）
- `entrypoints/options/`（配置页面）
