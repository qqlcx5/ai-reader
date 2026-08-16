<script lang="ts">
export default { name: 'HealthView' }
</script>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { HeartPulse, RefreshCw, Trash2, Globe, Tag, ExternalLink } from '@lucide/vue'
import UButton from '@/components/ui/UButton.vue'
import UEmptyState from '@/components/ui/UEmptyState.vue'
import { DocumentRepository } from '@/db/repositories/document.repository'
import { computeHealth, healthScore, type HealthReport } from '@/utils/health'
import { scanDeadLinks, type LinkCheckResult } from '@/services/health/deadlinks'
import { useAppStore } from '@/stores/app.store'
import { useDocumentStore } from '@/stores/document.store'
import { useChatStore } from '@/stores/chat.store'
import { useWorkspaceStore } from '@/stores/workspace.store'
import type { DocumentEntity } from '@/types/document'

const appStore = useAppStore()
const documentStore = useDocumentStore()
const chatStore = useChatStore()
const workspaceStore = useWorkspaceStore()

const loading = ref(false)
const report = ref<HealthReport | null>(null)
const score = computed(() => (report.value ? healthScore(report.value) : null))

// ── Dead link scan ──
const scanning = ref(false)
const scanProgress = ref('')
const deadLinks = ref<LinkCheckResult[]>([])

async function load() {
  loading.value = true
  try {
    const docs = await DocumentRepository.findAll()
    report.value = computeHealth(docs)
  } finally {
    loading.value = false
  }
}

async function scanLinks() {
  if (scanning.value) return
  scanning.value = true
  deadLinks.value = []
  scanProgress.value = '0/0'
  try {
    const docs = await DocumentRepository.findAll()
    deadLinks.value = (await scanDeadLinks(docs, (d, t) => (scanProgress.value = `${d}/${t}`))).filter((r) => !r.ok)
    appStore.showToast(deadLinks.value.length > 0 ? `发现 ${deadLinks.value.length} 个死链` : '抽样链接全部可用', deadLinks.value.length > 0 ? 'warning' : 'success')
  } catch (e: any) {
    appStore.showToast(e?.message || '扫描失败', 'error')
  } finally {
    scanning.value = false
    scanProgress.value = ''
  }
}

/** Batch delete stub docs (wordCount < 50), with confirm via native dialog. */
async function cleanStubs() {
  const stubs = report.value?.stubDocs ?? []
  if (stubs.length === 0) return
  if (!window.confirm(`删除 ${stubs.length} 篇空壳文档（正文少于 50 词）？此操作不可撤销。`)) return
  for (const doc of stubs) {
    await documentStore.deleteDocument(doc.id)
  }
  appStore.showToast(`已清理 ${stubs.length} 篇空壳文档`, 'success')
  await load()
}

/** Remove one of a near-duplicate pair (keep the richer one). */
async function removeDuplicate(pair: { a: DocumentEntity; b: DocumentEntity }) {
  const keep = (pair.a.wordCount ?? 0) >= (pair.b.wordCount ?? 0) ? pair.a : pair.b
  const remove = keep.id === pair.a.id ? pair.b : pair.a
  await documentStore.deleteDocument(remove.id)
  appStore.showToast(`已删除重复文档「${remove.title || remove.id.slice(0, 8)}」，保留更完整的一篇`, 'success')
  await load()
}

