<script lang="ts" setup>
import dayjs from 'dayjs'
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { ListChecks, Trash2, FolderPlus, Download, Zap } from '@lucide/vue'
import { useAppStore } from '@/stores/app.store'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { useDocumentStore } from '@/stores/document.store'
import { useChatStore } from '@/stores/chat.store'
import { useCollectionStore } from '@/stores/collection.store'
import { searchDocuments } from '@/services/search'
import { ChatRepository } from '@/db/repositories/chat.repository'
import type { DocumentEntity } from '@/types/document'
import type { LibrarySortKey } from '@/types/document'
import { getReadStatus } from '@/types/document'
import SearchBar from '@/components/library/SearchBar.vue'
import { exportDocumentsToZip, downloadBlob } from '@/utils/export'
import DocumentItem from '@/components/library/DocumentItem.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import Select from '@/components/ui/Select.vue'
import Heatmap from './Heatmap.vue'
import CollectionDialog from './CollectionDialog.vue'
import CollectionPickerDialog from './CollectionPickerDialog.vue'
import BatchAnalysisDialog from './BatchAnalysisDialog.vue'

const appStore = useAppStore()
const workspaceStore = useWorkspaceStore()
const documentStore = useDocumentStore()
const chatStore = useChatStore()
const collectionStore = useCollectionStore()

const searchQuery = ref('')
const showDeleteConfirm = ref(false)
const deleteTargetId = ref<string | undefined>(undefined)
const deleteTargetName = ref('')
const selectedDate = ref<string | null>(null)
const statusFilter = ref<'all' | 'unread' | 'reading' | 'read' | 'conversation'>('all')
const siteFilter = ref<string | null>(null)
const tagFilter = ref<string | null>(null)
const conversationDocIds = ref<Set<string>>(new Set())

// ── Multi-select mode ──
const multiSelectActive = ref(false)
const showBatchDeleteConfirm = ref(false)

function enterMultiSelect() {
  multiSelectActive.value = true
}

function exitMultiSelect() {
  multiSelectActive.value = false
  documentStore.clearSelection()
}

function handleSelectAll() {
  documentStore.selectAll(displayedDocs.value.map((d) => d.id))
}

async function handleBatchDelete() {
  if (documentStore.selectedIds.size === 0) return
  showBatchDeleteConfirm.value = true
}

async function confirmBatchDelete() {
  showBatchDeleteConfirm.value = false
  await documentStore.deleteSelectedDocuments()
  await loadConversationIndex()
  multiSelectActive.value = false
}

function handleBatchExport() {
  if (documentStore.selectedIds.size === 0) return
  const ids = [...documentStore.selectedIds]
  const byId = new Map(documentStore.documents.map((d) => [d.id, d]))
  const docs = ids.map((id) => byId.get(id)).filter((d): d is DocumentEntity => !!d)
  if (!docs.length) return
  const blob = exportDocumentsToZip(docs)
  const date = dayjs().toISOString().slice(0, 10)
  downloadBlob(blob, `auramind-export-${date}.zip`)
  appStore.showToast(`已导出 ${docs.length} 篇文档`, 'success')
}

// ── Batch AI analysis ──
const showBatchAnalysis = ref(false)

function openBatchAnalysis() {
  if (documentStore.selectedIds.size === 0) return
  showBatchAnalysis.value = true
}

// ── Batch add to collection ──
const showBatchPicker = ref(false)

function openBatchPicker() {
  if (documentStore.selectedIds.size === 0) return
  showBatchPicker.value = true
}

function batchPickerCreate() {
  // Save selected IDs before closing for create flow
  pendingBatchDocIds.value = [...documentStore.selectedIds]
  showBatchPicker.value = false
  openCreateCollection()
}

// When creating collection from batch picker, track pending IDs
const pendingBatchDocIds = ref<string[] | null>(null)
const pendingPickerDocId = ref<string | null>(null)

const dateKey = (date: dayjs.ConfigType) => dayjs(date).format('YYYY-MM-DD')
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

const unreadCount = computed(() => documentStore.documents.filter((d) => getReadStatus(d) === 'unread').length)
const readingCount = computed(() => documentStore.documents.filter((d) => getReadStatus(d) === 'reading').length)
const readCount = computed(() => documentStore.documents.filter((d) => getReadStatus(d) === 'read').length)

