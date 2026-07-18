# Pi 使用教程

适用于 Pi v0.80.10。本文记录日常使用、会话回退、配置、快捷键、资源加载和 RTK 集成。

## 1. 启动与基本界面

启动交互模式：

```bash
pi
```

继续最近一次会话：

```bash
pi -c
# 或
pi --continue
```

浏览并选择历史会话：

```bash
pi -r
# 或
pi --resume
```

启动时常见提示：

```text
escape interrupt · ctrl+c/ctrl+d clear/exit · / commands · ! bash · ctrl+o more
```

含义：

- `Esc`：中断模型生成或工具执行。
- `Esc` 两次：打开会话树，相当于 `/tree`。
- `Ctrl+C`：清空输入框；连续按两次通常退出 Pi。
- `Ctrl+D`：输入框为空时退出。
- `Ctrl+O`：折叠或展开工具输出和启动信息。
- 输入 `/`：打开命令补全。
- 输入 `!command`：执行命令，并把输出发送给模型。
- 输入 `!!command`：执行命令，但不把输出发送给模型。

## 2. 会话与回到历史节点

### 2.1 `/tree`：回到当前会话的历史节点

在 Pi 中输入：

```text
/tree
```

选择一个历史节点并确认后，Pi 会从该节点继续。原来的历史不会被删除，而是保留为同一个 session 文件中的分支。

也可以连续按两次：

```text
Esc
Esc
```

适用场景：

- 撤回刚才错误的方向。
- 回到修改代码之前的讨论节点。
- 从旧方案重新尝试另一种实现。

回到旧节点后，建议明确告诉 Pi：

```text
从这个节点继续，但先只分析，不要修改文件。
```

### 2.2 `/fork`：从历史节点创建新会话

```text
/fork
```

从某条历史用户消息复制出新的 session。旧实现保持不变，新 session 可以独立实验。

推荐在以下情况下使用：

- 想保留当前结果，同时尝试另一套实现。
- 想比较两个设计方案。
- 不希望实验性修改影响当前主线。

### 2.3 `/clone`：复制当前分支

```text
/clone
```

将当前活跃分支复制为新的 session，适合在当前完整上下文上开展另一项工作。

### 2.4 `/resume`：恢复其他历史会话

```text
/resume
```

打开历史 session 选择器。

查看当前会话信息：

```text
/session
```

它会显示 session 文件、ID、消息数、token、缓存和费用。

从命令行使用指定 session：

```bash
pi --session <session-id>
pi --session <session-file-path>
```

也可以使用部分 session ID：

```bash
pi --session abc123
```

默认 session 目录：

```text
~/.pi/agent/sessions/
```

### 2.5 其他会话命令

```text
/new             新建空会话
/name 任务名称   设置会话名称
/session         查看当前会话信息
/export          导出会话
/import <file>   导入 JSONL 会话
```

建议开始重要任务时先命名：

```text
/name AI 对话上下文重构
```

## 3. 上下文过长与压缩

手动压缩较早的上下文：

```text
/compact
```

带自定义保留要求：

```text
/compact 保留修改过的文件、测试结果、设计结论和未解决问题。
```

Pi 默认会自动压缩较早消息。原始历史仍保存在 JSONL session 文件中，必要时可通过 `/tree` 回看。

推荐不要关闭自动压缩：

```json
{
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  }
}
```

含义：

- `enabled`：是否启用自动压缩。
- `reserveTokens`：为下一次模型回复预留的 token。
- `keepRecentTokens`：保留最近多少 token，不参与摘要。

## 4. 输入、文件和命令

引用项目文件：

```text
@stores/chat.store.ts
```

引用多个文件：

```text
@stores/chat.store.ts @services/prompt/builder.ts
```

然后输入：

```text
分析这两个文件之间的消息构造流程。
```

多行输入：

```text
Shift+Enter
```

外部编辑器：

```text
Ctrl+G
```

命令输入：

```text
!git status
```

`!` 的输出会进入当前对话上下文。只想在终端执行而不发送给模型时使用：

```text
!!git status
```

## 5. 消息队列

模型工作期间可以继续输入消息：

- `Enter`：发送 steering message，在当前工具调用完成后处理。
- `Alt+Enter`：发送 follow-up message，等当前整轮工作完成后处理。
- `Esc`：中断并恢复排队消息。
- `Alt+Up`：把排队消息取回输入框。

推荐配置：

```json
{
  "steeringMode": "one-at-a-time",
  "followUpMode": "one-at-a-time"
}
```

