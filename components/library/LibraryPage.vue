<script lang="ts" setup>
/**
 * M6 — LibraryPage
 * 历史库全功能管理页：左侧列表 + 域名导航 + 搜索 + 右侧 SnapshotViewer 分屏
 * 在 Options 独立管理页中嵌入
 */
import { ref, computed, onMounted, watch } from 'vue'
import type { ConversationRecord } from '@/lib/db/types'
import { conversationRepo } from '@/lib/db/repositories/conversation.repo'
import { search as workerSearch } from '@/lib/library/search'
import type { SearchResult } from '@/lib/library/search'
import HistoryList from './HistoryList.vue'
import SearchResultList from './SearchResultList.vue'
import SnapshotViewer from './SnapshotViewer.vue'

const selectedConversation = ref<ConversationRecord | null>(null)
const searchQuery = ref('')
const searchResults = ref<SearchResult[]>([])
const searchLoading = ref(false)
const isSearchMode = ref(false)

// Domain navigation
const domains = ref<string[]>([])
const selectedDomain = ref<string | null>(null)

// History list ref for programmatic reload
const historyListRef = ref<InstanceType<typeof HistoryList> | null>(null)

// Batch selection
const batchMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())
const showBatchDeleteModal = ref(false)

onMounted(async () => {
  await loadDomains()
})

async function loadDomains() {
  const all = await conversationRepo.list({ sortBy: 'domain', limit: 2000, offset: 0 })
  const domainSet = new Set(all.map((c) => c.domain).filter(Boolean))
  domains.value = Array.from(domainSet).sort()
}

async function onSearch(q: string) {
  searchQuery.value = q
  if (!q.trim()) {
    isSearchMode.value = false
    searchResults.value = []
    return
  }
  isSearchMode.value = true
  searchLoading.value = true
  try {
    searchResults.value = await workerSearch(q, 100)
  } finally {
    searchLoading.value = false
  }
}

async function onSelectSearchResult(result: SearchResult) {
  // Load full conversation record for the viewer
  const conv = await conversationRepo.findById(result.pageId)
  if (conv) {
    selectedConversation.value = conv
  }
}

function onSelectConversation(item: ConversationRecord) {
  selectedConversation.value = item
  if (batchMode.value) {
    if (selectedIds.value.has(item.id)) {
      selectedIds.value.delete(item.id)
    } else {
      selectedIds.value.add(item.id)
    }
    selectedIds.value = new Set(selectedIds.value)
  }
}

function onViewerClose() {
  selectedConversation.value = null
}

function onContinueConversation(pageId: string) {
  // Navigate to chat workspace with this page's context
  window.dispatchEvent(new CustomEvent('library:continue-conversation', { detail: { pageId } }))
}

function onDomainFilter(domain: string | null) {
  selectedDomain.value = domain
  isSearchMode.value = false
  searchQuery.value = ''
  searchResults.value = []
}

async function confirmBatchDelete() {
  for (const id of selectedIds.value) {
    await conversationRepo.delete(id)
  }
  selectedIds.value = new Set()
  batchMode.value = false
  showBatchDeleteModal.value = false
  historyListRef.value?.reload()
  await loadDomains()
  if (selectedConversation.value && !selectedIds.value.has(selectedConversation.value.id)) {
    selectedConversation.value = null
  }
}

watch(selectedDomain, () => {
  historyListRef.value?.reload()
})
</script>

