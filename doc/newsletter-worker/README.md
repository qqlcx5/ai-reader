# AuraMind Newsletter 收件箱 — Cloudflare Worker 部署指南

让 Newsletter 像 RSS 一样自动进入 AuraMind：邮件 → Cloudflare Email Worker → 扩展定期拉取 → 自动入库 + AI 分析。

**前提**：一个托管在 Cloudflare 的域名（免费版即可），用于接收邮件，例如 `news.yourdomain.com`。

## 部署（约 5 分钟）

1. **创建 KV namespace**

   ```bash
   cd doc/newsletter-worker
   npx wrangler kv namespace create MAILS
   ```

   把输出的 `id` 填进 `wrangler.toml` 的 `kv_namespaces`。

2. **设置访问令牌**（扩展端要用同一个值）

   ```bash
   npx wrangler secret put TOKEN
   # 输入一个随机字符串，例如: openssl rand -hex 16
   ```

3. **部署 Worker**

   ```bash
   npx wrangler deploy
   ```

   记下 Worker 地址，例如 `https://auramind-newsletter-inbox.yourname.workers.dev`。

4. **开启 Email Routing**

   - Cloudflare 控制台 → 你的域名 → **Email Routing**
   - 添加路由： Catch-all（或指定地址如 `news@yourdomain.com`）→ 动作选 **Send to Worker** → 选刚部署的 Worker

5. **配置 AuraMind**

   - 打开扩展 → 设置 → **Newsletter 收件箱**
   - API 地址：`https://auramind-newsletter-inbox.yourname.workers.dev/inbox`
   - 访问令牌：第 2 步的 TOKEN
   - 打开开关，点「测试并拉取」

6. **订阅 Newsletter**

   用 `anything@yourdomain.com` 去订阅任何邮件列表。之后每封邮件都会在 RSS 刷新周期内自动进入记忆库，并加入 AI 分析队列。

## 说明

- 邮件在 KV 中保存 30 天自动过期；扩展拉取入库后内容就在本地了。
- 单封正文上限 2MB；超大邮件只保留主题。
- 扩展按 `contentHash` 去重，重复拉取不会产生重复文档。