async function openDoc(doc: DocumentEntity) {
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

const sections = computed(() => {
  if (!report.value) return []
  const r = report.value
  return [
    { key: 'stub', icon: Trash2, label: '空壳文档', hint: '正文少于 50 词，可能是抓取失败', count: r.stubDocs.length, docs: r.stubDocs, action: { label: '一键清理', run: cleanStubs } },
    { key: 'dupe', icon: Tag, label: '近重复文档', hint: '标题或摘录开头相同的文档对', count: r.nearDuplicates.length, pairs: r.nearDuplicates },
    { key: 'untagged', icon: Tag, label: '未打标签', hint: '开启「抓取时 AI 自动打标签」可逐步补齐', count: r.untagged.length, docs: r.untagged.slice(0, 20) },
    { key: 'backlog', icon: ExternalLink, label: '积压未读', hint: `剪藏超过 30 天从未打开`, count: r.backlog.length, docs: r.backlog.slice(0, 20) },
    { key: 'broken', icon: Tag, label: '高亮漂移', hint: '高亮位置超出正文（文档编辑过）', count: r.brokenHighlights.length, docs: r.brokenHighlights.map((x) => x.doc) },
  ]
})

onMounted(load)
</script>

<template>
  <div class="flex-1 min-h-0 overflow-y-auto">
    <div class="max-w-xl mx-auto px-4 py-5 flex flex-col gap-4">
      <div class="flex items-center justify-between text-xs text-zinc-500">
        <span class="flex items-center gap-1.5"><HeartPulse class="w-4 h-4 text-rose-400" />知识库体检</span>
        <UButton size="sm" variant="ghost" :disabled="loading" @click="load">
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" />
        </UButton>
      </div>

      <template v-if="report && score">
        <!-- Score gauge -->
        <div class="bg-white border border-zinc-200 rounded-2xl p-4 flex items-center gap-4 soft-shadow">
          <div class="relative w-16 h-16 shrink-0">
            <svg viewBox="0 0 36 36" class="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f4f4f5" stroke-width="3.5" />
              <circle
                cx="18" cy="18" r="15.5" fill="none" stroke-linecap="round" stroke-width="3.5"
                :stroke="score.score >= 85 ? '#10b981' : score.score >= 60 ? '#6366f1' : '#f59e0b'"
                :stroke-dasharray="97.4"
                :stroke-dashoffset="97.4 * (1 - score.score / 100)"
              />
            </svg>
            <div class="absolute inset-0 flex items-center justify-center text-[15px] font-bold" :class="score.score >= 85 ? 'text-emerald-500' : score.score >= 60 ? 'text-brand' : 'text-amber-500'">
              {{ score.score }}
            </div>
          </div>
          <div class="flex-1">
            <div class="text-[14px] font-semibold text-zinc-800">{{ score.label }} · 共 {{ report.totalDocs }} 篇</div>
            <div class="text-[11px] text-zinc-400 mt-0.5">空壳与重复文档权重最高；数字越接近 100 越健康</div>
          </div>
          <UButton size="sm" variant="secondary" :disabled="scanning" @click="scanLinks">
            <Globe class="w-3.5 h-3.5" :class="{ 'animate-spin': scanning }" />
            {{ scanning ? `扫描中 ${scanProgress}` : '扫死链' }}
          </UButton>
        </div>

        <!-- Dead links -->
        <div v-if="deadLinks.length" class="bg-amber-50/60 border border-amber-200 rounded-xl p-3">
          <div class="text-[12px] text-amber-700 font-medium mb-1.5">死链（{{ deadLinks.length }}）</div>
          <div v-for="l in deadLinks" :key="l.docId" class="text-[11px] text-amber-600 truncate">
            {{ l.status ? `HTTP ${l.status}` : l.error }} — {{ l.title }}
          </div>
        </div>

        <!-- Sections -->
        <div v-for="section in sections" :key="section.key" class="bg-white border border-zinc-200 rounded-xl p-3">
          <div class="flex items-center gap-2 mb-1">
            <component :is="section.icon" class="w-3.5 h-3.5 text-zinc-400" />
            <span class="text-[12.5px] font-medium text-zinc-800">{{ section.label }}</span>
            <span class="text-[11px]" :class="section.count > 0 ? 'text-amber-600' : 'text-emerald-500'">{{ section.count }}</span>
            <button
              v-if="section.action"
              class="ml-auto text-[10px] px-1.5 py-0.5 rounded border border-zinc-200 text-zinc-400 hover:text-red-500 hover:border-red-200 transition-colors"
              @click="section.action.run()"
            >{{ section.action.label }}</button>
          </div>
          <div class="text-[10px] text-zinc-400 mb-1.5">{{ section.hint }}</div>

          <div v-if="section.docs?.length" class="flex flex-col gap-0.5">
            <button
              v-for="d in section.docs.slice(0, 5)"
              :key="d.id"
              class="text-left text-[11px] text-zinc-500 hover:text-brand truncate"
              @click="openDoc(d)"
            >· {{ d.title || '(无标题)' }}</button>
            <span v-if="section.docs.length > 5" class="text-[10px] text-zinc-300">…共 {{ section.docs.length }} 项</span>
          </div>

          <div v-if="section.pairs?.length" class="flex flex-col gap-1">
            <div v-for="(pair, i) in section.pairs.slice(0, 5)" :key="i" class="flex items-center gap-2">
              <span class="text-[11px] text-zinc-500 truncate flex-1" :title="pair.a.title">
                {{ pair.a.title || '(无标题)' }} ({{ pair.a.wordCount }}词) ↔ {{ pair.b.title || '(无标题)' }} ({{ pair.b.wordCount }}词)
              </span>
              <button class="text-[10px] text-zinc-400 hover:text-red-500 shrink-0" @click="removeDuplicate(pair)">删除较短的</button>
            </div>
          </div>
        </div>
      </template>

      <UEmptyState v-else-if="!loading" title="还没有文档" description="剪藏一些内容后再来体检。" />
    </div>
  </div>
</template>
