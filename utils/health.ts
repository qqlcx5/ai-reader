/**
 * Knowledge-base health checks — pure analysis over documents.
 * Powers the 体检 view: stub docs, untagged, backlog, near-duplicates,
 * and broken highlights. Network checks (dead links) live separately.
 */
import type { DocumentEntity } from '@/types/document'

export interface HealthReport {
  /** Documents with almost no content (likely failed captures). */
  stubDocs: DocumentEntity[]
  /** Documents without any tags. */
  untagged: DocumentEntity[]
  /** Captured 30+ days ago, never opened (the "read later" graveyard). */
  backlog: DocumentEntity[]
  /** Near-duplicate pairs (same normalized title lead or same excerpt head). */
  nearDuplicates: Array<{ a: DocumentEntity; b: DocumentEntity; reason: string }>
  /** Highlights whose offsets point outside the markdown (stale after edits). */
  brokenHighlights: Array<{ doc: DocumentEntity; count: number }>
  totalDocs: number
}

export const BACKLOG_DAYS = 30
export const STUB_WORDS = 50

function normalizeLead(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 60)
}

export function computeHealth(docs: DocumentEntity[], now: Date = new Date()): HealthReport {
  const cutoff = now.getTime() - BACKLOG_DAYS * 86_400_000
  const real = docs.filter((d) => !d.tags?.includes('digest'))

  const stubDocs = real.filter((d) => (d.wordCount ?? 0) < STUB_WORDS)
  const untagged = real.filter((d) => (d.tags ?? []).length === 0)
  const backlog = real.filter((d) => {
    const t = new Date(d.capturedAt).getTime()
    return !Number.isNaN(t) && t <= cutoff && !d.lastOpenedAt
  })

  // Near-duplicates: bucket by normalized title lead AND by excerpt head.
  const byTitleLead = new Map<string, DocumentEntity[]>()
  const byExcerpt = new Map<string, DocumentEntity[]>()
  for (const d of real) {
    if (d.markdown?.trim()) {
      const lead = normalizeLead(d.title || '')
      if (lead) {
        if (!byTitleLead.has(lead)) byTitleLead.set(lead, [])
        byTitleLead.get(lead)!.push(d)
      }
      const excerptHead = normalizeLead(d.excerpt || d.markdown.slice(0, 80))
      if (excerptHead) {
        if (!byExcerpt.has(excerptHead)) byExcerpt.set(excerptHead, [])
        byExcerpt.get(excerptHead)!.push(d)
      }
    }
  }

  const seenPairs = new Set<string>()
  const nearDuplicates: HealthReport['nearDuplicates'] = []
  const pushPair = (a: DocumentEntity, b: DocumentEntity, reason: string) => {
    if (a.id === b.id) return
    const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`
    if (seenPairs.has(key)) return
    seenPairs.add(key)
    nearDuplicates.push({ a: a.id < b.id ? a : b, b: a.id < b.id ? b : a, reason })
  }
  for (const group of [...byTitleLead.values(), ...byExcerpt.values()]) {
    if (group.length < 2) continue
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        pushPair(group[i], group[j], '标题或摘录开头相同')
      }
    }
  }

  const brokenHighlights = real
    .map((doc) => {
      const len = (doc.markdown || '').length
      const count = (doc.highlights ?? []).filter((h) => h.endOffset > len).length
      return { doc, count }
    })
    .filter((x) => x.count > 0)

  return {
    stubDocs,
    untagged,
    backlog,
    nearDuplicates,
    brokenHighlights,
    totalDocs: real.length,
  }
}

export interface HealthScore {
  /** 0–100, higher = healthier. Weights: stubs & dupes hurt most. */
  score: number
  label: string
}

/** Simple weighted score for the header gauge (pure). */
export function healthScore(report: HealthReport): HealthScore {
  const n = Math.max(1, report.totalDocs)
  const stubRatio = report.stubDocs.length / n
  const dupeRatio = report.nearDuplicates.length / n
  const untaggedRatio = report.untagged.length / n
  const backlogRatio = report.backlog.length / n
  const brokenRatio = report.brokenHighlights.length / n
  const penalty = stubRatio * 40 + dupeRatio * 25 + untaggedRatio * 15 + backlogRatio * 15 + brokenRatio * 5
  const score = Math.round(Math.max(0, Math.min(100, 100 - penalty)))
  const label = score >= 85 ? '健康' : score >= 60 ? '良好' : score >= 35 ? '需要整理' : '建议清理'
  return { score, label }
}