`one-at-a-time` 更容易控制指令顺序。只有经常一次性排队多条互不依赖的消息时，才考虑使用 `all`。

## 6. 常用斜杠命令

```text
/login, /logout   登录或退出 OAuth
/model            切换模型
/scoped-models    管理 Ctrl+P 循环的模型
/settings         打开设置面板
/resume           恢复历史会话
/new              新建会话
/name <name>      命名当前会话
/session          查看会话信息
/tree             查看并跳转历史节点
/trust            信任当前项目
/fork             从历史消息创建新会话
/clone            复制当前分支
/compact          压缩上下文
/copy             复制上一条 assistant 回复
/export           导出会话
/import           导入会话
/reload           重新加载扩展、skill、prompt、主题和上下文文件
/hotkeys          查看全部快捷键
/changelog        查看版本变化
/quit             退出 Pi
```

## 7. `/settings` 和配置文件

`/settings` 是交互式设置面板，负责常用设置。完整设置保存在 JSON 文件中：

```text
全局配置：~/.pi/agent/settings.json
项目配置：当前项目/.pi/settings.json
```

项目配置覆盖全局配置；嵌套对象会合并。

修改配置文件后可以重启 Pi；扩展、skill、快捷键等资源也可以尝试使用：

```text
/reload
```

如果配置文件不存在，可以直接创建。不要覆盖已有文件，先查看：

```bash
cat ~/.pi/agent/settings.json
```

### 7.1 模型与思考

```json
{
  "defaultProvider": "openai",
  "defaultModel": "gpt-5",
  "defaultThinkingLevel": "medium",
  "hideThinkingBlock": false,
  "showCacheMissNotices": false
}
```

思考等级：

```text
off, minimal, low, medium, high, xhigh, max
```

推荐：

- 日常编码：`medium`。
- 简单查询、格式化、查文件：`low`。
- 复杂调试、架构和跨文件推理：`high`。
- `max` 只在确实需要时使用，速度慢且成本高。
- `hideThinkingBlock` 只隐藏界面显示，不会关闭模型思考。

快捷键：

```text
Shift+Tab   循环切换思考等级
Ctrl+T      折叠或展开思考块
Ctrl+L      选择模型
Ctrl+P      切换下一个模型
```

### 7.2 界面显示

```json
{
  "theme": "dark",
  "quietStartup": false,
  "externalEditor": "code --wait",
  "autocompleteMaxVisible": 8,
  "editorPaddingX": 0,
  "outputPad": 1
}
```

推荐保留 `quietStartup: false`，这样可以看到已加载的 AGENTS.md、skill 和 extension。

使用 VS Code 作为外部编辑器时必须使用：

```json
{
  "externalEditor": "code --wait"
}
```

### 7.3 项目信任

```json
{
  "defaultProjectTrust": "ask"
}
```

可选值：

- `ask`：新项目询问，推荐。
- `always`：自动信任项目资源。
- `never`：忽略项目级资源。

Pi extension 具有执行代码的能力，skill 也可能指导模型运行命令，因此不建议全局设置为 `always`。

确认项目可靠后，在 Pi 中执行：

```text
/trust
```

单次信任当前项目：

```bash
pi --approve
```

单次忽略项目资源：

```bash
pi --no-approve
```

### 7.4 分支摘要

```json
{
  "branchSummary": {
    "reserveTokens": 16384,
    "skipPrompt": false
  },
  "doubleEscapeAction": "tree",
  "treeFilterMode": "default"
}
```

推荐保持 `skipPrompt: false`，切换 `/tree` 分支时可以得到必要的分支摘要。

`doubleEscapeAction` 推荐使用 `tree`，这样双击 `Esc` 可以快速打开历史树。

### 7.5 重试

```json
{
  "retry": {
    "enabled": true,
    "maxRetries": 3,
    "baseDelayMs": 2000,
    "provider": {
      "maxRetries": 0,
      "maxRetryDelayMs": 60000
    }
  }
}
```

推荐开启 Pi agent 层重试，但保持 provider 层 `maxRetries: 0`。两层同时重试可能造成长时间等待、重复请求或额外费用。

### 7.6 网络传输

```json
{
  "transport": "auto",
  "httpIdleTimeoutMs": 300000,
  "websocketConnectTimeoutMs": 15000
}
```

推荐 `transport: auto`。只有 provider 明确存在传输问题时，才指定 `sse` 或 `websocket`。

代理示例：

```json
{
  "httpProxy": "http://127.0.0.1:7890"
}
```

