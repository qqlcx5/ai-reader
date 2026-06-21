# Provider 配置指南

AI Reader 支持多种 LLM Provider，你可以在设置页的 **Provider** 选项卡中管理配置。

## 通用步骤

1. 点击扩展工具栏图标 → **设置**。
2. 进入 **Provider** 选项卡。
3. 点击 **新增 Provider**。
4. 选择类型，填写 API Key 和模型名。
5. 点击保存。

> ⚠️ **安全警告**：API Key 以明文存储在本地浏览器存储中。任何有权访问你设备本地存储的程序都可以读取这些密钥。不要在公司或公共设备上配置个人 API Key。
> 
> 如果担心泄露风险，建议：
> - 使用额度有限的 API Key
> - 定期轮换密钥
> - 使用代理/中转服务隐藏真实密钥

## Provider 类型

### OpenAI

| 字段 | 说明 |
|------|------|
| 类型 | `openai` |
| 默认地址 | `https://api.openai.com/v1` |
| API Key | [获取地址](https://platform.openai.com/api-keys) |
| 推荐模型 | `gpt-4o`、`gpt-4o-mini`、`gpt-4-turbo` |

**自定义地址**：如果你使用 OpenAI 兼容的 API 中转服务，在「Base URL」中填入中转地址。

### Anthropic Claude

| 字段 | 说明 |
|------|------|
| 类型 | `anthropic` |
| 默认地址 | `https://api.anthropic.com/v1` |
| API Key | [获取地址](https://console.anthropic.com/settings/keys) |
| 推荐模型 | `claude-sonnet-4-20250514`、`claude-haiku-3-5-20241022` |

**注意**：Anthropic API Key 以 `sk-ant-` 开头。

### Google Gemini

| 字段 | 说明 |
|------|------|
| 类型 | `gemini` |
| 默认地址 | `https://generativelanguage.googleapis.com/v1beta` |
| API Key | [获取地址](https://aistudio.google.com/apikey) |
| 推荐模型 | `gemini-2.0-flash`、`gemini-2.0-flash-lite` |

**注意**：Gemini API 目前是免费使用的（有限额）。无需在 Google Cloud 开通账单即可获取 API Key。

### Custom（自定义）

适用于任何兼容 OpenAI Chat Completions API 格式的服务。

| 字段 | 说明 |
|------|------|
| 类型 | `custom` |
| Base URL | **必填**。API 端点，通常以 `/v1` 结尾 |
| 模型 | **必填**。模型标识符 |
| API Key | **必填**。服务商提供的密钥 |

**常见自定义服务：**

| 服务 | Base URL | 特点 |
|------|----------|------|
| Ollama | `http://localhost:11434/v1` | 本地模型，无需 API Key |
| OpenRouter | `https://openrouter.ai/api/v1` | 聚合多模型 |
| DeepSeek | `https://api.deepseek.com/v1` | 性价比高 |
| Groq | `https://api.groq.com/openai/v1` | 推理速度快 |

**Ollama 注意事项：**

使用 Ollama 时，需要解决跨域问题。启动 Ollama 服务时指定：

```bash
OLLAMA_ORIGINS=chrome-extension://* ollama serve
```

然后在 Custom Provider 中填入：
- Base URL：`http://localhost:11434/v1`
- 模型名：你下载的模型名，如 `llama3.2`
- API Key：任意值（Ollama 不验证）

## 提示词模板

在设置页的 **Prompts** 选项卡中，你可以管理提示词模板。

每个模板包含：
- **名称**：模板标识
- **模式**：`chat` / `roundtable` / `relay`
- **内容**：提示词文本

### 默认模板

系统自带一个「总结」模板，内容为：

```
请总结以下内容，保留核心观点。
```

当你选择一个模板时，它会被填充到输入框中，并自动附加当前页面上下文。

## 多 Provider 选择策略

- 在侧边栏底部勾选你想要使用的 Provider。
- 勾选 2~4 个时，它们会并发生成回复。
- 每个 Provider 的回复独立展示，互不影响。
- 可以随时对单个 Provider 的回复进行重试或追问。
