<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { Database, CloudSync, ExternalLink } from '@lucide/vue'
import RekaButton from '@/components/ui/RekaButton.vue'
import { useAppStore } from '@/stores/app.store'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { useDocumentStore } from '@/stores/document.store'
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

const searchQuery = ref('')
const displayedDocs = ref<DocumentEntity[]>([])
const showDeleteConfirm = ref(false)
const deleteTargetId = ref<string | undefined>(undefined)
const deleteTargetName = ref('')

const docCount = computed(() => documentStore.documents.length)

onMounted(async () => {
  await documentStore.refreshDocuments()
  showRecentDocs()
})

function showRecentDocs() {
  displayedDocs.value = [...documentStore.documents]
    .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())
    .slice(0, 20)
}

function onSearch(query: string) {
  searchQuery.value = query
  if (!query.trim()) {
    showRecentDocs()
    return
  }
  const results = searchDocuments(query)
  const idSet = new Set(results.map((r) => r.id))
  displayedDocs.value = documentStore.documents.filter((d) => idSet.has(d.id))
}

async function handleDocumentClick(doc: DocumentEntity) {
  await documentStore.loadDocument(doc.id)
  workspaceStore.setDocumentSource('library')
  appStore.setCurrentView('workspace')
}

function handleChatClick(doc: DocumentEntity) {
  documentStore.setCurrentDocument(doc)
  workspaceStore.setDocumentSource('library')
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
  // Refresh displayed list
  displayedDocs.value = displayedDocs.value.filter((d) => d.id !== id)

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
    <!-- Header -->
    <div class="h-12 shrink-0 px-4 flex items-center justify-between border-b border-zinc-200 bg-white/80 backdrop-blur-md">
      <div class="text-[14px] font-semibold text-zinc-900 flex items-center gap-2">
        <Database class="w-4 h-4 text-brand" />
        记忆库
        <span class="text-[11px] font-normal text-zinc-400">{{ docCount }} 篇</span>
      </div>
      <button class="p-1.5 rounded-md text-zinc-500 hover:bg-zinc-100">
        <CloudSync class="w-4 h-4" />
      </button>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto">
      <!-- Search -->
      <div class="sticky top-0 z-10 p-4 pb-3 bg-[#FCFCFC]/95 backdrop-blur-md border-b border-zinc-100">
        <SearchBar v-model="searchQuery" @search="onSearch" />
      </div>

      <!-- Heatmap -->
      <Heatmap />

      <!-- Documents -->
      <div class="p-2 pb-6">
        <div class="px-2 pt-2 pb-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
          {{ searchQuery ? '搜索结果' : '最近捕获' }}
        </div>

        <DocumentItem
          v-for="doc in displayedDocs"
          :key="doc.id"
          :document="doc"
          @select="handleDocumentClick"
          @chat="handleChatClick"
          @open-url="handleOpenUrl"
          @delete="requestDelete"
        />

        <div v-if="displayedDocs.length === 0" class="text-center py-8 text-[13px] text-zinc-400">
          {{ searchQuery ? '未找到匹配的文档' : '暂无捕获的文档' }}
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