const statusOptions = computed(() => [
  { value: 'all' as const, label: `全部 ${documentStore.documents.length}` },
  { value: 'unread' as const, label: `未读 ${unreadCount.value}` },
  { value: 'reading' as const, label: `阅读中 ${readingCount.value}` },
  { value: 'read' as const, label: `已读 ${readCount.value}` },
  { value: 'conversation' as const, label: `有对话 ${conversationDocIds.value.size}` },
])

const sortOptions: { value: LibrarySortKey; label: string }[] = [
  { value: 'viewed', label: '最近查看' },
  { value: 'captured', label: '最近捕获' },
  { value: 'updated', label: '最近更新' },
  { value: 'title', label: '标题' },
]

function ts(s?: string): number {
  return s ? dayjs(s).valueOf() : 0
}

function sortDocs(docs: DocumentEntity[]): DocumentEntity[] {
  const arr = [...docs]
  switch (documentStore.librarySortKey) {
    case 'captured':
      return arr.sort((a, b) => ts(b.capturedAt) - ts(a.capturedAt))
    case 'updated':
      return arr.sort((a, b) => ts(b.updatedAt) - ts(a.updatedAt))
    case 'title':
      return arr.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    case 'viewed':
    default:
      // Never-opened docs fall back to capturedAt so the list stays coherent.
      return arr.sort((a, b) => ts(b.lastOpenedAt ?? b.capturedAt) - ts(a.lastOpenedAt ?? a.capturedAt))
  }
}

function setSort(key: string) {
  documentStore.setLibrarySortKey(key as LibrarySortKey)
}

const hasActiveFilter = computed(
  () =>
    !!selectedDate.value ||
    !!searchQuery.value.trim() ||
    statusFilter.value !== 'all' ||
    !!siteFilter.value ||
    !!tagFilter.value ||
    !!collectionStore.selectedCollectionId,
)

const displayedDocs = computed(() => {
  let docs: DocumentEntity[]
  let preserveOrder = false

  // When a collection is selected, restrict to its docs and keep reading order.
  if (collectionStore.selectedCollectionId) {
    const byId = new Map(documentStore.documents.map((d) => [d.id, d]))
    docs = collectionStore.selectedDocIds
      .map((id) => byId.get(id))
      .filter((d): d is DocumentEntity => !!d)
    preserveOrder = true
  } else {
    docs = documentStore.documents
  }

  docs = docs.filter((d) => {
    if (selectedDate.value && dateKey(d.capturedAt) !== selectedDate.value) return false
    if (siteFilter.value && getSite(d) !== siteFilter.value) return false
    if (tagFilter.value && !(d.tags || []).includes(tagFilter.value)) return false
    if (statusFilter.value === 'unread' && getReadStatus(d) !== 'unread') return false
    if (statusFilter.value === 'reading' && getReadStatus(d) !== 'reading') return false
    if (statusFilter.value === 'read' && getReadStatus(d) !== 'read') return false
    if (statusFilter.value === 'conversation' && !conversationDocIds.value.has(d.id)) return false
    return true
  })

  let filtered = docs
  if (searchQuery.value.trim()) {
    const results = searchDocuments(searchQuery.value)
    const idSet = new Set(results.map((r) => r.id))
    filtered = docs.filter((d) => idSet.has(d.id))
  }

  if (!preserveOrder) {
    filtered = sortDocs(filtered)
  }
  return filtered
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
  collectionStore.loadCollections()
  nextTick(setupLoadMore)
})

watch(
  () => documentStore.documents.length,
  () => {
    loadConversationIndex()
  },
)

// Incremental render: bound DOM nodes by rendering PAGE_SIZE at a time,
// appending as the user nears the bottom. Avoids windowing jitter on
// variable-height cards; enough to scale to thousands of captures.
const PAGE_SIZE = 20
const visibleCount = ref(PAGE_SIZE)
const scrollRootRef = ref<HTMLElement | null>(null)
const sentinelRef = ref<HTMLElement | null>(null)
let loadMoreObserver: IntersectionObserver | null = null

const pagedDocs = computed(() => displayedDocs.value.slice(0, visibleCount.value))
const hasMore = computed(() => visibleCount.value < displayedDocs.value.length)

function setupLoadMore() {
  loadMoreObserver?.disconnect()
  if (!sentinelRef.value || !scrollRootRef.value) return
  loadMoreObserver = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && hasMore.value) {
        visibleCount.value += PAGE_SIZE
      }
    },
    { root: scrollRootRef.value, rootMargin: '240px' },
  )
  loadMoreObserver.observe(sentinelRef.value)
}

