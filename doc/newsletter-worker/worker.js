/**
 * AuraMind Newsletter Inbox — Cloudflare Email Worker
 *
 * 接收邮件（Cloudflare Email Routing）→ 存入 KV（30 天过期）→
 * 供浏览器扩展轮询拉取。
 *
 * 扩展端协议（与 services/inbox/inbox.ts 对应）：
 *   GET /inbox?cursor=<cursor>
 *     Authorization: Bearer <TOKEN>
 *   → { items: [{ id, from, subject, html, text, receivedAt, url? }], cursor }
 *
 * 环境变量（wrangler secret put TOKEN）：
 *   TOKEN — 扩展端填写的访问令牌
 */

const TTL_SECONDS = 30 * 24 * 3600
const MAX_BODY_BYTES = 2 * 1024 * 1024 // 单封邮件正文上限 2MB

export default {
  async email(message, env, ctx) {
    const id = crypto.randomUUID()
    const from = message.from || ''
    const subject = message.headers.get('subject') || '(无主题)'
    const receivedAt = new Date().toISOString()

    // 邮件正文：优先 HTML，其次纯文本
    let html = ''
    let text = ''
    try {
      const raw = await new Response(message.raw).text()
      if (raw.length <= MAX_BODY_BYTES) {
        if (/<html|<body|<div|<p[\s>]/i.test(raw)) html = raw
        else text = raw
      }
    } catch (e) {
      console.warn('read body failed', e)
    }

    // 正文中第一个 http(s) 链接作为该期网页版地址（可选）
    const urlMatch = /https?:\/\/[^\s<>"']+/i.exec(text || html.replace(/<[^>]+>/g, ' '))
    const url = urlMatch ? urlMatch[0] : undefined

    await env.MAILS.put(id, JSON.stringify({ id, from, subject, html, text, receivedAt, url }), {
      expirationTtl: TTL_SECONDS,
      metadata: { receivedAt }, // KV list 按键序返回，用 metadata 排序兜底
    })
  },

  async fetch(request, env) {
    const url = new URL(request.url)

    // 健康检查
    if (url.pathname === '/health') {
      return Response.json({ ok: true })
    }
    if (url.pathname !== '/inbox') {
      return new Response('Not Found', { status: 404 })
    }

    const auth = request.headers.get('Authorization') || ''
    if (auth !== `Bearer ${env.TOKEN}`) {
      return new Response('Unauthorized', { status: 401 })
    }

    const cursor = url.searchParams.get('cursor')
    const list = await env.MAILS.list({ cursor })
    const items = []
    for (const key of list.keys) {
      const raw = await env.MAILS.get(key.name)
      if (!raw) continue
      try {
        items.push(JSON.parse(raw))
      } catch {
        // 跳过坏行
      }
    }
    items.sort((a, b) => (a.receivedAt < b.receivedAt ? -1 : 1))

    return Response.json({
      items,
      cursor: list.list_complete ? undefined : list.cursor,
    })
  },
}
