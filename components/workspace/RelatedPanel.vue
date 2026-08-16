<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import { Link2 } from '@lucide/vue'
import { useDocumentStore } from '@/stores/document.store'
import { useChatStore } from '@/stores/chat.store'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { useAppStore } from '@/stores/app.store'
import { DocumentRepository } from '@/db/repositories/document.repository'
import { findRelated, type RelatedDoc } from '@/services/search/related'
import { formatRelative } from '@/utils/date'
import type { DocumentEntity } from '@/types/document'

const documentStore = useDocumentStore()
const chatStore = useChatStore()
const workspaceStore = useWorkspaceStore()
const appStore = useAppStore()

const related = ref<RelatedDoc[]>([])
const loading = ref(false)

const currentId = computed(() => documentStore.currentDocument?.id)

async function load() {
  const doc = documentStore.currentDocument
  if (!doc) {
    related.value = []
    return
  }
  loading.value = true
  try {
    const pool = await DocumentRepository.findAll()
    related.value = findRelated(doc, pool)
  } finally {
    loading.value = false
  }
}

watch(currentId, load, { immediate: true })

async function open(doc: DocumentEntity) {
  documentStore.setCurrentDocument(doc)
  documentStore.markOpened(doc.id)
  workspaceStore.setDocumentSource('library')
  try {
    await chatStore.loadConversations(doc.id)
  } catch {
    // non-critical
  }
}
</script>

<template>
  <div class="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-2">
    <div v-if="loading" class="text-[12px] text-zinc-400 py-4 text-center">查找相关文档…</div>

    <template v-else-if="related.length > 0">
      <button
        v-for="{ doc, score } in related"
        :key="doc.id"
        class="text-left p-2.5 rounded-xl border border-zinc-200 bg-white hover:border-brand/40 hover:bg-brand/5 transition-colors flex flex-col gap-1"
        @click="open(doc)"
      >
        <span class="text-[12px] font-medium text-zinc-800 line-clamp-2">{{ doc.title || '(无标题)' }}</span>
        <span class="flex items-center gap-2 text-[10px] text-zinc-400">
          <span v-if="doc.siteName" class="truncate">{{ doc.siteName }}</span>
          <span>{{ formatRelative(doc.capturedAt) }}</span>
          <span class="ml-auto flex items-center gap-0.5 text-brand/70" :title="`相关度 ${Math.round(score * 100)}%`">
            <Link2 class="w-3 h-3" />
            {{ Math.round(Math.min(1, score * 2) * 100) }}%
          </span>
        </span>
      </button>
    </template>

    <div v-else class="text-center py-8 text-[12px] text-zinc-400">
      暂时没有发现相关文档——剪藏更多同主题的内容后，这里会自动出现。
    </div>
  </div>
</template>
