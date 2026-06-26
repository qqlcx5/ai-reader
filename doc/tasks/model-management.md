# 处理层：多模型配置管理 (P0)

> **模块名称**: model-management  
> **优先级**: P0（AI 消化功能前置依赖）  
> **依赖关系**: 依赖 foundation.md（chrome.storage 加密存储）  
> **目标**: 实现 LLM 模型配置的数据层与 UI 层，支持 OpenAI 兼容格式的多模型管理和 API Key AES-GCM 本地加密

---

## 子任务

### 模型配置数据层
- [ ] 创建 `shared/domain/model.ts`：定义 `ModelProvider`、`ModelConfig` 接口
- [ ] 定义 OpenAI 兼容格式：`baseUrl` + `apiKey` + `modelName`（对齐 detail.md 简述的 `/v1/chat/completions`）
- [ ] 定义 `ModelProvider` 接口：`id / name / baseUrl / models[] / isEnabled`
- [ ] 实现默认 Provider 配置：DeepSeek / Claude / GPT-4o / Ollama Local
- [ ] 创建 `core/models/provider-registry.ts`：Provider 注册表，支持 CRUD

### API Key 加密存储
- [ ] 创建 `core/crypto/aes-gcm.ts`：AES-GCM 加密/解密工具（对齐 detail.md §4.3）
- [ ] 实现 `encryptApiKey(plaintext: string, key: CryptoKey): Promise<string>`
- [ ] 实现 `decryptApiKey(ciphertext: string, key: CryptoKey): Promise<string>`
- [ ] 实现 `deriveKey(masterPassword?: string): Promise<CryptoKey>` — 使用 PBKDF2 派生
- [ ] 加密后的 API Key 存储到 `chrome.storage.local`（不存 sync，避免云端泄露）
- [ ] 创建 `core/models/api-key-store.ts`：`saveApiKey(providerId, key)` / `getApiKey(providerId)` / `deleteApiKey(providerId)`

### 模型配置 Repository
- [ ] 创建 `db/model-config.repository.ts`：Provider 配置的持久化
- [ ] 存储位置：`chrome.storage.sync`（不含 API Key，仅配置元数据）
- [ ] 实现 `listProviders(): Promise<ModelProvider[]>`
- [ ] 实现 `saveProvider(provider: ModelProvider): Promise<void>`
- [ ] 实现 `getProvider(id: string): Promise<ModelProvider | undefined>`
- [ ] 实现 `deleteProvider(id: string): Promise<void>`

### Options 页面 UI
- [ ] 创建 `entrypoints/options/index.html` + `main.ts`（WXT options entry）
- [ ] 创建 `views/OptionsView.vue`：整体布局
- [ ] 实现 LLM 配置区（对齐 design.html Tab 4 Settings LLM 配置区）：
  - API Endpoint 输入框（Base URL，默认填充 DeepSeek）
  - API Key 输入框（密码类型，带显示/隐藏切换按钮）
  - AES-GCM 加密状态指示
  - 「测试连接」按钮（发送简单请求验证配置）
- [ ] 实现 Provider 选择下拉框：DeepSeek / Claude / GPT-4o / Ollama / 自定义
- [ ] 实现「添加自定义 Provider」：baseUrl + model name 输入

### SettingsView 集成
- [ ] 在 Popup 的 SettingsView 中显示当前模型配置摘要（Provider 名称 + 连接状态）
- [ ] 实现「打开完整设置」按钮 → 跳转到 Options 页面（`chrome.runtime.openOptionsPage()`）
- [ ] 实现连接状态指示：绿色圆点（已配置可用）/ 灰色（未配置）

### 安全措施
- [ ] API Key 输入框使用 `<input type="password">`
- [ ] 内存中 API Key 使用后立即从变量中清除（`key = null`）
- [ ] 禁止 console.log 输出 API Key 相关内容
- [ ] Options 页面关闭时清除未持久化的密钥缓存

---

## 验收标准

- [x] 支持 DeepSeek / Claude / GPT-4o / Ollama 四种 Provider
- [x] API Key 经 AES-GCM 加密后存储到 chrome.storage.local
- [x] API Key 明文不在任何日志或调试输出中泄露
- [x] Options 页面 UI 对齐 design.html LLM 配置区
- [x] 「测试连接」可验证 API 连通性
- [x] SettingsView 中显示当前模型配置状态

## 依赖模块

- `foundation.md` — chrome.storage 封装、类型定义

## 关联文件

- `detail.md` §4.3 AES-GCM 本地加密简述
- `design.html` Tab 4 Settings LLM 配置区