不使用代理时不要配置 `httpProxy`。

### 7.7 图片和终端

```json
{
  "terminal": {
    "showImages": true,
    "imageWidthCells": 60,
    "clearOnShrink": false
  },
  "images": {
    "autoResize": true,
    "blockImages": false
  }
}
```

担心误发送敏感截图时，可以设置：

```json
{
  "images": {
    "blockImages": true
  }
}
```

### 7.8 Shell

macOS 默认通常不需要配置 `shellPath`。如果确实需要指定：

```json
{
  "shellPath": "/bin/zsh"
}
```

如果使用 mise 管理 Node，可配置：

```json
{
  "npmCommand": ["mise", "exec", "node@20", "--", "npm"]
}
```

不要为了加载 alias 盲目设置 `shellCommandPrefix`，因为 shell 配置可能包含交互输出或慢命令。

### 7.9 Session 目录

默认目录通常不需要修改。如果需要自定义：

```json
{
  "sessionDir": "~/Documents/pi-sessions"
}
```

session 可能包含源码、路径、模型输出和敏感信息，不要直接提交到 Git 或公开同步。

### 7.10 模型循环

限制 `Ctrl+P` 循环的模型：

```json
{
  "enabledModels": [
    "anthropic/claude-sonnet-*",
    "openai/gpt-5*"
  ]
}
```

模型太多会导致切换困难，也容易误选高成本模型。

### 7.11 遥测和离线模式

关闭安装/更新匿名版本上报：

```json
{
  "enableInstallTelemetry": false
}
```

这不会关闭版本检查。关闭版本检查：

```bash
PI_SKIP_VERSION_CHECK=1 pi
```

关闭所有启动网络操作：

```bash
pi --offline
# 或
PI_OFFLINE=1 pi
```

### 7.12 警告

推荐保留 Anthropic 额外用量警告：

```json
{
  "warnings": {
    "anthropicExtraUsage": true
  }
}
```

## 8. 推荐的全局配置

适合长期代码开发、使用 skill 和 RTK 的配置：

```json
{
  "defaultThinkingLevel": "medium",
  "hideThinkingBlock": false,
  "theme": "dark",
  "quietStartup": false,
  "defaultProjectTrust": "ask",
  "doubleEscapeAction": "tree",
  "treeFilterMode": "default",
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  },
  "branchSummary": {
    "reserveTokens": 16384,
    "skipPrompt": false
  },
  "retry": {
    "enabled": true,
    "maxRetries": 3,
    "baseDelayMs": 2000,
    "provider": {
      "maxRetries": 0,
      "maxRetryDelayMs": 60000
    }
  },
  "steeringMode": "one-at-a-time",
  "followUpMode": "one-at-a-time",
  "transport": "auto",
  "enableSkillCommands": true,
  "enableInstallTelemetry": false,
  "warnings": {
    "anthropicExtraUsage": true
  }
}
```

不需要一次性配置所有字段。最小推荐配置：

```json
{
  "defaultThinkingLevel": "medium",
  "theme": "dark",
  "defaultProjectTrust": "ask",
  "compaction": {
    "enabled": true
  },
  "retry": {
    "enabled": true
  },
  "steeringMode": "one-at-a-time",
  "followUpMode": "one-at-a-time",
  "enableSkillCommands": true
}
```

## 9. 快捷键配置

快捷键文件：

```text
~/.pi/agent/keybindings.json
```

示例：

```json
{
  "tui.input.newLine": ["shift+enter", "ctrl+j"],
  "app.editor.external": ["ctrl+g"],
  "app.session.tree": ["ctrl+alt+t"]
}
```

修改后执行：

```text
/reload
```

常用快捷键：

```text
Esc             中断
Esc Esc         打开 /tree
Ctrl+C          清空输入
Ctrl+D          空输入时退出
Ctrl+G          外部编辑器
Ctrl+O          折叠工具输出
Ctrl+L          选择模型
Ctrl+P          下一个模型
Shift+Tab       切换思考等级
Ctrl+T          折叠思考内容
Ctrl+X          复制上一条回答
Alt+Enter       加入 follow-up 队列
Alt+Up          恢复队列消息
```

## 10. Context 文件、System Prompt 和资源

Pi 启动时会加载：

```text
~/.pi/agent/AGENTS.md       全局规则
父目录中的 AGENTS.md       逐级加载
当前目录的 AGENTS.md       项目规则
```

也会识别 `CLAUDE.md`。

项目系统提示词：

