<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useAppStore } from '@/stores/app.store'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { useDocumentStore } from '@/stores/document.store'
import { useChatStore } from '@/stores/chat.store'
import { searchDocuments } from '@/services/search'
import { ChatRepository } from '@/db/repositories/chat.repository'
import type { DocumentEntity } from '@/types/document'
import SearchBar from '@/components/library/SearchBar.vue'
import DocumentItem from '@/components/library/DocumentItem.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import Heatmap from './Heatmap.vue'

const appStore = useAppStore()
const workspaceStore = useWorkspaceStore()
const documentStore = useDocumentStore()
const chatStore = useChatStore()

const searchQuery = ref('')
const showDeleteConfirm = ref(false)
const deleteTargetId = ref<string | undefined>(undefined)
const deleteTargetName = ref('')
const selectedDate = ref<string | null>(null)
const statusFilter = ref<'all' | 'unread' | 'conversation'>('all')
const siteFilter = ref<string | null>(null)
const tagFilter = ref<string | null>(null)
const conversationDocIds = ref<Set<string>>(new Set())

function pad(n: number) {
  return String(n).padStart(2, '0')
}
function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function formatDateLabel(key: string) {
  const [, m, d] = key.split('-')
  return `${Number(m)}月${Number(d)}日`
}
function getSite(doc: DocumentEntity): string {
  if (doc.siteName) return doc.siteName
  try {
    return new URL(doc.url).hostname
  } catch {
    return doc.url
  }
}

