<script lang="ts">
export default { name: 'InsightsView' }
</script>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { BarChart3, RefreshCw, BookOpen, Type, GraduationCap, Flame, Sparkles } from '@lucide/vue'
import UButton from '@/components/ui/UButton.vue'
import UEmptyState from '@/components/ui/UEmptyState.vue'
import { DocumentRepository } from '@/db/repositories/document.repository'
import { MetaRepository } from '@/db/repositories/meta.repository'
import { computeInsights, type Insights } from '@/utils/insights'
import { computeTopics, type TopicCluster } from '@/services/search/clusters'
import { useDocumentStore } from '@/stores/document.store'
import { useChatStore } from '@/stores/chat.store'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { useAppStore } from '@/stores/app.store'
import type { ReviewLog } from '@/utils/review-stats'
import type { DocumentEntity } from '@/types/document'

const loading = ref(false)
const insights = ref<Insights | null>(null)
const docs = ref<DocumentEntity[]>([])

// ── Topic clusters (needs the semantic index) ──
const topics = ref<TopicCluster[] | null>(null)
const topicsNote = ref('')
const topicsLoading = ref(false)
const documentStore = useDocumentStore()
const chatStore = useChatStore()
const workspaceStore = useWorkspaceStore()
const appStore = useAppStore()

async function loadTopics() {
  topicsLoading.value = true
  try {
    const result = await computeTopics()
    topics.value = result.clusters
    topicsNote.value = result.notReady ?? ''
  } finally {
    topicsLoading.value = false
  }
}

