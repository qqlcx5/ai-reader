// Dependency-free RSS / Atom parser built on the browser's DOMParser.
// Handles RSS 2.0, RSS 1.0 (RDF), and Atom 1.0, including common
// namespaced fields (content:encoded, dc:creator) by matching localName.

export interface ParsedFeedItem {
  guid: string
  title: string
  link: string
  summary: string
  contentHtml?: string
  author?: string
  publishedAt?: string
}

export interface ParsedFeed {
  title: string
  siteUrl?: string
  description?: string
  items: ParsedFeedItem[]
}

function child(el: Element | null | undefined, local: string): Element | undefined {
  if (!el) return undefined
  for (const c of Array.from(el.children)) {
    if (c.localName === local) return c
  }
  return undefined
}

function text(el: Element | null | undefined, local: string): string {
  return child(el, local)?.textContent?.trim() ?? ''
}

function children(el: Element, local: string): Element[] {
  return Array.from(el.children).filter((c) => c.localName === local)
}

function pickLink(parent: Element): string {
  // Atom: <link rel="alternate" href="..." /> (or first link without rel).
  const links = children(parent, 'link')
  if (links.length) {
    const alt =
      links.find((l) => l.getAttribute('rel') === 'alternate') ?? links.find((l) => !l.getAttribute('rel')) ?? links[0]
    return alt.getAttribute('href') ?? ''
  }
  return ''
}

function parseRssItem(item: Element): ParsedFeedItem {
  const link = text(item, 'link')
  const guid = text(item, 'guid') || link
  const contentHtml = text(item, 'encoded') || undefined // content:encoded
  return {
    guid,
    title: text(item, 'title') || '(untitled)',
    link,
    summary: text(item, 'description'),
    contentHtml,
    author: text(item, 'creator') || undefined, // dc:creator
    publishedAt: text(item, 'pubDate') || text(item, 'date') || undefined,
  }
}

function parseAtomEntry(entry: Element): ParsedFeedItem {
  const id = text(entry, 'id')
  const link = pickLink(entry)
  const authorEl = child(entry, 'author')
  return {
    guid: id || link,
    title: text(entry, 'title') || '(untitled)',
    link,
    summary: text(entry, 'summary') || text(entry, 'content'),
    contentHtml: text(entry, 'content') || undefined,
    author: authorEl ? text(authorEl, 'name') : undefined,
    publishedAt: text(entry, 'published') || text(entry, 'updated') || undefined,
  }
}

export function parseFeed(xml: string): ParsedFeed {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')

  const parseError = doc.getElementsByTagName('parsererror')[0]
  if (parseError) {
    throw new Error('Invalid feed XML')
  }

  const root = doc.documentElement
  const rootName = root.localName

  if (rootName === 'feed') {
    const siteUrl = pickLink(root) || undefined
    const entries = children(root, 'entry')
    return {
      title: text(root, 'title') || 'Untitled feed',
      siteUrl,
      description: text(root, 'subtitle') || undefined,
      items: entries.map(parseAtomEntry),
    }
  }

  // RSS 2.0 (<rss><channel>) and RSS 1.0 (<rdf:RDF>) both expose items,
  // either under <channel> or at the root.
  const channel = child(root, 'channel') ?? root
  const itemEls = children(channel, 'item')
  if (!itemEls.length && rootName === 'RDF') {
    // RDF: items are siblings of channel, at root level.
    itemEls.push(...children(root, 'item'))
  }
  return {
    title: text(channel, 'title') || 'Untitled feed',
    siteUrl: text(channel, 'link') || undefined,
    description: text(channel, 'description') || undefined,
    items: itemEls.map(parseRssItem),
  }
}