// Reset paging whenever the filtered set changes (filter toggle / search / delete).
watch(displayedDocs, () => {
  visibleCount.value = PAGE_SIZE
  nextTick(setupLoadMore)
})

onUnmounted(() => {
  loadMoreObserver?.disconnect()
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

// ── Collections ──
const showCollectionDialog = ref(false)
const collectionDialogMode = ref<'create' | 'rename'>('create')
const renameTargetId = ref<string | undefined>(undefined)
const showPicker = ref(false)
const pickerDocumentId = ref<string | null>(null)
const pickerDocumentTitle = ref('')
const showDeleteCollectionConfirm = ref(false)
const deleteCollectionTargetId = ref<string | undefined>(undefined)

function openCreateCollection() {
  collectionDialogMode.value = 'create'
  renameTargetId.value = undefined
  showCollectionDialog.value = true
}

function openRenameCollection() {
  if (!collectionStore.selectedCollection) return
  collectionDialogMode.value = 'rename'
  renameTargetId.value = collectionStore.selectedCollection.id
  showCollectionDialog.value = true
}

async function submitCollection(name: string, description: string) {
  let created
  if (collectionDialogMode.value === 'create') {
    created = await collectionStore.createCollection(name, description)
  } else if (renameTargetId.value) {
    await collectionStore.renameCollection(renameTargetId.value, name)
  }
  showCollectionDialog.value = false

  // Launched from the batch picker: add all pending docs to the new collection, then reopen.
  if (created && pendingBatchDocIds.value) {
    for (const docId of pendingBatchDocIds.value) {
      await collectionStore.addDocument(created.id, docId)
    }
    pendingBatchDocIds.value = null
    showBatchPicker.value = true
  }
  // Launched from single picker: add the pending doc, then reopen.
  else if (created && pendingPickerDocId.value) {
    await collectionStore.addDocument(created.id, pendingPickerDocId.value)
    pickerDocumentId.value = pendingPickerDocId.value
    pendingPickerDocId.value = null
    showPicker.value = true
  }
}

function requestDeleteCollection() {
  if (!collectionStore.selectedCollection) return
  deleteCollectionTargetId.value = collectionStore.selectedCollection.id
  showDeleteCollectionConfirm.value = true
}

async function confirmDeleteCollection() {
  if (!deleteCollectionTargetId.value) return
  await collectionStore.deleteCollection(deleteCollectionTargetId.value)
  showDeleteCollectionConfirm.value = false
  deleteCollectionTargetId.value = undefined
}

function openPicker(doc: DocumentEntity) {
  pickerDocumentId.value = doc.id
  pickerDocumentTitle.value = doc.title || ''
  showPicker.value = true
}

// "新建合集" launched from inside the picker: close picker, open create dialog,
// keep the target doc so we can add it after creation.
function pickerCreateCollection() {
  pendingPickerDocId.value = pickerDocumentId.value
  showPicker.value = false
  openCreateCollection()
}

async function handleAddToCollection(doc: DocumentEntity) {
  await collectionStore.loadCollections()
  openPicker(doc)
}

async function handleDocumentClick(doc: DocumentEntity) {
  await documentStore.loadDocument(doc.id)
  documentStore.markOpened(doc.id)
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
  documentStore.markOpened(doc.id)
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
  <div class="flex-1 min-h-0 flex-col bg-surface flex">
    <div ref="scrollRootRef" class="flex-1 min-h-0 overflow-y-auto">
      <!-- Search -->
      <div class="sticky top-0 z-10 p-4 pb-3 bg-surface/95 backdrop-blur-md border-b border-zinc-100">
        <SearchBar v-model="searchQuery" @search="onSearch" />
      </div>

      <!-- Multi-select toolbar -->
      <div
        v-if="multiSelectActive"
        class="sticky top-[69px] z-10 px-4 py-2 bg-brand/5 backdrop-blur-md border-b border-brand/10 flex items-center justify-between"
      >
        <div class="flex items-center gap-3 text-[12px]">
          <span class="font-semibold text-brand">已选 {{ documentStore.selectedIds.size }} 项</span>
          <button class="text-brand hover:text-brand/80 font-medium" @click="handleSelectAll">全选</button>
          <span class="text-zinc-300">|</span>
          <span class="text-zinc-400">{{ displayedDocs.length }} 项可见</span>
        </div>
        <button class="text-[11px] text-zinc-500 hover:text-zinc-700 font-medium" @click="exitMultiSelect">取消</button>
      </div>

      <!-- Heatmap -->
      <Heatmap :selected-key="selectedDate" @select="onHeatmapSelect" />

      <!-- Collections -->
      <div class="px-4 border-b border-zinc-100">
        <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            class="shrink-0 inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[11px] text-zinc-500 border border-dashed border-zinc-300 hover:border-brand hover:text-brand transition-colors"
            @click="openCreateCollection"
          >
            + 新建合集
          </button>
          <button
            v-for="c in collectionStore.collections"
            :key="c.id"
            class="shrink-0 px-2 py-1 rounded-md text-[11px] transition-colors max-w-[160px]"
            :class="collectionStore.selectedCollectionId === c.id ? 'bg-brand text-white font-medium' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'"
            :title="c.name"
            @click="collectionStore.selectCollection(c.id)"
          >
            <span class="truncate">{{ c.name }}</span>
            <span class="opacity-60 ml-1">{{ collectionStore.counts[c.id] ?? 0 }}</span>
          </button>
        </div>

        <!-- Selected collection manage bar -->
        <div
          v-if="collectionStore.selectedCollection"
          class="mt-2 flex items-center justify-between bg-brand/5 border border-brand/10 rounded-lg px-2.5 py-1.5"
        >
          <span class="text-[11px] text-brand font-medium truncate">
            {{ collectionStore.selectedCollection.name }} · {{ collectionStore.selectedDocIds.length }} 篇
          </span>
          <span class="flex items-center gap-2 shrink-0 text-[11px]">
            <button class="text-brand hover:text-brand/80" @click="openRenameCollection">重命名</button>
            <button class="text-red-500 hover:text-red-700" @click="requestDeleteCollection">删除</button>
            <button class="text-zinc-400 hover:text-zinc-600" @click="collectionStore.clearSelection()">取消</button>
          </span>
        </div>
      </div>

      <!-- Facets -->
      <div v-if="documentStore.documents.length" class="px-4 py-2.5 border-b border-zinc-100 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <div class="inline-flex bg-zinc-100 rounded-lg p-0.5 text-[11px]">
            <button
              v-for="opt in statusOptions"
              :key="opt.value"
              class="px-2 py-1 rounded-md transition-colors"
              :class="statusFilter === opt.value ? 'bg-white shadow-sm text-zinc-800 font-medium' : 'text-zinc-500 hover:text-zinc-700'"
              @click="statusFilter = opt.value"
            >{{ opt.label }}</button>
            <button
              v-if="!multiSelectActive && documentStore.documents.length"
              class="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-zinc-500 border border-zinc-200 hover:border-brand hover:text-brand transition-colors"
              @click="enterMultiSelect"
            >
              <ListChecks class="w-3 h-3" />选择
            </button>
          </div>

          <div class="w-[85px] shrink-0">
            <Select
              :model-value="documentStore.librarySortKey"
              :options="sortOptions"
              @update:model-value="setSort"
            />
          </div>
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
          class="mx-2 mb-2 flex items-center justify-between bg-brand/5 border border-brand/10 rounded-lg px-2.5 py-1.5"
        >
          <span class="text-[11px] text-brand font-medium">
            {{ formatDateLabel(selectedDate) }} · {{ displayedDocs.length }} 篇
          </span>
          <button
            class="text-[11px] text-emerald-600 hover:text-emerald-800 flex items-center gap-0.5"
            @click="clearDateFilter"
          >
            清除筛选 ×
          </button>
        </div>

        <div class="px-2 pt-2 pb-1 text-[11px] font-medium text-zinc-400">
          {{ selectedDate ? formatDateLabel(selectedDate) : searchQuery ? '搜索结果' : hasActiveFilter ? `筛选 · ${displayedDocs.length} 篇` : '最近捕获' }}
        </div>

        <DocumentItem
          v-for="doc in pagedDocs"
          :key="doc.id"
          :document="doc"
          :has-conversation="conversationDocIds.has(doc.id)"
          :selection-mode="multiSelectActive"
          :selected="documentStore.selectedIds.has(doc.id)"
          @select="handleDocumentClick"
          @chat="handleChatClick"
          @open-url="handleOpenUrl"
          @delete="requestDelete"
          @add-to-collection="handleAddToCollection"
          @toggle-select="documentStore.toggleSelection($event.id)"
        />

        <div v-if="hasMore" ref="sentinelRef" class="flex items-center justify-center py-3 text-[11px] text-zinc-400">
          加载更多…
        </div>

        <div v-else-if="displayedDocs.length > PAGE_SIZE" class="flex items-center justify-center py-3 text-[11px] text-zinc-300">
          没有更多了
        </div>

        <div v-if="displayedDocs.length === 0" class="text-center py-8 text-[13px] text-zinc-400">
          {{ selectedDate ? `${formatDateLabel(selectedDate)} 没有捕获` : (hasActiveFilter ? '没有匹配的文档' : '暂无捕获的文档') }}
        </div>
      </div>
    </div>

    <!-- Batch action bar -->
    <div
      v-if="multiSelectActive"
      class="flex items-center justify-center gap-3 px-4 py-3 border-t border-zinc-200 bg-white/95 backdrop-blur-md"
    >
      <button
        class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        :disabled="documentStore.selectedIds.size === 0"
        @click="handleBatchDelete"
      >
        <Trash2 class="w-4 h-4" />批量删除
      </button>
      <button
        class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold text-brand bg-brand/10 border border-brand/20 hover:bg-brand/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        :disabled="documentStore.selectedIds.size === 0"
        @click="openBatchPicker"
      >
        <FolderPlus class="w-4 h-4" />批量加入合集
      </button>
      <button
        class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold text-zinc-700 bg-zinc-100 border border-zinc-200 hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        :disabled="documentStore.selectedIds.size === 0"
        @click="handleBatchExport"
      >
        <Download class="w-4 h-4" />导出 Markdown
      </button>
      <button
        class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold text-white bg-brand hover:bg-brand/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        :disabled="documentStore.selectedIds.size === 0"
        @click="openBatchAnalysis"
      >
        <Zap class="w-4 h-4" />批量分析
      </button>
    </div>

    <!-- Delete Confirm -->
    <ConfirmModal
      v-if="showDeleteConfirm"
      title="删除文档"
      :desc="`确定删除文档「${deleteTargetName}」吗？关联的对话记录也将被删除。此操作不可撤销。`"
      confirm-text="删除"
      danger
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />

    <!-- Collection Delete Confirm -->
    <ConfirmModal
      v-if="showDeleteCollectionConfirm"
      title="删除合集"
      desc="确定删除这个合集吗？合集内的文档不会被删除，只是移出合集。此操作不可撤销。"
      confirm-text="删除"
      danger
      @confirm="confirmDeleteCollection"
      @cancel="showDeleteCollectionConfirm = false"
    />

    <!-- Collection Create / Rename -->
    <CollectionDialog
      :open="showCollectionDialog"
      :mode="collectionDialogMode"
      :initial-name="collectionDialogMode === 'rename' ? (collectionStore.selectedCollection?.name ?? '') : ''"
      @close="showCollectionDialog = false"
      @submit="submitCollection"
    />

    <!-- Add to Collection Picker -->
    <CollectionPickerDialog
      :open="showPicker"
      :document-id="pickerDocumentId"
      :document-title="pickerDocumentTitle"
      @close="showPicker = false"
      @create="pickerCreateCollection"
    />

    <!-- Batch Delete Confirm -->
    <ConfirmModal
      v-if="showBatchDeleteConfirm"
      title="批量删除"
      :desc="`确定删除 ${documentStore.selectedIds.size} 篇文档吗？关联的对话记录也将被删除。此操作不可撤销。`"
      confirm-text="删除"
      danger
      @confirm="confirmBatchDelete"
      @cancel="showBatchDeleteConfirm = false"
    />

    <!-- Batch Add to Collection Picker -->
    <CollectionPickerDialog
      :open="showBatchPicker"
      :document-id="null"
      :document-ids="[...documentStore.selectedIds]"
      @close="showBatchPicker = false"
      @create="batchPickerCreate"
    />

    <!-- Batch AI Analysis Dialog -->
    <BatchAnalysisDialog
      :open="showBatchAnalysis"
      :document-count="documentStore.selectedIds.size"
      :document-ids="[...documentStore.selectedIds]"
      @close="showBatchAnalysis = false"
    />
  </div>
</template>