async function openTopicDoc(doc: DocumentEntity) {
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

const savingCollection = ref(false)

/** Persist one topic cluster as a collection. */
async function saveTopicAsCollection(cluster: TopicCluster) {
  if (savingCollection.value) return
  savingCollection.value = true
  try {
    const { useCollectionStore } = await import('@/stores/collection.store')
    const collectionStore = useCollectionStore()
    const created = await collectionStore.createCollection(cluster.name)
    for (const doc of cluster.docs) {
      await collectionStore.addDocument(created.id, doc.id)
    }
    await collectionStore.loadCollections()
    appStore.showToast(`已创建合集「${cluster.name}」（${cluster.docs.length} 篇）`, 'success')
  } catch (e: any) {
    appStore.showToast(e?.message || '创建合集失败', 'error')
  } finally {
    savingCollection.value = false
  }
}

const maxDay = computed(() => Math.max(1, ...(insights.value?.capturesByDay.map((d) => d.count) ?? [1])))

const statCards = computed(() => {
  if (!insights.value) return []
  return [
    { icon: BookOpen, label: '本周剪藏', value: String(insights.value.weekCaptures), sub: `累计 ${insights.value.totalDocs} 篇` },
    { icon: Type, label: '本周词数', value: insights.value.weekWords >= 10000 ? `${(insights.value.weekWords / 10000).toFixed(1)}万` : String(insights.value.weekWords), sub: `累计 ${(insights.value.totalWords / 10000).toFixed(1)}万` },
    { icon: GraduationCap, label: '本周复习', value: String(insights.value.weekReviews), sub: `累计 ${insights.value.totalReviews} 张` },
    { icon: Flame, label: '最长连续', value: `${insights.value.bestStreak} 天`, sub: '历史最佳' },
  ]
})

async function load() {
  loading.value = true
  try {
    docs.value = await DocumentRepository.findAll()
    const reviewLog = (await MetaRepository.get<ReviewLog>('review-log')) ?? {}
    insights.value = computeInsights(docs.value, reviewLog)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
  loadTopics()
})
</script>

<template>
  <div class="flex-1 min-h-0 overflow-y-auto">
    <div class="max-w-xl mx-auto px-4 py-5 flex flex-col gap-4">
      <div class="flex items-center justify-between text-xs text-zinc-500">
        <span class="flex items-center gap-1.5"><BarChart3 class="w-4 h-4 text-brand" />知识库洞察</span>
        <UButton size="sm" variant="ghost" :disabled="loading" @click="load">
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" />
        </UButton>
      </div>

      <template v-if="insights && insights.totalDocs > 0">
        <!-- Stat cards -->
        <div class="grid grid-cols-2 gap-2">
          <div
            v-for="card in statCards"
            :key="card.label"
            class="bg-white border border-zinc-200 rounded-xl p-3 flex flex-col gap-1"
          >
            <div class="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <component :is="card.icon" class="w-3 h-3" />
              {{ card.label }}
            </div>
            <div class="text-lg font-semibold text-zinc-800">{{ card.value }}</div>
            <div class="text-[10px] text-zinc-400">{{ card.sub }}</div>
          </div>
        </div>

        <!-- 14-day capture bars -->
        <div class="bg-white border border-zinc-200 rounded-xl p-3">
          <div class="text-[11px] text-zinc-400 mb-2">近 14 天剪藏</div>
          <div class="flex items-end gap-1 h-20">
            <div
              v-for="day in insights.capturesByDay"
              :key="day.date"
              class="flex-1 rounded-t transition-all"
              :class="day.count > 0 ? 'bg-brand/70' : 'bg-zinc-100'"
              :style="{ height: `${Math.max(4, (day.count / maxDay) * 100)}%` }"
              :title="`${day.date}：${day.count} 篇`"
            />
          </div>
          <div class="flex justify-between text-[9px] text-zinc-400 mt-1">
            <span>{{ insights.capturesByDay[0]?.date.slice(5) }}</span>
            <span>{{ insights.capturesByDay[13]?.date.slice(5) }}</span>
          </div>
        </div>

        <!-- Topic clusters -->
        <div class="bg-white border border-zinc-200 rounded-xl p-3">
          <div class="flex items-center justify-between mb-2">
            <div class="text-[11px] text-zinc-400 flex items-center gap-1">
              <Sparkles class="w-3 h-3 text-brand/70" />自动主题（语义聚类 + AI 命名）
            </div>
            <UButton size="sm" variant="ghost" :disabled="topicsLoading" @click="loadTopics">
              <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': topicsLoading }" />
            </UButton>
          </div>
          <div v-if="topicsLoading" class="text-[11px] text-zinc-400 py-3 text-center">聚类中…</div>
          <div v-else-if="topicsNote" class="text-[11px] text-zinc-400 py-2">{{ topicsNote }}</div>
          <div v-else-if="topics?.length" class="flex flex-col gap-2">
            <div v-for="(cluster, ci) in topics" :key="ci" class="border border-zinc-100 rounded-lg p-2">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-[12px] font-medium text-brand">{{ cluster.name }}</span>
                <span class="text-[10px] text-zinc-400">{{ cluster.docs.length }} 篇</span>
                <button
                  class="ml-auto text-[10px] px-1.5 py-0.5 rounded border border-zinc-200 text-zinc-400 hover:text-brand hover:border-brand/30 transition-colors"
                  :disabled="savingCollection"
                  title="把这个主题保存为合集"
                  @click="saveTopicAsCollection(cluster)"
                >存为合集</button>
              </div>
              <div class="flex flex-wrap gap-1">
                <button
                  v-for="d in cluster.docs.slice(0, 4)"
                  :key="d.id"
                  class="text-[11px] text-zinc-500 hover:text-brand bg-zinc-50 hover:bg-brand/5 rounded px-1.5 py-0.5 max-w-40 truncate"
                  :title="d.title"
                  @click="openTopicDoc(d)"
                >{{ d.title || '(无标题)' }}</button>
                <span v-if="cluster.docs.length > 4" class="text-[10px] text-zinc-300 self-center">+{{ cluster.docs.length - 4 }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Top tags & sites -->
        <div class="grid grid-cols-2 gap-2">
          <div class="bg-white border border-zinc-200 rounded-xl p-3">
            <div class="text-[11px] text-zinc-400 mb-2">活跃标签</div>
            <div class="flex flex-col gap-1.5">
              <div v-for="tag in insights.topTags" :key="tag.name" class="flex items-center gap-2">
                <span class="text-[11px] text-zinc-600 truncate flex-1">{{ tag.name }}</span>
                <div class="w-16 h-1.5 bg-zinc-100 rounded-full overflow-hidden shrink-0">
                  <div class="h-full bg-brand/60 rounded-full" :style="{ width: `${(tag.count / insights.topTags[0].count) * 100}%` }" />
                </div>
                <span class="text-[10px] text-zinc-400 w-5 text-right shrink-0">{{ tag.count }}</span>
              </div>
              <div v-if="insights.topTags.length === 0" class="text-[11px] text-zinc-400">还没有标签</div>
            </div>
          </div>
          <div class="bg-white border border-zinc-200 rounded-xl p-3">
            <div class="text-[11px] text-zinc-400 mb-2">主要来源</div>
            <div class="flex flex-col gap-1.5">
              <div v-for="site in insights.topSites" :key="site.name" class="flex items-center gap-2">
                <span class="text-[11px] text-zinc-600 truncate flex-1">{{ site.name }}</span>
                <div class="w-16 h-1.5 bg-zinc-100 rounded-full overflow-hidden shrink-0">
                  <div class="h-full bg-emerald-400/70 rounded-full" :style="{ width: `${(site.count / insights.topSites[0].count) * 100}%` }" />
                </div>
                <span class="text-[10px] text-zinc-400 w-5 text-right shrink-0">{{ site.count }}</span>
              </div>
              <div v-if="insights.topSites.length === 0" class="text-[11px] text-zinc-400">还没有来源</div>
            </div>
          </div>
        </div>
      </template>

      <UEmptyState
        v-else-if="!loading"
        title="还没有数据"
        description="剪藏几篇文章、复习几张卡片之后，这里会展示你的阅读洞察。"
      />
    </div>
  </div>
</template>