const sites = computed(() => {
  const counts = new Map<string, number>()
  for (const d of documentStore.documents) {
    const s = getSite(d)
    if (!s) continue
    counts.set(s, (counts.get(s) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([site, count]) => ({ site, count }))
})

const tags = computed(() => {
  const counts = new Map<string, number>()
  for (const d of documentStore.documents) {
    for (const t of d.tags || []) counts.set(t, (counts.get(t) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([tag, count]) => ({ tag, count }))
})

const unreadCount = computed(() => documentStore.documents.filter((d) => !d.lastOpenedAt).length)

const statusOptions = computed(() => [
  { value: 'all' as const, label: `全部 ${documentStore.documents.length}` },
  { value: 'unread' as const, label: `未读 ${unreadCount.value}` },
  { value: 'conversation' as const, label: `有对话 ${conversationDocIds.value.size}` },
])

const hasActiveFilter = computed(
  () =>
    !!selectedDate.value ||
    !!searchQuery.value.trim() ||
    statusFilter.value !== 'all' ||
    !!siteFilter.value ||
    !!tagFilter.value,
)

const displayedDocs = computed(() => {
  const docs = documentStore.documents.filter((d) => {
    if (selectedDate.value && dateKey(new Date(d.capturedAt)) !== selectedDate.value) return false
    if (siteFilter.value && getSite(d) !== siteFilter.value) return false
    if (tagFilter.value && !(d.tags || []).includes(tagFilter.value)) return false
    if (statusFilter.value === 'unread' && d.lastOpenedAt) return false
    if (statusFilter.value === 'conversation' && !conversationDocIds.value.has(d.id)) return false
    return true
  })

  let filtered = docs
  if (searchQuery.value.trim()) {
    const results = searchDocuments(searchQuery.value)
    const idSet = new Set(results.map((r) => r.id))
    filtered = docs.filter((d) => idSet.has(d.id))
  }

  filtered = filtered.sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())
  return hasActiveFilter.value ? filtered : filtered.slice(0, 20)
})

async function loadConversationIndex() {
  try {
    const convs = await ChatRepository.findAll()
    conversationDocIds.value = new Set(convs.map((c) => c.documentId))
  } catch {
    // non-critical: treat as no conversations
  }
}

onMounted(() => {
  loadConversationIndex()
})

function onSearch(query: string) {
  searchQuery.value = query
}

function onHeatmapSelect(key: string) {
  selectedDate.value = selectedDate.value === key ? null : key
}

function clearDateFilter() {
  selectedDate.value = null
}

async function handleDocumentClick(doc: DocumentEntity) {
  await documentStore.loadDocument(doc.id)
  workspaceStore.setDocumentSource('library')
  try {
    await chatStore.loadConversations(doc.id)
  } catch {
    // Even if DB fails, currentDocumentId is already set; proceed to workspace.
  }
  appStore.setCurrentView('workspace')
}

async function handleChatClick(doc: DocumentEntity) {
  documentStore.setCurrentDocument(doc)
  workspaceStore.setDocumentSource('library')
  try {
    await chatStore.loadConversations(doc.id)
  } catch {
    // currentDocumentId is set synchronously inside loadConversations before any DB call.
  }
  appStore.setCurrentView('workspace')
}

async function handleOpenUrl(doc: DocumentEntity) {
  if (doc.url) {
    await browser.tabs.create({ url: doc.url })
  }
}

function requestDelete(doc: DocumentEntity) {
  deleteTargetId.value = doc.id
  deleteTargetName.value = doc.title || 'Untitled'
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  if (!deleteTargetId.value) return
  const id = deleteTargetId.value

  // Delete associated conversations
  try {
    const convs = await ChatRepository.findByDocumentId(id)
    for (const c of convs) {
      await ChatRepository.delete(c.id)
    }
  } catch {
    // non-critical
  }

  await documentStore.deleteDocument(id)
  await documentStore.refreshDocuments()
  await loadConversationIndex()

  showDeleteConfirm.value = false
  deleteTargetId.value = undefined
}

function cancelDelete() {
  showDeleteConfirm.value = false
  deleteTargetId.value = undefined
}
</script>

<template>
  <div class="flex-1 min-h-0 flex-col bg-[#FCFCFC] flex">
    <div class="flex-1 min-h-0 overflow-y-auto">
      <!-- Search -->
      <div class="sticky top-0 z-10 p-4 pb-3 bg-[#FCFCFC]/95 backdrop-blur-md border-b border-zinc-100">
        <SearchBar v-model="searchQuery" @search="onSearch" />
      </div>

      <!-- Heatmap -->
      <Heatmap :selected-key="selectedDate" @select="onHeatmapSelect" />

      <!-- Facets -->
      <div v-if="documentStore.documents.length" class="px-4 py-2.5 border-b border-zinc-100 space-y-2">
        <div class="inline-flex bg-zinc-100 rounded-lg p-0.5 text-[11px]">
          <button
            v-for="opt in statusOptions"
            :key="opt.value"
            class="px-2 py-1 rounded-md transition-colors"
            :class="statusFilter === opt.value ? 'bg-white shadow-sm text-zinc-800 font-medium' : 'text-zinc-500 hover:text-zinc-700'"
            @click="statusFilter = opt.value"
          >{{ opt.label }}</button>
        </div>

        <div v-if="sites.length > 1" class="flex flex-wrap gap-1">
          <button
            v-for="s in sites"
            :key="s.site"
            class="px-1.5 py-0.5 rounded-md text-[10px] max-w-[150px] truncate transition-colors"
            :class="siteFilter === s.site ? 'bg-brand text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'"
            :title="s.site"
            @click="siteFilter = siteFilter === s.site ? null : s.site"
          >{{ s.site }} <span class="opacity-60">{{ s.count }}</span></button>
        </div>

        <div v-if="tags.length" class="flex flex-wrap gap-1">
          <button
            v-for="t in tags"
            :key="t.tag"
            class="px-1.5 py-0.5 rounded-md text-[10px] transition-colors"
            :class="tagFilter === t.tag ? 'bg-brand text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'"
            @click="tagFilter = tagFilter === t.tag ? null : t.tag"
          >#{{ t.tag }} <span class="opacity-60">{{ t.count }}</span></button>
        </div>
      </div>

      <!-- Documents -->
      <div class="p-2 pb-6">
        <!-- Date filter chip -->
        <div
          v-if="selectedDate"
          class="mx-2 mb-2 flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5"
        >
          <span class="text-[11px] text-emerald-700 font-medium">
            {{ formatDateLabel(selectedDate) }} · {{ displayedDocs.length }} 篇
          </span>
          <button
            class="text-[11px] text-emerald-600 hover:text-emerald-800 flex items-center gap-0.5"
            @click="clearDateFilter"
          >
            清除筛选 ×
          </button>
        </div>

        <div class="px-2 pt-2 pb-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
          {{ selectedDate ? formatDateLabel(selectedDate) : searchQuery ? '搜索结果' : hasActiveFilter ? `筛选 · ${displayedDocs.length} 篇` : '最近捕获' }}
        </div>

        <DocumentItem
          v-for="doc in displayedDocs"
          :key="doc.id"
          :document="doc"
          :has-conversation="conversationDocIds.has(doc.id)"
          @select="handleDocumentClick"
          @chat="handleChatClick"
          @open-url="handleOpenUrl"
          @delete="requestDelete"
        />

        <div v-if="displayedDocs.length === 0" class="text-center py-8 text-[13px] text-zinc-400">
          {{ selectedDate ? `${formatDateLabel(selectedDate)} 没有捕获` : (hasActiveFilter ? '没有匹配的文档' : '暂无捕获的文档') }}
        </div>
      </div>
    </div>

    <!-- Delete Confirm -->
    <ConfirmModal
      v-if="showDeleteConfirm"
      title="删除文档"
      :desc="`确定删除文档「${deleteTargetName}」吗？关联的对话记录也将被删除。此操作不可撤销。`"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>
