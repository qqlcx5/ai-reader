<script lang="ts">
export default { name: 'GraphView' }
</script>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { RefreshCw } from '@lucide/vue'
import { useAppStore } from '@/stores/app.store'
import { useDocumentStore } from '@/stores/document.store'
import { useChatStore } from '@/stores/chat.store'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { DocumentRepository } from '@/db/repositories/document.repository'
import { buildLinkGraph, type GraphNode } from '@/utils/wikilinks'
import type { DocumentEntity } from '@/types/document'
import UButton from '@/components/ui/UButton.vue'
import UEmptyState from '@/components/ui/UEmptyState.vue'

const appStore = useAppStore()
const documentStore = useDocumentStore()
const chatStore = useChatStore()
const workspaceStore = useWorkspaceStore()

const loading = ref(false)
const nodes = ref<GraphNode[]>([])
const positions = ref<Record<string, { x: number; y: number }>>({})
const selectedId = ref<string | null>(null)

const W = 680
const H = 460

const edges = ref<{ source: string; target: string }[]>([])
const docsById = new Map<string, DocumentEntity>()

const hasLinks = computed(() => edges.value.length > 0)
const linkedCount = computed(() => nodes.value.filter((n) => n.outDegree + n.inDegree > 0).length)

async function load() {
  loading.value = true
  try {
    const docs = await DocumentRepository.findAll()
    docsById.clear()
    for (const d of docs) docsById.set(d.id, d)
    const graph = buildLinkGraph(docs)
    // Keep the graph readable: only nodes that participate in links, capped.
    const linked = graph.nodes
      .filter((n) => n.outDegree + n.inDegree > 0)
      .sort((a, b) => (b.outDegree + b.inDegree) - (a.outDegree + a.inDegree))
      .slice(0, 200)
    const keep = new Set(linked.map((n) => n.id))
    edges.value = graph.edges.filter((e) => keep.has(e.source) && keep.has(e.target))
    nodes.value = linked
    positions.value = layout(linked, edges.value)
  } finally {
    loading.value = false
  }
}

/** Minimal force-directed layout: repulsion + edge springs + center gravity. */
function layout(ns: GraphNode[], es: { source: string; target: string }[]) {
  const pos = new Map<string, { x: number; y: number; vx: number; vy: number }>()
  ns.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(1, ns.length)
    const radius = Math.min(W, H) / 3
    pos.set(n.id, {
      x: W / 2 + radius * Math.cos(angle),
      y: H / 2 + radius * Math.sin(angle),
      vx: 0,
      vy: 0,
    })
  })

  const REPEL = 5200
  const SPRING = 0.012
  const REST = 90
  const GRAVITY = 0.02
  const DAMPING = 0.85

  for (let step = 0; step < 300; step++) {
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const a = pos.get(ns[i].id)!
        const b = pos.get(ns[j].id)!
        let dx = a.x - b.x
        let dy = a.y - b.y
        let d2 = dx * dx + dy * dy
        if (d2 < 1) {
          dx = Math.random() - 0.5
          dy = Math.random() - 0.5
          d2 = 1
        }
        const f = REPEL / d2
        const d = Math.sqrt(d2)
        a.vx += (dx / d) * f
        a.vy += (dy / d) * f
        b.vx -= (dx / d) * f
        b.vy -= (dy / d) * f
      }
    }
    for (const e of es) {
      const a = pos.get(e.source)
      const b = pos.get(e.target)
      if (!a || !b) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d = Math.max(1, Math.hypot(dx, dy))
      const f = (d - REST) * SPRING
      a.vx += (dx / d) * f
      a.vy += (dy / d) * f
      b.vx -= (dx / d) * f
      b.vy -= (dy / d) * f
    }
    for (const p of pos.values()) {
      p.vx += (W / 2 - p.x) * GRAVITY
      p.vy += (H / 2 - p.y) * GRAVITY
      p.vx *= DAMPING
      p.vy *= DAMPING
      p.x = Math.min(W - 10, Math.max(10, p.x + p.vx))
      p.y = Math.min(H - 10, Math.max(10, p.y + p.vy))
    }
  }

  const result: Record<string, { x: number; y: number }> = {}
  for (const [id, p] of pos) result[id] = { x: Math.round(p.x), y: Math.round(p.y) }
  return result
}

