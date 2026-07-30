信息够。综合推荐:

## pi 常用推荐

### 1. 上下文文件 (必用)
放项目约定、命令、偏好:
- `~/.pi/agent/AGENTS.md` — 全局指令
- 项目根 `AGENTS.md` 或 `CLAUDE.md` — 项目约定

### 2. 会话管理
```bash
pi -c              # 续上次会话
pi -r              # 浏览选会话
pi --name "任务名"  # 命名会话
```
- `/tree` 跳历史节点继续
- `/fork` 从旧消息分叉
- `/compact` 手动压缩上下文

### 3. 编辑器快捷键 (高频)
| 功能 | 键 |
|---|---|
| 多行输入 | `shift+enter` |
| 外部编辑器 | `ctrl+g` (建议配VS Code: `"externalEditor":"code --wait"`) |
| 复制回复 | `ctrl+x` |
| 粘贴图片 | `ctrl+v` (Win用`alt+v`) |
| 文件引用 | 输 `@` 模糊搜文件 |
| 跑shell | `!command` (输出送模型), `!!command` (不送) |

### 4. 模型循环 (Ctrl+P)
`settings.json`:
```json
{ "enabledModels": ["claude-*", "gpt-4o", "gemini-2*"] }
```
Ctrl+P快速切换。

### 5. Skills (按需能力)
- 仓库: [Anthropic Skills](https://github.com/anthropics/skills), [Pi Skills](https://github.com/badlogic/pi-skills)
- 混用Claude Code技能:
```json
{ "skills": ["~/.claude/skills", "~/.codex/skills"] }
```
- 自定义: `~/.pi/agent/skills/my-skill/SKILL.md`

### 6. 推荐settings.json
```json
{
  "theme": "dark",
  "externalEditor": "code --wait",
  "defaultThinkingLevel": "medium",
  "compaction": { "enabled": true, "keepRecentTokens": 20000 },
  "retry": { "enabled": true, "maxRetries": 3 },
  "enabledModels": ["claude-*", "gpt-4o"]
}
```

### 7. Windows特有
- `Alt+Enter`默认全屏,改键见 terminal-setup.md
- 代理: `"httpProxy": "http://127.0.0.1:7890"`

### 8. 实用命令
- `/settings` — 交互配thinking/theme
- `/model` — 切模型
- `/export file.html` — 导出会话
- `/share` — 传GitHub gist
- `/reload` — 改配置后热重载

### 9. 离线/跳更新检查
```bash
PI_SKIP_VERSION_CHECK=1 pi   # 跳版本检查
pi --offline                 # 全离线启动
```

最实用:**AGENTS.md写好约定 + Ctrl+P切模型 + ctrl+g外编 + `/compact`省token**。

---

核心在usage.md消息队列+中断。综合答:

## 撤回/中断/改消息操作

### 场景一:消息已排队但模型还在工作
模型跑着,你又按了回车排队 → 想撤回改:

| 操作 | 键 |
|---|---|
| 取消队列全部消息,恢复到编辑器 | **Escape** |
| 取回最后一条排队消息到编辑器 | **Alt+Up** |

→ 用Escape或Alt+Up拿回改完再发。

### 场景二:中断正在跑的模型
模型生成中或报错,要停:

- **Escape** — 中断/中止(abort)。已发送的**无法撤回**(已计费),但停止后续生成。

`doubleEscapeAction`可配双击Escape行为(`tree`/`fork`/`none`):
```json
{ "doubleEscapeAction": "tree" }
```

### 场景三:回到之前某步重做
消息已发完、模型已响应,想从中间某点改:

- `/tree` — 跳到会话任意节点,从那里继续(旧分支保留,可被总结)
- `/fork` — 从某条旧消息分叉出新会话(原会话不动)
- `/clone` — 复制当前分支成新会话

### 关键区分
- **排队中未送**:Escape可拿回改 ✅
- **已送达模型**:无法撤回,只能Escape中断止损 ⚠️(已计费/已执行工具调用)

### 模型报错时
- 自动重试(默认3次,指数退避)。settings可调:
```json
{ "retry": { "enabled": true, "maxRetries": 3, "baseDelayMs": 2000 } }
```
- 重试用尽失败 → 回到编辑器,消息已保留,直接改后重发即可。

### 实操建议
1. 发快了 → 立刻**Escape** → 多数情况能拦下排队消息
2. 模型跑飞了 → **Escape**中断,`/tree`回到出错前节点重来
3. 想保留实验 → `/fork`而非原地改

---

| 项 | 值 | 含义 |
|---|---|---|
| `baseDelayMs` | 1000 | agent退避基数 1s/2s/4s/8s/16s... |
| `provider.maxRetries` | 5 | SDK层重试,单次等≤10s |
| `maxRetryDelayMs` | 10000 | 服务器要求等待上限**10秒** |
| `maxRetries` (agent) | 8 | provider耗尽后agent再试8次 |
| `timeoutMs` | 600000 | 单请求超时10分钟 |


总重试 ≈ provider 5次×(≤10s) + agent 8次(指数到上限) ≈ 几十秒内密集重试。

`/reload` 或 重启pi生效。

若想更短(纯10秒内):把`maxRetries`降到`3`、`baseDelayMs`降到`500`。
