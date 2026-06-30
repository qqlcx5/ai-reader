import type { FeedEntity } from '@/types/feed'

export interface OpmlSubscription {
  xmlUrl: string
  title?: string
  folder?: string
}

function esc(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] as string))
}

/** Serialize subscriptions to OPML 2.0, grouping by folder. */
export function exportOpml(feeds: FeedEntity[]): string {
  const byFolder = new Map<string, FeedEntity[]>()
  for (const f of feeds) {
    const k = f.folder || ''
    byFolder.set(k, [...(byFolder.get(k) ?? []), f])
  }

  const outlines: string[] = []
  for (const [folder, list] of byFolder) {
    const items = list
      .map(
        (f) =>
          `      <outline type="rss" text="${esc(f.title)}" title="${esc(f.title)}" xmlUrl="${esc(f.url)}" htmlUrl="${esc(f.siteUrl || '')}" />`,
      )
      .join('\n')
    if (folder) {
      outlines.push(`    <outline text="${esc(folder)}" title="${esc(folder)}">\n${items}\n    </outline>`)
    } else {
      outlines.push(items)
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>AuraMind subscriptions</title></head>
  <body>
${outlines.join('\n')}
  </body>
</opml>`
}

/** Parse an OPML document into a flat list of subscriptions (with folder). */
export function parseOpml(xml: string): OpmlSubscription[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const out: OpmlSubscription[] = []

  function walk(el: Element, folder?: string): void {
    for (const c of Array.from(el.children)) {
      if (c.localName !== 'outline') continue
      const xmlUrl = c.getAttribute('xmlUrl')
      if (xmlUrl) {
        out.push({
          xmlUrl,
          title: c.getAttribute('title') || c.getAttribute('text') || undefined,
          folder,
        })
      } else {
        walk(c, c.getAttribute('title') || c.getAttribute('text') || folder)
      }
    }
  }

  const body = Array.from(doc.getElementsByTagName('*')).find((e) => e.localName === 'body')
  if (body) walk(body)
  return out
}
