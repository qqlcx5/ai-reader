/**
 * M4 URL 绑定与会话隔离
 *
 * normalizeUrl: 去除查询参数与 hash，得到"净 URL"
 * hashUrl:      SHA-256(normalizeUrl) → hex string，作为 Conversation.id
 */

/**
 * 去除 URL 的查询参数与 fragment，返回净 URL。
 * 若 URL 解析失败则原样返回。
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // 保留 protocol + host + pathname，去掉 search 与 hash
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/$/, '') || parsed.origin
  } catch {
    return url
  }
}

/**
 * SHA-256(normalizeUrl(url)) → lowercase hex string.
 * 在 Extension 环境中使用 WebCrypto API（globalThis.crypto），
 * 在 Node/Vitest 环境中同样可用（Node 15+）。
 */
export async function hashUrl(url: string): Promise<string> {
  const normalized = normalizeUrl(url)
  const encoder = new TextEncoder()
  const data = encoder.encode(normalized)
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}
