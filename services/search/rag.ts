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
import { truncateContext } from '../prompt/truncate'
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

export async function retrieveKnowledge(
  query: string,
  k = 4,
  opts: { perDocTokens?: number; excludeIds?: string[] } = {},
): Promise<RetrievalResult> {
  const q = query.trim()
  if (!q) return { context: '', sources: [] }

  // Lazily build the index if this is the first retrieval this session.
  if (searchIndex.documentCount === 0) {
    await initSearchIndex()
  }

  const exclude = new Set(opts.excludeIds ?? [])
  const hits = (await searchDocuments(q))
    .filter((h) => !exclude.has(h.id))
    .slice(0, k)

  const docs: DocumentEntity[] = []
  for (const hit of hits) {
    const doc = await DocumentRepository.findById(hit.id)
    if (doc?.markdown?.trim()) docs.push(doc)
  }
  if (docs.length === 0) return { context: '', sources: [] }

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
