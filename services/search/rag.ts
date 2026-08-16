/**
 * Knowledge-base retrieval (RAG) — search the whole library and pack the top
 * matches into a numbered context block for the chat model, with citation
 * sources for the UI.
 *
 * The search index is panel-owned and lazily built; retrieval initializes it
 * on first use so asking works even before the library view was opened.
 */
import { searchIndex, initSearchIndex, searchDocuments } from './index'
import { DocumentRepository } from '../../db/repositories/document.repository'
import { CollectionRepository } from '../../db/repositories/collection.repository'
import { truncateContext } from '../prompt/truncate'
import { bigrams } from './related'
import { fuseRankings } from './embedding'
import { loadEmbeddingConfig, isConfigured, semanticRank } from './embedding'
import type { DocumentEntity } from '../../types/document'

export interface RetrievedSource {
  id: string
  title: string
  siteName?: string
}

export interface RetrievalResult {
  /** Numbered context block ready to use as prompt context. */
  context: string
  /** Matching documents in citation order. */
  sources: RetrievedSource[]
}

/** Tokens budgeted per retrieved document. */
export const PER_DOC_TOKENS = 1200

const HEADER = `以下是从用户个人知识库中检索到的相关文档片段。回答时：
- 优先依据片段作答，并用 [编号] 标注引用（例如 [1]）
- 片段中没有的信息就直说知识库里没有，不要编造
- 用用户的语言回答`

/**
 * Second-stage rerank: bigram overlap between the query and each candidate's
 * signature (title + excerpt + lead). Fixes MiniSearch's CJK tokenization
 * blind spot — candidates that share rare character pairs with the query
 * outrank generic keyword hits.
 */
export function rerankByBigram(
  query: string,
  docs: DocumentEntity[],
  k: number,
): DocumentEntity[] {
  const q = bigrams(query)
  if (q.size === 0) return docs.slice(0, k)
  return docs
    .map((doc) => {
      const sig = bigrams([doc.title || '', doc.excerpt || '', (doc.markdown || '').slice(0, 600)].join(' '))
      let overlap = 0
      for (const g of q) if (sig.has(g)) overlap++
      return { doc, score: overlap / Math.sqrt(q.size * Math.max(1, sig.size)) }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.doc)
}

export async function retrieveKnowledge(
  query: string,
  k = 4,
  opts: { perDocTokens?: number; excludeIds?: string[]; collectionId?: string; candidatePool?: number; ensureIds?: string[] } = {},
): Promise<RetrievalResult> {
  const q = query.trim()
  if (!q) return { context: '', sources: [] }

  // Lazily build the index if this is the first retrieval this session.
  if (searchIndex.documentCount === 0) {
    await initSearchIndex()
  }

  const exclude = new Set(opts.excludeIds ?? [])
  let hits = (await searchDocuments(q)).filter((h) => !exclude.has(h.id))

  // Optional collection scope: restrict candidates to the collection's docs.
  if (opts.collectionId) {
    const inCollection = new Set(await CollectionRepository.getDocumentIds(opts.collectionId))
    hits = hits.filter((h) => inCollection.has(h.id))
  }

  const pool = opts.candidatePool ?? 10
  const candidateIds = hits.slice(0, pool)

  // Multi-turn memory: previously cited docs stay retrievable for follow-ups.
  const ensureIds = (opts.ensureIds ?? []).filter((id) => !exclude.has(id))

  // ── Hybrid retrieval: when an embedding endpoint is configured, fuse
  // keyword candidates with semantic ranking (RRF). Semantic misses can
  // surface docs MiniSearch's tokenizer never matched (esp. CJK).
  let fusedIds: string[] | null = null
  try {
    const embConfig = await loadEmbeddingConfig()
    if (isConfigured(embConfig)) {
      const semanticIds = await semanticRank(q, embConfig, pool)
      if (semanticIds.length > 0) {
        fusedIds = fuseRankings([candidateIds.map((h) => h.id), semanticIds], pool)
      }
    }
  } catch {
    // semantic leg is best-effort — keyword-only on failure
  }
  let finalIds = fusedIds ?? candidateIds.map((h) => h.id)
  if (ensureIds.length > 0) {
    finalIds = [...new Set([...ensureIds, ...finalIds])]
  }

  const candidates: DocumentEntity[] = []
  for (const id of finalIds) {
    const doc = await DocumentRepository.findById(id)
    if (doc?.markdown?.trim()) candidates.push(doc)
  }
  if (candidates.length === 0) return { context: '', sources: [] }

  const docs = fusedIds ? candidates.slice(0, k) : rerankByBigram(q, candidates, k)

  const perDoc = opts.perDocTokens ?? PER_DOC_TOKENS
  const blocks = docs.map((doc, i) => {
    const meta = [doc.siteName, doc.capturedAt?.slice(0, 10)].filter(Boolean).join(' · ')
    const head = `[${i + 1}] 《${doc.title || '无标题'}》${meta ? ` — ${meta}` : ''}`
    return `${head}\n${truncateContext(doc.markdown, perDoc)}`
  })

  return {
    context: `${HEADER}\n\n${blocks.join('\n\n---\n\n')}`,
    sources: docs.map((d) => ({ id: d.id, title: d.title || '(无标题)', siteName: d.siteName })),
  }
}
