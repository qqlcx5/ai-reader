/**
 * Topic discovery — cluster the library by embedding vectors (k-means) and
 * name each cluster with the default AI model. Requires a fresh embedding
 * index (settings → 语义检索); degrades to a clear "not ready" result.
 */
import { db } from '@/db/index'
import { DocumentRepository } from '@/db/repositories/document.repository'
import { ModelRepository } from '@/db/repositories/model.repository'
import { createProvider } from '@/services/ai/factory'
import type { AIProvider } from '@/services/ai/types'
import type { ModelConfig } from '@/types/model'
import type { DocumentEntity } from '@/types/document'
import { kMeans, pickK, distance } from '@/utils/cluster'
import { embeddingIndexStats } from './embedding'

export interface TopicCluster {
  /** Cluster display name (AI-generated or fallback). */
  name: string
  /** Member documents, closest to the centroid first. */
  docs: DocumentEntity[]
}

export interface TopicResult {
  clusters: TopicCluster[]
  /** Why clustering is unavailable, when it is. */
  notReady?: string
}

const NAME_PROMPT = `你是知识库主题命名助手。用户给你一组文档标题（同一聚类），请给出一个不超过 6 个字的主题名。

要求：直接输出主题名本身，不要引号、标点或解释；概括这组标题的共同主题。`

/** Name one cluster from its titles (best-effort; falls back to tags/first title). */
export async function nameCluster(
  titles: string[],
  model?: ModelConfig | null,
  provider?: AIProvider,
): Promise<string> {
  if (titles.length === 0) return '未命名'
  try {
    const model_ = model ?? (await ModelRepository.findDefault())
    if (!model_) return fallbackName(titles)
    const provider_ = provider ?? createProvider(model_)
    const out = await provider_.chat({
      model: model_,
      systemPrompt: NAME_PROMPT,
      messages: [{ role: 'user', content: titles.slice(0, 12).map((t, i) => `${i + 1}. ${t}`).join('\n') }],
    })
    const name = out.content.trim().replace(/^["'「『]|["'」』]$/g, '').slice(0, 12)
    return name || fallbackName(titles)
  } catch {
    return fallbackName(titles)
  }
}

function fallbackName(titles: string[]): string {
  return titles[0].slice(0, 8)
}

/**
 * Cluster the library. Pure-ish: vector math is deterministic; AI naming is
 * best-effort per cluster.
 */
export async function computeTopics(opts: { nameWithAI?: boolean } = {}): Promise<TopicResult> {
  const stats = await embeddingIndexStats()
  if (stats.total === 0) return { clusters: [], notReady: '知识库为空' }
  if (stats.fresh < stats.total) {
    return { clusters: [], notReady: `语义索引未就绪（${stats.fresh}/${stats.total}），请先在设置→语义检索构建索引` }
  }

  const docs = (await DocumentRepository.findAll()).filter((d) => d.markdown?.trim())
  const vectorByDoc = new Map<string, number[]>()
  await db.embeddings.each((row) => vectorByDoc.set(row.docId, row.vector))
  const withVectors = docs.filter((d) => vectorByDoc.has(d.id))
  if (withVectors.length < 4) return { clusters: [], notReady: '文档太少（至少 4 篇）' }

  const vectors = withVectors.map((d) => vectorByDoc.get(d.id)!)
  const k = pickK(withVectors.length)
  const labels = kMeans(vectors, k)

  // Group + order members by distance to their centroid.
  const centroids: number[][] = []
  for (let c = 0; c < k; c++) {
    const members = vectors.filter((_, i) => labels[i] === c)
    if (members.length > 0) {
      centroids.push(members.reduce((acc, v) => acc.map((x, i) => x + v[i]), new Array(vectors[0].length).fill(0)).map((x) => x / members.length))
    } else {
      centroids.push(vectors[0])
    }
  }

  const groups: Array<{ centroid: number[]; members: Array<{ doc: DocumentEntity; dist: number }> }> = []
  withVectors.forEach((doc, i) => {
    const c = labels[i]
    while (groups.length <= c) groups.push({ centroid: centroids[c] ?? vectors[0], members: [] })
    groups[c].members.push({ doc, dist: distance(vectors[i], centroids[c] ?? vectors[0]) })
  })

  const nameWithAI = opts.nameWithAI !== false
  const model = nameWithAI ? await ModelRepository.findDefault() : null

  const clusters: TopicCluster[] = []
  for (const group of groups) {
    if (group.members.length === 0) continue
    group.members.sort((a, b) => a.dist - b.dist)
    const docsSorted = group.members.map((m) => m.doc)
    const name = nameWithAI
      ? await nameCluster(docsSorted.map((d) => d.title || '无标题'), model)
      : fallbackName(docsSorted.map((d) => d.title || '无标题'))
    clusters.push({ name, docs: docsSorted })
  }
  clusters.sort((a, b) => b.docs.length - a.docs.length)
  return { clusters }
}
