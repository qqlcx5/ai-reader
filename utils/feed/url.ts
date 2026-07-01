/**
 * Tracking params feeds commonly carry. Stripped from FEED subscription URLs,
 * where they're noise and make one feed look like several different URLs.
 */
const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'mc_cid', 'mc_eid', 'ref', '_hsenc', '_hsmi', 'vero_id',
]

/**
 * Canonicalize a feed URL for dedup. The same feed subscribed as
 * `HTTPS://X.com/Feed`, `https://x.com/feed/?utm_source=rss`, or
 * `https://x.com/feed#top` should all collapse to one subscription.
 *
 * Conservative: only rewrites things servers treat as equivalent anyway —
 * scheme/host are lowercased (RFC 3986), tracking query params and the fragment
 * are dropped, and a non-root trailing slash is removed. The scheme itself and
 * www/non-www are left alone, because forcing https or stripping www can break
 * hosts that don't redirect. A non-URL / relative input is returned trimmed but
 * otherwise unchanged (validation happens later, at fetch time).
 */
export function normalizeFeedUrl(input: string): string {
  const trimmed = input.trim()
  let u: URL
  try {
    u = new URL(trimmed)
  } catch {
    return trimmed
  }

  u.protocol = u.protocol.toLowerCase()
  u.hostname = u.hostname.toLowerCase()
  u.hash = ''
  for (const key of TRACKING_PARAMS) u.searchParams.delete(key)
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
    u.pathname = u.pathname.replace(/\/+$/, '')
  }

  return u.toString()
}
