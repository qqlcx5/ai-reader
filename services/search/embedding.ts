/**
 * Semantic search via an OpenAI-compatible /embeddings endpoint
 * (OpenAI text-embedding-3-small, SiliconFlow, Groq, etc.).
 *
 * Vectors are cached per document in the `embeddings` table, keyed by
 * contentHash — an edited document re-embeds automatically. Retrieval fuses
 * semantic and keyword rankings with Reciprocal Rank Fusion.
 */
import { db } from '@/db/index'
import { MetaRepository } from '@/db/repositories/meta.repository'
import { DocumentRepository } from '@/db/repositories/document.repository'
import { truncateContext } from '@/services/prompt/truncate'

/** Device-local embedding endpoint config (kvMeta 'embedding-config'). */
export interface EmbeddingConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'text-embedding-3-small',
}

const CONFIG_KEY = 'embedding-config'

export async function loadEmbeddingConfig(): Promise<EmbeddingConfig> {
  return { ...DEFAULT_EMBEDDING_CONFIG, ...((await MetaRepository.get<EmbeddingConfig>(CONFIG_KEY)) ?? {}) }
}

export async function saveEmbeddingConfig(config: EmbeddingConfig): Promise<void> {
  await MetaRepository.set(CONFIG_KEY, config)
}

export function isConfigured(config: EmbeddingConfig): boolean {
  return Boolean(config.baseUrl && config.apiKey && config.model)
}

/** Call the embeddings endpoint for a batch of texts. */
export async function embedTexts(texts: string[], config: EmbeddingConfig, signal?: AbortSignal): Promise<number[][]> {
  if (texts.length === 0) return []
  const res = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({ model: config.model, input: texts }),
    signal,
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`embedding 请求失败：HTTP ${res.status} ${detail.slice(0, 150)}`)
  }
  const data = (await res.json()) as { data?: Array<{ embedding: number[] }> }
  const vectors = data.data?.map((d) => d.embedding)
  if (!vectors || vectors.length !== texts.length) throw new Error('embedding 响应格式不正确')
  return vectors
}

/** Cosine similarity of two equal-length vectors (pure). */
export function cosine(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

/** What gets embedded for a document (pure). */
export function embeddableText(title: string, markdown: string): string {
  return `${title}\n\n${truncateContext(markdown, 4000)}`
}

/**
 * Reciprocal Rank Fusion (pure): merge ranked id lists into one ranking.
 * Standard k=60 damping.
 */
export function fuseRankings(rankings: string[][], k = 4, kConstant = 60): string[] {
  const scores = new Map<string, number>()
  for (const ranking of rankings) {
    ranking.forEach((id, rank) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (kConstant + rank + 1))
    })
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([id]) => id)
}

export interface EmbedProgress {
  embedded: number
  total: number
}

/**
 * Ensure every document has a fresh vector. Batches (16/call), skips docs
 * whose contentHash matches. Returns how many were newly embedded.
 */
export async function buildEmbeddingIndex(
  config: EmbeddingConfig,
  onProgress?: (p: EmbedProgress) => void,
  signal?: AbortSignal,
): Promise<number> {
  const docs = await DocumentRepository.findAll()
  const cached = new Map<string, string>()
  await db.embeddings.each((row) => cached.set(row.docId, row.contentHash))

  const stale = docs.filter((d) => d.markdown?.trim() && cached.get(d.id) !== d.contentHash)
  let embedded = 0
  const BATCH = 16
  for (let i = 0; i < stale.length; i += BATCH) {
    if (signal?.aborted) break
    const batch = stale.slice(i, i + BATCH)
    const vectors = await embedTexts(batch.map((d) => embeddableText(d.title || '', d.markdown)), config, signal)
    const now = new Date().toISOString()
    await db.embeddings.bulkPut(
      batch.map((d, j) => ({ docId: d.id, model: config.model, contentHash: d.contentHash, vector: vectors[j], updatedAt: now })),
    )
    embedded += batch.length
    onProgress?.({ embedded, total: stale.length })
  }

  // Drop vectors of deleted documents.
  const liveIds = new Set(docs.map((d) => d.id))
  const dead: string[] = []
  await db.embeddings.each((row) => {
    if (!liveIds.has(row.docId)) dead.push(row.docId)
  })
  if (dead.length > 0) await db.embeddings.bulkDelete(dead)

  return embedded
}

/** Semantic ranking over cached vectors for a query (embeds the query once). */
export async function semanticRank(
  query: string,
  config: EmbeddingConfig,
  k: number,
  signal?: AbortSignal,
): Promise<string[]> {
  const [queryVector] = await embedTexts([query], config, signal)
  const rows = await db.embeddings.toArray()
  return rows
    .map((row) => ({ docId: row.docId, score: cosine(queryVector, row.vector) }))
    .filter((x) => x.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .slice(0, k * 3) // candidate pool; fusion decides the final k
    .map((x) => x.docId)
}

/** Index health: how many docs have fresh vectors. */
export async function embeddingIndexStats(): Promise<{ fresh: number; total: number }> {
  const docs = await DocumentRepository.findAll()
  const withContent = docs.filter((d) => d.markdown?.trim())
  const cached = new Map<string, string>()
  await db.embeddings.each((row) => cached.set(row.docId, row.contentHash))
  const fresh = withContent.filter((d) => cached.get(d.id) === d.contentHash).length
  return { fresh, total: withContent.length }
}
