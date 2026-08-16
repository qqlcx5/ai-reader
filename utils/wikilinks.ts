/**
 * `[[Wikilink]]` support — extraction, title resolution, and graph building.
 *
 * Links are authored in document markdown and highlight notes
 * (`[[标题]]` or `[[标题|显示文本]]`). Resolution matches document titles
 * case/whitespace-insensitively; unmatched targets become ghost nodes so the
 * graph shows what is still missing.
 */
import type { DocumentEntity } from '@/types/document'

export const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

export interface Wikilink {
  /** Link target as written (before normalization). */
  target: string
  /** Display label; defaults to the target text. */
  label: string
}

/** All wikilinks in a text, in order of appearance. */
export function extractWikilinks(text: string): Wikilink[] {
  const links: Wikilink[] = []
  for (const m of text.matchAll(WIKILINK_RE)) {
    const target = (m[1] || '').trim()
    if (!target) continue
    links.push({ target, label: (m[2] || '').trim() || target })
  }
  return links
}

/** Normalize a title for matching: case- and whitespace-insensitive. */
export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ')
}

export interface GraphNode {
  /** Document id, or `ghost:` + normalized title for unresolved targets. */
  id: string
  title: string
  outDegree: number
  inDegree: number
  /** True when no library document matches this title. */
  ghost: boolean
}

export interface GraphEdge {
  source: string
  target: string
}

export interface WikilinkGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

/** The text of a document that may contain wikilinks: body + highlight notes. */
function linkableText(doc: DocumentEntity): string {
  const notes = (doc.highlights ?? [])
    .map((h) => h.note || '')
    .filter(Boolean)
    .join('\n')
  return notes + '\n' + (doc.markdown || '')
}

/**
 * Build the link graph over a set of documents. Edges connect existing
 * documents only; unresolved targets appear as ghost nodes (one per unique
 * title) and still contribute to the source document's outDegree.
 */
export function buildLinkGraph(docs: DocumentEntity[]): WikilinkGraph {
  const byTitle = new Map<string, DocumentEntity>()
  for (const doc of docs) {
    const key = normalizeTitle(doc.title || '')
    if (!key) continue
    // First (oldest) doc wins on duplicate titles so links stay stable.
    if (!byTitle.has(key)) byTitle.set(key, doc)
  }

  const nodes = new Map<string, GraphNode>()
  const ensureDocNode = (doc: DocumentEntity): GraphNode => {
    let node = nodes.get(doc.id)
    if (!node) {
      node = { id: doc.id, title: doc.title || '(无标题)', outDegree: 0, inDegree: 0, ghost: false }
      nodes.set(doc.id, node)
    }
    return node
  }

  const edgeKeys = new Set<string>()
  const edges: GraphEdge[] = []

  for (const doc of docs) {
    const from = ensureDocNode(doc)
    for (const link of extractWikilinks(linkableText(doc))) {
      const key = normalizeTitle(link.target)
      if (!key) continue
      const target = byTitle.get(key)
      if (target) {
        const to = ensureDocNode(target)
        if (to.id === from.id) continue // no self-loops
        const ek = `${from.id}\u0000${to.id}`
        if (!edgeKeys.has(ek)) {
          edgeKeys.add(ek)
          from.outDegree++
          to.inDegree++
          edges.push({ source: from.id, target: to.id })
        }
      } else {
        // Ghost node: one per unresolved title.
        const ghostId = `ghost:${key}`
        let ghost = nodes.get(ghostId)
        if (!ghost) {
          ghost = { id: ghostId, title: link.target, outDegree: 0, inDegree: 0, ghost: true }
          nodes.set(ghostId, ghost)
        }
        const ek = `${from.id}\u0000${ghostId}`
        if (!edgeKeys.has(ek)) {
          edgeKeys.add(ek)
          from.outDegree++
          ghost.inDegree++
          edges.push({ source: from.id, target: ghostId })
        }
      }
    }
  }

  return { nodes: [...nodes.values()], edges }
}
