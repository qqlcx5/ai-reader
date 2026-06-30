// Conditional GET for a feed URL. Extension host_permissions bypass CORS,
// so this works against arbitrary origins. 304 (If-None-Match / If-Modified-Since)
// means "nothing changed" — skip parsing entirely.

export interface FetchedFeed {
  xml: string
  etag?: string
  lastModified?: string
  notModified: boolean
}

export async function fetchFeed(
  url: string,
  opts: { etag?: string; lastModified?: string } = {},
): Promise<FetchedFeed> {
  const headers: Record<string, string> = {
    Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
  }
  if (opts.etag) headers['If-None-Match'] = opts.etag
  if (opts.lastModified) headers['If-Modified-Since'] = opts.lastModified

  const res = await fetch(url, { headers, redirect: 'follow' })
  if (res.status === 304) {
    return { xml: '', notModified: true, etag: opts.etag, lastModified: opts.lastModified }
  }
  if (!res.ok) throw new Error(`Feed fetch failed: HTTP ${res.status}`)

  const xml = await res.text()
  return {
    xml,
    notModified: false,
    etag: res.headers.get('etag') ?? undefined,
    lastModified: res.headers.get('last-modified') ?? undefined,
  }
}