```text
.pi/SYSTEM.md
```

全局系统提示词：

```text
~/.pi/agent/SYSTEM.md
```

追加而不是替换默认提示词：

```text
.pi/APPEND_SYSTEM.md
~/.pi/agent/APPEND_SYSTEM.md
```

临时禁用上下文文件：

```bash
pi --no-context-files
```

资源目录：

```text
~/.pi/agent/extensions/   全局扩展
~/.pi/agent/skills/       全局 skill
~/.pi/agent/prompts/      全局 prompt template
~/.pi/agent/themes/       全局主题
.pi/extensions/           项目扩展
.pi/skills/               项目 skill
.pi/prompts/              项目 prompt template
.pi/themes/               项目主题
```

使用 skill：

```text
/skill:技能名
```

推荐保留：

```json
{
  "enableSkillCommands": true
}
```

## 11. Pi Package 和扩展

查看已安装包：

```bash
pi list
```

安装包：

```bash
pi install npm:@org/package
pi install git:github.com/user/repo
```

项目本地安装：

```bash
pi install -l npm:@org/package
```

更新：

```bash
pi update --all
pi update --extensions
pi update --models
```

卸载：

```bash
pi remove npm:@org/package
```

扩展可以执行任意代码，因此安装第三方包前应检查源码、来源和权限。

## 12. RTK 集成

为 Pi 安装 RTK 扩展：

```bash
rtk init -g --agent pi
```

安装后的扩展通常位于：

```text
~/.pi/agent/extensions/rtk.ts
```

验证扩展：

```bash
pi -e ~/.pi/agent/extensions/rtk.ts --no-session
```

Pi 会在下次启动时自动加载扩展。也可以在当前会话执行：

```text
/reload
```

注意：

```bash
rtk init -g
```

没有指定 agent 时，RTK 默认会进入 Claude 初始化流程，并提示修改：

```text
~/.claude/settings.json
```

这不代表 Pi 安装失败，也不需要为了 Pi 修改 Claude 配置。只使用 Pi 时使用：

```bash
rtk init -g --agent pi
```

如果看到：

```text
No hook installed
```

表示全局 hook 尚未安装。可以执行：

```bash
rtk init -g --agent pi
```

然后重启 Pi 并验证扩展加载情况。

## 13. 常用 CLI 参数

```bash
pi -c                         继续最近会话
pi -r                         选择历史会话
pi --no-session                不保存会话
pi --name "任务名"             启动时命名
pi --session <id>              使用指定会话
pi --fork <id>                 从指定会话创建分支
pi --provider openai           指定 provider
pi --model gpt-5               指定模型
pi --thinking high             指定思考等级
pi --tools read,grep,find,ls   只允许只读工具
pi --no-tools                  禁用工具
pi --approve                   单次信任项目资源
pi --no-approve                单次忽略项目资源
pi --offline                   关闭启动网络操作
pi -p "问题"                   非交互打印模式
```

只读审查示例：

```bash
pi --tools read,grep,find,ls -p "Review this repository for bugs"
```

从管道读取内容：

```bash
cat README.md | pi -p "总结这份文档"
```

引用文件启动：

```bash
pi @src/app.ts "检查这个文件的错误"
```

## 14. 推荐工作流

```text
1. 启动 Pi
2. 用 /name 给任务命名
3. 先让 Pi 阅读相关文件并分析，不要立即修改
4. 复杂任务使用 /fork 尝试不同方案
5. 改错时用 /tree 回到修改前节点
6. 修改后运行项目测试和类型检查
7. 用 /session 查看会话信息
8. 任务过长时使用 /compact
9. 完成后保留 session，便于后续 /resume
```

典型开发请求：

```text
先阅读相关文件，说明当前实现、调用链和最小修改方案。暂时不要改代码。
```

确认方案后：

```text
按刚才方案做最小修改，并补充一个能验证核心逻辑的测试。完成后运行测试和类型检查。
```

## 15. 安全和隐私注意事项

- 不要把 API key 写进 `settings.json`、`AGENTS.md` 或项目代码。
- 第三方 extension、skill 和 package 可能拥有完整系统访问能力，安装前检查源码。
- session 文件可能包含源码、路径、提示词和模型输出，不要公开上传。
- `!command` 的输出会进入模型上下文，执行包含密钥或隐私数据的命令前确认输出内容。
- 不确定项目是否可信时保持 `defaultProjectTrust: "ask"`。
- 需要隐私或断网运行时使用 `pi --offline`。
