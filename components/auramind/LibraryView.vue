<script lang="ts" setup>
import { ref, computed } from 'vue'
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

const displayedDocs = computed(() => {
  const docs = [...documentStore.documents]
  if (!searchQuery.value.trim()) {
    return docs
      .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())
      .slice(0, 20)
  }
  const results = searchDocuments(searchQuery.value)
  const idSet = new Set(results.map((r) => r.id))
  return docs.filter((d) => idSet.has(d.id))
})

function onSearch(query: string) {
  searchQuery.value = query
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