<template>
  <div class="library-page">
    <!-- ── Left sidebar: domain navigation ── -->
    <aside class="library-page__sidebar">
      <div class="library-page__sidebar-title">域名分类</div>

      <!-- "全部" entry -->
      <button
        class="library-page__domain-item"
        :class="{ 'library-page__domain-item--active': selectedDomain === null }"
        @click="onDomainFilter(null)"
      >
        <span class="library-page__domain-icon" aria-hidden="true">🌐</span>
        <span class="library-page__domain-label">全部</span>
      </button>

      <button
        v-for="domain in domains"
        :key="domain"
        class="library-page__domain-item"
        :class="{ 'library-page__domain-item--active': selectedDomain === domain }"
        @click="onDomainFilter(domain)"
      >
        <span class="library-page__domain-icon" aria-hidden="true">🔗</span>
        <span class="library-page__domain-label">{{ domain }}</span>
      </button>
    </aside>

    <!-- ── Center: list panel ── -->
    <section class="library-page__list-panel">
      <!-- Batch action bar -->
      <div class="library-page__batch-bar">
        <button
          class="library-page__batch-btn"
          :class="{ 'library-page__batch-btn--active': batchMode }"
          @click="batchMode = !batchMode; selectedIds = new Set()"
        >
          {{ batchMode ? '取消选择' : '批量管理' }}
        </button>
        <button
          v-if="batchMode && selectedIds.size > 0"
          class="library-page__batch-delete-btn"
          @click="showBatchDeleteModal = true"
        >
          删除选中 ({{ selectedIds.size }})
        </button>
      </div>

      <!-- Search results or history list -->
      <SearchResultList
        v-if="isSearchMode"
        class="library-page__content"
        :results="searchResults"
        :query="searchQuery"
        :loading="searchLoading"
        @select="onSelectSearchResult"
      />
      <HistoryList
        v-else
        ref="historyListRef"
        class="library-page__content"
        :filter-domain="selectedDomain ?? undefined"
        @select="onSelectConversation"
        @query="onSearch"
      />
    </section>

    <!-- ── Right: snapshot viewer ── -->
    <section class="library-page__viewer-panel">
      <SnapshotViewer
        :conversation="selectedConversation"
        @close="onViewerClose"
        @continue="onContinueConversation"
      />
    </section>

    <!-- Batch delete confirm modal -->
    <Teleport to="body">
      <div
        v-if="showBatchDeleteModal"
        class="batch-delete-overlay"
        @click.self="showBatchDeleteModal = false"
      >
        <div class="batch-delete-modal">
          <div class="batch-delete-modal__title">批量删除确认</div>
          <div class="batch-delete-modal__body">
            确定要删除选中的 <strong>{{ selectedIds.size }}</strong> 条历史记录吗？
            <br /><span class="batch-delete-modal__hint">此操作将同时删除文章快照、对话历史与高亮选区，不可恢复。</span>
          </div>
          <div class="batch-delete-modal__footer">
            <button class="batch-delete-modal__btn" @click="showBatchDeleteModal = false">取消</button>
            <button class="batch-delete-modal__btn batch-delete-modal__btn--danger" @click="confirmBatchDelete">
              确认删除
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.library-page {
  display: grid;
  grid-template-columns: 160px 300px 1fr;
  height: 100%;
  overflow: hidden;
  background: var(--bg, #f4f2ec);
}

/* Sidebar */
.library-page__sidebar {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border, #e6e2d8);
  background: var(--panel, #fff);
  overflow-y: auto;
  padding: 10px 6px;
  gap: 2px;
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar, #dedad0) transparent;
}

.library-page__sidebar-title {
  font-size: 10px;
  font-weight: 700;
  color: var(--muted, #7a7568);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 4px 8px 8px;
}

.library-page__domain-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border: none;
  background: transparent;
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  color: var(--text, #2e2d2a);
  transition: background 0.1s, color 0.1s;
  width: 100%;
}

.library-page__domain-item:hover {
  background: var(--card, #faf9f5);
}

.library-page__domain-item--active {
  background: var(--primary-soft, #eef0ff);
  color: var(--primary, #5b60e5);
}

.library-page__domain-icon {
  font-size: 11px;
  flex-shrink: 0;
}

.library-page__domain-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* List panel */
.library-page__list-panel {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border, #e6e2d8);
  background: var(--panel, #fff);
  overflow: hidden;
}

.library-page__batch-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border, #e6e2d8);
  flex-shrink: 0;
}

.library-page__batch-btn {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--border, #e6e2d8);
  background: var(--card, #faf9f5);
  color: var(--muted, #7a7568);
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
}

.library-page__batch-btn--active {
  background: var(--primary-soft, #eef0ff);
  color: var(--primary, #5b60e5);
  border-color: rgba(91, 96, 229, 0.25);
}

.library-page__batch-delete-btn {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: var(--radius-md, 8px);
  border: none;
  background: var(--red, #e53e3e);
  color: #fff;
  cursor: pointer;
  transition: background 0.1s;
}

.library-page__batch-delete-btn:hover {
  background: #c53030;
}

.library-page__content {
  flex: 1;
  overflow: hidden;
}

/* Viewer panel */
.library-page__viewer-panel {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Batch delete modal */
.batch-delete-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(4px);
}

.batch-delete-modal {
  width: 380px;
  background: var(--panel, #fff);
  border: 1px solid var(--border, #e6e2d8);
  border-radius: var(--radius-xl, 14px);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.batch-delete-modal__title {
  padding: 14px 18px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text, #2e2d2a);
  background: var(--card, #faf9f5);
  border-bottom: 1px solid var(--border, #e6e2d8);
}

.batch-delete-modal__body {
  padding: 18px;
  font-size: 12px;
  color: var(--text, #2e2d2a);
  line-height: 1.6;
}

.batch-delete-modal__hint {
  font-size: 11px;
  color: var(--muted, #7a7568);
}

.batch-delete-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--border, #e6e2d8);
  background: var(--bg, #f4f2ec);
}

.batch-delete-modal__btn {
  padding: 7px 16px;
  font-size: 12px;
  font-weight: 700;
  border-radius: var(--radius-lg, 10px);
  border: 1.5px solid var(--border, #e6e2d8);
  background: var(--panel, #fff);
  color: var(--text, #2e2d2a);
  cursor: pointer;
  transition: background 0.12s;
}

.batch-delete-modal__btn--danger {
  background: var(--red, #e53e3e);
  color: #fff;
  border-color: var(--red, #e53e3e);
}

.batch-delete-modal__btn--danger:hover {
  background: #c53030;
}
</style>
