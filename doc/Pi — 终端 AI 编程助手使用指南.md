# Pi — 终端 AI 编程助手使用指南

> 官网：[https://pi.dev](https://pi.dev)
> GitHub：[badlogic/pi-mono](https://github.com/badlogic/pi-mono)

---

## 目录

1. [简介](#简介)
2. [安装与认证](#安装与认证)
3. [交互模式](#交互模式)
4. [编辑器功能](#编辑器功能)
5. [常用命令](#常用命令)
6. [快捷键](#快捷键)
7. [消息队列](#消息队列)
8. [会话管理](#会话管理)
9. [分支与压缩](#分支与压缩)
10. [支持的供应商与模型](#支持的供应商与模型)
11. [自定义与扩展](#自定义与扩展)
    - [Prompt 模板](#prompt-模板)
    - [Skills（技能）](#skills技能)
    - [Extensions（扩展）](#extensions扩展)
    - [Themes（主题）](#themes主题)
    - [Pi Packages（包管理）](#pi-packages包管理)
12. [编程式使用](#编程式使用)
13. [CLI 参考](#cli-参考)
14. [设计哲学](#设计哲学)

---

## 简介

**Pi** 是一个极简的终端 AI 编程助手框架（coding harness）。它的核心理念是：**让 pi 适应你的工作流，而不是反过来**。

Pi 默认提供 4 个内建工具供 LLM 使用：

| 工具 | 说明 |
|------|------|
| `read` | 读取文件内容（支持文本和图片） |
| `write` | 写入/创建文件 |
| `edit` | 精确替换文件内容 |
| `bash` | 执行 bash 命令 |

Pi 支持 4 种运行模式：

- **交互模式（Interactive）**：在终端中与 AI 对话
- **打印模式（Print / JSON）**：非交互输出结果
- **RPC 模式**：进程集成
- **SDK 模式**：嵌入到你自己的应用中

---

## 安装与认证

### 安装

```bash
npm install -g @mariozechner/pi-coding-agent
```

### 认证方式

**方式一：API Key（环境变量）**

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pi
```

**方式二：订阅账号（OAuth 登录）**

```bash
pi
/login  # 选择供应商并完成 OAuth 认证
```

支持的订阅服务：Claude Pro/Max、ChatGPT Plus/Pro、GitHub Copilot、Google Gemini CLI、Google Antigravity。

---

## 交互模式

进入 pi 后，界面从上到下依次为：

| 区域 | 说明 |
|------|------|
| **启动头部** | 显示快捷键提示、已加载的 AGENTS.md、模板、技能、扩展 |
| **消息区域** | 用户消息、AI 回复、工具调用结果、通知、错误信息 |
| **编辑器** | 输入区域，边框颜色表示 thinking 级别 |
| **底部状态栏** | 工作目录、会话名称、token 用量、费用、上下文使用率、当前模型 |

---

## 编辑器功能

| 功能 | 操作 |
|------|------|
| 文件引用 | 输入 `@` 模糊搜索项目文件 |
| 路径补全 | 按 `Tab` |
| 多行输入 | `Shift+Enter`（Windows Terminal 上为 `Ctrl+Enter`） |
| 粘贴图片 | `Ctrl+V`（Windows 为 `Alt+V`），或拖拽到终端 |
| 执行命令并发送输出 | `!command`（发送给 LLM），`!!command`（仅执行不发送） |

---

## 常用命令

在编辑器中输入 `/` 触发命令菜单：

| 命令 | 说明 |
|------|------|
| `/login` / `/logout` | OAuth 认证 |
| `/model` | 切换模型 |
| `/scoped-models` | 启用/禁用 Ctrl+P 循环的模型 |
| `/settings` | 设置 thinking 级别、主题、消息传递方式等 |
| `/resume` | 恢复之前的会话 |
| `/new` | 开始新会话 |
| `/name <名称>` | 设置会话显示名称 |
| `/session` | 显示会话信息（路径、token、费用） |
| `/tree` | 浏览会话树，可跳转到任意节点继续 |
| `/fork` | 从当前分支创建新会话 |
| `/compact [提示]` | 手动压缩上下文 |
| `/copy` | 复制最后一条 AI 消息到剪贴板 |
| `/export [文件]` | 导出会话为 HTML |
| `/share` | 上传为私有 GitHub Gist |
| `/reload` | 热重载快捷键、扩展、技能、模板 |
| `/hotkeys` | 显示所有快捷键 |
| `/quit` / `/exit` | 退出 |

---

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+C` | 清空编辑器 |
| `Ctrl+C` × 2 | 退出 pi |
| `Escape` | 取消/中止当前操作 |
| `Escape` × 2 | 打开 `/tree` 会话树 |
| `Ctrl+L` | 打开模型选择器 |
| `Ctrl+P` / `Shift+Ctrl+P` | 正向/反向循环切换模型 |
| `Shift+Tab` | 循环切换 thinking 级别 |
| `Ctrl+O` | 折叠/展开工具输出 |
| `Ctrl+T` | 折叠/展开 thinking 块 |

可通过 `~/.pi/agent/keybindings.json` 自定义。

---

## 消息队列

在 AI 工作时可以提前排队消息：

| 操作 | 说明 |
|------|------|
| `Enter` | 排队一条 **引导消息（steering）**，在当前 AI 回合工具调用完成后送达 |
| `Alt+Enter` | 排队一条 **后续消息（follow-up）**，在 AI 完成所有工作后送达 |
| `Escape` | 中止并恢复排队消息到编辑器 |
| `Alt+Up` | 将排队消息取回编辑器 |

---

## 会话管理

会话以 JSONL 文件存储在 `~/.pi/agent/sessions/`，按工作目录组织。

```bash
pi -c                  # 继续最近的会话
pi -r                  # 浏览并选择历史会话
pi --no-session        # 临时模式（不保存会话）
pi --session <路径>    # 使用特定会话文件
pi --fork <路径>       # Fork 特定会话为新会话
```

---

## 分支与压缩

### 分支（Branching）

- **`/tree`** — 导航会话树，选择任意历史节点并从该处继续，所有历史保存在同一文件中
- **`/fork`** — 从当前分支创建全新会话文件

### 压缩（Compaction）

长时间会话可能耗尽上下文窗口。压缩会总结旧消息，保留近期消息。

- **手动压缩**：`/compact` 或 `/compact <自定义指令>`
- **自动压缩**：默认启用，在上下文溢出或接近上限时自动触发

压缩是有损的，但完整历史保留在 JSONL 文件中，可通过 `/tree` 回溯。

---

## 支持的供应商与模型

### 订阅方式（OAuth）

| 供应商 | 说明 |
|--------|------|
| Anthropic Claude Pro/Max | Claude 系列 |
| OpenAI ChatGPT Plus/Pro (Codex) | GPT 系列 |
| GitHub Copilot | 需在 VS Code 中启用对应模型 |
| Google Gemini CLI | Cloud Code Assist |
| Google Antigravity | 沙盒环境，包含 Gemini 3、Claude、GPT-OSS |

### API Key 方式

| 供应商 | 环境变量 |
|--------|----------|
| Anthropic | `ANTHROPIC_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` |
| Google Gemini | `GEMINI_API_KEY` |
| Mistral | `MISTRAL_API_KEY` |
| Groq | `GROQ_API_KEY` |
| Cerebras | `CEREBRAS_API_KEY` |
| xAI | `XAI_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Vercel AI Gateway | `AI_GATEWAY_API_KEY` |
| Hugging Face | `HF_TOKEN` |
| Kimi For Coding | `KIMI_API_KEY` |
| MiniMax | `MINIMAX_API_KEY` |

也可将凭证存储在 `~/.pi/agent/auth.json` 中。

---

## 自定义与扩展

Pi 的设计使得几乎所有功能都可通过以下 4 种机制进行扩展：

### Prompt 模板

可复用的提示词模板，以 Markdown 文件形式存放。输入 `/模板名` 展开使用。

```markdown
<!-- ~/.pi/agent/prompts/review.md -->
Review this code for bugs, security issues, and performance problems.
Focus on: {{focus}}
```

**存放位置**：`~/.pi/agent/prompts/`（全局）或 `.pi/prompts/`（项目级）

### Skills（技能）

遵循 [Agent Skills 标准](https://agentskills.io) 的按需加载能力包。在系统提示中仅包含描述，完整指令在需要时按需加载。

```markdown
<!-- ~/.pi/agent/skills/my-skill/SKILL.md -->
# My Skill
Use this skill when the user asks about X.

## Steps
1. Do this
2. Then that
```

**使用方式**：`/skill:技能名` 或让 AI 自动判断加载。

**存放位置**：
- 全局：`~/.pi/agent/skills/`、`~/.agents/skills/`
- 项目级：`.pi/skills/`、`.agents/skills/`（会向上遍历父目录）

### Extensions（扩展）

TypeScript 模块，是 Pi 最强大的扩展机制。可以：

- 注册 **自定义工具**（替换或增补内建工具）
- 注册 **自定义命令**（如 `/mycommand`）
- 拦截和修改 **事件**（工具调用、会话生命周期等）
- 构建 **自定义 UI**（编辑器、状态栏、对话框等）
- 实现 **权限控制**（危险命令确认、路径保护）
- 实现 **子代理（sub-agents）** 和 **计划模式（plan mode）**
- 自定义 **压缩逻辑**

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerTool({ name: "deploy", ... });
  pi.registerCommand("stats", { ... });
  pi.on("tool_call", async (event, ctx) => { ... });
}
```

**存放位置**：`~/.pi/agent/extensions/`（全局）或 `.pi/extensions/`（项目级）

### Themes（主题）

内建 `dark` 和 `light` 主题。自定义主题文件支持热重载。

**存放位置**：`~/.pi/agent/themes/`（全局）或 `.pi/themes/`（项目级）

### Pi Packages（包管理）

将扩展、技能、模板、主题打包分享：

```bash
# 安装
pi install npm:@foo/pi-tools
pi install git:github.com/user/repo
pi install https://github.com/user/repo

# 管理
pi list                    # 列出已安装包
pi update                  # 更新（跳过固定版本）
pi remove npm:@foo/pi-tools   # 移除
pi config                  # 启用/禁用资源
```

**创建包**：在 `package.json` 中添加 `pi` 字段：

```json
{
  "name": "my-pi-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

> ⚠️ **安全提示**：Pi 包拥有完整的系统访问权限。安装第三方包前请审查源代码。

---

## 编程式使用

### SDK（Node.js）

```typescript
import {
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
} from "@mariozechner/pi-coding-agent";

const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  authStorage: AuthStorage.create(),
  modelRegistry: new ModelRegistry(authStorage),
});

await session.prompt("What files are in the current directory?");
```

### RPC 模式（非 Node.js 集成）

```bash
pi --mode rpc
```

通过 stdin/stdout 使用 LF 分隔的 JSONL 协议通信。

---

## CLI 参考

### 基本用法

```bash
pi [选项] [@文件...] [消息...]
```

### 运行模式

| 标志 | 说明 |
|------|------|
| （默认） | 交互模式 |
| `-p`, `--print` | 打印回复后退出 |
| `--mode json` | 以 JSON 行输出所有事件 |
| `--mode rpc` | RPC 模式 |
| `--export <输入> [输出]` | 导出会话为 HTML |

### 模型选项

| 选项 | 说明 |
|------|------|
| `--provider <名称>` | 指定供应商 |
| `--model <模式>` | 模型 ID（支持 `供应商/模型ID` 和 `模型:thinking级别`） |
| `--api-key <key>` | 覆盖环境变量中的 API key |
| `--thinking <级别>` | `off` / `minimal` / `low` / `medium` / `high` / `xhigh` |
| `--models <模式列表>` | 逗号分隔，用于 Ctrl+P 循环 |
| `--list-models [搜索]` | 列出可用模型 |

### 工具选项

| 选项 | 说明 |
|------|------|
| `--tools <列表>` | 启用特定内建工具（默认：`read,bash,edit,write`） |
| `--no-tools` | 禁用所有内建工具（扩展工具仍可用） |

可用内建工具：`read`、`bash`、`edit`、`write`、`grep`、`find`、`ls`

### 文件参数

用 `@` 前缀传入文件：

```bash
pi @prompt.md "Answer this"
pi -p @screenshot.png "What's in this image?"
pi @code.ts @test.ts "Review these files"
```

### 使用示例

```bash
# 交互模式 + 初始提示
pi "List all .ts files in src/"

# 非交互模式
pi -p "Summarize this codebase"

# 管道输入
cat README.md | pi -p "Summarize this text"

# 使用 OpenAI 模型
pi --model openai/gpt-4o "Help me refactor"

# 指定 thinking 级别
pi --model sonnet:high "Solve this complex problem"

# 只读模式
pi --tools read,grep,find,ls -p "Review the code"
```

### 环境变量

| 变量 | 说明 |
|------|------|
| `PI_CODING_AGENT_DIR` | 覆盖配置目录（默认 `~/.pi/agent`） |
| `PI_SKIP_VERSION_CHECK` | 跳过启动时的版本检查 |
| `PI_CACHE_RETENTION` | 设为 `long` 延长 prompt 缓存（Anthropic: 1h, OpenAI: 24h） |
| `VISUAL` / `EDITOR` | 外部编辑器（Ctrl+G） |

---

## 设计哲学

Pi 追求 **极致的可扩展性**，核心保持精简：

| 理念 | 实现方式 |
|------|----------|
| **无 MCP** | 用 CLI 工具 + README（即 Skills），或用扩展实现 MCP 支持 |
| **无子代理** | 通过 tmux 启动多个 pi 实例，或用扩展实现 |
| **无权限弹窗** | 在容器中运行，或用扩展自定义确认流程 |
| **无计划模式** | 将计划写入文件，或用扩展实现 |
| **无内建 TODO** | 使用 TODO.md 文件，或用扩展实现 |
| **无后台 bash** | 使用 tmux，保持完全可观察性 |

> Pi 不把功能硬编码进去，而是让你用扩展、技能、包来组装你自己的工作流。

---

## 配置文件位置

| 文件 | 作用域 | 路径 |
|------|--------|------|
| 全局设置 | 所有项目 | `~/.pi/agent/settings.json` |
| 项目设置 | 当前项目 | `.pi/settings.json` |
| 系统提示（替换） | 项目/全局 | `.pi/SYSTEM.md` 或 `~/.pi/agent/SYSTEM.md` |
| 系统提示（追加） | 项目/全局 | `APPEND_SYSTEM.md` |
| 上下文文件 | 自动加载 | `AGENTS.md` 或 `CLAUDE.md`（当前目录及父目录） |
| 认证信息 | 全局 | `~/.pi/agent/auth.json` |
| 快捷键 | 全局 | `~/.pi/agent/keybindings.json` |

---

*文档生成日期：2026-03-23*
*基于 pi 官方 README 及文档整理*