function nodeRadius(n: GraphNode): number {
  return 5 + 2.2 * Math.sqrt(n.outDegree + n.inDegree)
}

/** Label only high-degree nodes to keep the canvas readable. */
function showLabel(n: GraphNode): boolean {
  const top = [...nodes.value]
    .sort((a, b) => (b.outDegree + b.inDegree) - (a.outDegree + a.inDegree))
    .slice(0, 14)
  return top.includes(n) || selectedId.value === n.id
}

async function openNode(n: GraphNode) {
  selectedId.value = n.id
  const doc = docsById.get(n.id)
  if (!doc) {
    appStore.showToast(`「${n.title}」还没有对应文档`, 'info')
    return
  }
  documentStore.setCurrentDocument(doc)
  documentStore.markOpened(doc.id)
  workspaceStore.setDocumentSource('library')
  try {
    await chatStore.loadConversations(doc.id)
  } catch {
    // non-critical
  }
  appStore.setCurrentView('workspace')
}

onMounted(load)
</script>

<template>
  <div class="flex-1 min-h-0 overflow-y-auto">
    <div class="max-w-2xl mx-auto px-4 py-5 flex flex-col gap-3">
      <div class="flex items-center justify-between text-xs text-zinc-500">
        <span>
          知识图谱：<b class="text-zinc-800">{{ linkedCount }}</b> 篇关联文档 ·
          <b class="text-zinc-800">{{ edges.length }}</b> 条链接
          <span class="text-zinc-400">（在正文或高亮笔记中写 [[标题]] 即可建立链接）</span>
        </span>
        <UButton size="sm" variant="ghost" :disabled="loading" @click="load">
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" />
        </UButton>
      </div>

      <div v-if="hasLinks" class="bg-white border border-zinc-200 rounded-2xl soft-shadow overflow-hidden">
        <svg :viewBox="`0 0 ${W} ${H}`" class="w-full select-none" role="img">
          <g v-for="(e, i) in edges" :key="i">
            <line
              v-if="positions[e.source] && positions[e.target]"
              :x1="positions[e.source].x" :y1="positions[e.source].y"
              :x2="positions[e.target].x" :y2="positions[e.target].y"
              class="stroke-zinc-200"
              stroke-width="1"
            />
          </g>
          <g
            v-for="n in nodes"
            :key="n.id"
            class="cursor-pointer"
            @click="openNode(n)"
          >
            <circle
              v-if="positions[n.id]"
              :cx="positions[n.id].x" :cy="positions[n.id].y" :r="nodeRadius(n)"
              :class="n.ghost
                ? 'fill-zinc-100 stroke-zinc-300'
                : selectedId === n.id
                  ? 'fill-brand stroke-brand/60'
                  : 'fill-brand/70 stroke-brand/40'"
              stroke-width="1.5"
            />
            <text
              v-if="positions[n.id] && showLabel(n)"
              :x="positions[n.id].x" :y="positions[n.id].y - nodeRadius(n) - 4"
              text-anchor="middle"
              class="fill-zinc-500 pointer-events-none"
              font-size="10"
            >{{ n.title.slice(0, 16) }}</text>
          </g>
        </svg>
      </div>

      <UEmptyState
        v-else-if="!loading"
        title="还没有链接关系"
        description="在文档正文或高亮笔记里写 [[另一篇文档的标题]]，这里就会展示你的知识网络。灰色空心圆是尚未创建的文档。"
      />
    </div>
  </div>
</template>
