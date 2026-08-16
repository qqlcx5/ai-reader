<script lang="ts" setup>
import { ref, computed, nextTick, watch } from 'vue'
import TabsRoot from '@/components/ui/Tabs.vue'
import TabsList from '@/components/ui/TabsList.vue'
import TabsTrigger from '@/components/ui/TabsTrigger.vue'
import { Copy, Check, RefreshCw, Trash2, Volume2, Square } from '@lucide/vue'
import { useTts } from '@/composables/useTts'
import { useDocumentStore } from '@/stores/document.store'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { useAppStore } from '@/stores/app.store'
import { useChatStore } from '@/stores/chat.store'
import { captureTab } from '@/services/capture/smart-capture'
import { maybeAutoTag } from '@/services/tags/auto-tag'
import { nowISO } from '@/utils/date'
import type { DocumentEntity, ExtractionMethod, Highlight } from '@/types/document'
import MarkdownPreview from '@/components/workspace/MarkdownPreview.vue'
import RawPreview from '@/components/workspace/RawPreview.vue'
import MetadataPanel from '@/components/workspace/MetadataPanel.vue'
import HighlightsPanel from '@/components/workspace/HighlightsPanel.vue'
import RelatedPanel from '@/components/workspace/RelatedPanel.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'

const documentStore = useDocumentStore()
const workspaceStore = useWorkspaceStore()
const appStore = useAppStore()
const chatStore = useChatStore()

const isRefreshing = ref(false)
const copied = ref(false)
const showDeleteConfirm = ref(false)
const isDeleting = ref(false)

// Ref to MarkdownPreview for jump-to-highlight
const markdownPreviewRef = ref<InstanceType<typeof MarkdownPreview> | null>(null)

const highlightCount = computed(() => documentStore.currentDocument?.highlights?.length ?? 0)

const currentDoc = computed(() => documentStore.currentDocument)

// ── Read aloud ──
const tts = useTts()
watch(currentDoc, () => tts.stop())

function handleReadAloud() {
  if (!currentDoc.value) return
  tts.toggle(currentDoc.value.markdown)
  if (tts.error.value) appStore.showToast(tts.error.value, 'warning')
}

const contextTab = computed({
  get: () => workspaceStore.currentContextTab,
  set: (val) => workspaceStore.setContextTab(val),
})

function buildDocumentEntity(data: {
  url: string
  title: string
  markdown: string
  siteName?: string
  author?: string
  description?: string
  publishedAt?: string
  canonicalUrl?: string
  contentHash: string
  wordCount: number
  tokenCount: number
  extractionMethod: ExtractionMethod
}): DocumentEntity {
  const now = nowISO()
  return {
    id: data.contentHash,
    url: data.url,
    canonicalUrl: data.canonicalUrl,
    title: data.title,
    siteName: data.siteName,
    author: data.author,
    description: data.description,
    publishedAt: data.publishedAt,
    markdown: data.markdown,
    wordCount: data.wordCount,
    tokenCount: data.tokenCount,
    contentHash: data.contentHash,
    extractionMethod: data.extractionMethod,
    source: 'current-page',
    capturedAt: now,
    updatedAt: now,
  }
}

async function handleRefresh() {
  isRefreshing.value = true

  try {
    if (workspaceStore.documentSource === 'current-page') {
      const tab = appStore.activeTab
      if (!tab?.id) {
        appStore.showToast('无法获取当前标签页', 'error')
        return
      }
      workspaceStore.setExtracting(true)

      const extracted = await captureTab(tab)

      const doc = buildDocumentEntity({
        url: extracted.url,
        title: extracted.title,
        markdown: extracted.markdown,
        siteName: extracted.siteName,
        author: extracted.author,
        description: extracted.description,
        publishedAt: extracted.publishedAt,
        canonicalUrl: extracted.canonicalUrl,
        contentHash: extracted.contentHash,
        wordCount: extracted.wordCount,
        tokenCount: extracted.tokenCount,
        extractionMethod: extracted.extractionMethod,
      })

      documentStore.setCurrentDocument(doc)
      documentStore.setPageDocument(doc)
      await documentStore.saveDocument(doc)
      maybeAutoTag(doc.id).then((tags) => {
        if (tags.length > 0) appStore.showToast(`AI 标签：${tags.join('、')}`, 'success')
      }).catch(() => {})
      workspaceStore.setCaptureStatus('ready')
    } else {
      // Reload from IndexedDB for library-sourced documents.
      // Fall back to chatStore.currentDocumentId: after the popup is enlarged
      // to a standalone window, documentStore.currentDocument may be null because
      // only the document ID is persisted (the full entity is re-hydrated from
      // IndexedDB via afterRestore, but there is a window between mount and
      // re-hydration where currentDocument can still be null).
      const docId = documentStore.currentDocument?.id || chatStore.currentDocumentId
      if (!docId) {
        appStore.showToast('没有当前文档', 'error')
        return
      }
      await documentStore.loadDocument(docId)
    }

    appStore.showToast('刷新完成', 'success')

    try {
      await chatStore.loadConversations(documentStore.currentDocument?.id || '')
    } catch {
      // non-critical
    }
  } catch (err: any) {
    workspaceStore.setCaptureStatus('failed')
    appStore.showToast(err.message || '刷新失败', 'error')
  } finally {
    isRefreshing.value = false
    workspaceStore.setExtracting(false)
  }
}

function buildMetadataJSON(): string {
  const d = documentStore.currentDocument
  if (!d) return ''
  const meta: Record<string, unknown> = {
    title: d.title,
    url: d.url,
    canonicalUrl: d.canonicalUrl,
    siteName: d.siteName,
    author: d.author,
    description: d.description,
    publishedAt: d.publishedAt,
    capturedAt: d.capturedAt,
    updatedAt: d.updatedAt,
    wordCount: d.wordCount,
    tokenCount: d.tokenCount,
    extractionMethod: d.extractionMethod,
    contentHash: d.contentHash,
    source: d.source,
  }
  return JSON.stringify(meta, null, 2)
}

async function handleCopy() {
  let content = ''
  const tab = contextTab.value

  if (tab === 'markdown') {
    content = documentStore.currentDocument?.markdown || ''
  } else if (tab === 'raw') {
    content = documentStore.currentDocument?.markdown || ''
  } else if (tab === 'metadata') {
    content = buildMetadataJSON()
  }

  if (!content) {
    appStore.showToast('没有可复制的内容', 'error')
    return
  }

  try {
    await navigator.clipboard.writeText(content)
    copied.value = true
    appStore.showToast('已复制到剪贴板', 'success')
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    appStore.showToast('复制失败', 'error')
  }
}

function requestDelete() {
  if (!currentDoc.value) {
    appStore.showToast('没有可删除的文档', 'error')
    return
  }
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  const doc = currentDoc.value
  if (!doc) {
    showDeleteConfirm.value = false
    return
  }
  const docId = doc.id
  const docTitle = doc.title || '未命名文档'
  isDeleting.value = true
  try {
    await documentStore.deleteDocument(docId)
    // Clear chat in-memory state so the user doesn't see a stale
    // conversation list pointing at a now-deleted document.
    chatStore.resetState()
    // Refresh the library list so the removed doc disappears.
    await documentStore.refreshDocuments()
    // Fall back to "current page" capture mode — the deleted document
    // is gone, so we shouldn't keep pointing at a library source.
    workspaceStore.setDocumentSource('current-page')
    showDeleteConfirm.value = false
    appStore.showToast(`已从记忆库删除：${docTitle}`, 'success')
  } catch (err: any) {
    appStore.showToast(err.message || '删除失败', 'error')
  } finally {
    isDeleting.value = false
  }
}

function cancelDelete() {
  showDeleteConfirm.value = false
}

/** Jump to a highlight in the Markdown preview tab. */
async function handleJumpToHighlight(hl: Highlight) {
  // Switch to markdown tab first
  workspaceStore.setContextTab('markdown')
  await nextTick()
  // Delegate to MarkdownPreview's jump method
  markdownPreviewRef.value?.jumpToHighlight(hl)
}
</script>

<template>
  <div class="flex-1 min-h-0 overflow-hidden flex flex-col bg-white">
    <!-- Toolbar -->
    <div class="h-9 shrink-0 flex items-center justify-between px-3 border-b border-zinc-200 bg-zinc-50/80">
      <TabsRoot
        v-model="contextTab"
        class="flex items-center gap-1 h-full"
      >
        <TabsList class="flex items-center gap-1 h-full">
          <TabsTrigger
            value="markdown"
            class="h-full flex items-center px-2.5 text-[11px] font-medium transition-colors border-b-2 border-transparent data-[state=active]:border-brand data-[state=active]:text-brand text-zinc-400 hover:text-zinc-700"
          >
            Markdown
          </TabsTrigger>
          <TabsTrigger
            value="highlights"
            class="h-full flex items-center px-2.5 text-[11px] font-medium transition-colors border-b-2 border-transparent data-[state=active]:border-brand data-[state=active]:text-brand text-zinc-400 hover:text-zinc-700"
          >
            标注
            <span
              v-if="highlightCount"
              class="ml-1 px-1 py-px text-[9px] leading-none bg-zinc-200 text-zinc-600 rounded-full group-data-[state=active]:bg-brand-100 group-data-[state=active]:text-brand-700"
            >{{ highlightCount }}</span>
          </TabsTrigger>
          <TabsTrigger
            value="related"
            class="h-full flex items-center px-2.5 text-[11px] font-medium transition-colors border-b-2 border-transparent data-[state=active]:border-brand data-[state=active]:text-brand text-zinc-400 hover:text-zinc-700"
          >
            相关
          </TabsTrigger>
          <TabsTrigger
            value="raw"
            class="h-full flex items-center px-2.5 text-[11px] font-medium transition-colors border-b-2 border-transparent data-[state=active]:border-brand data-[state=active]:text-brand text-zinc-400 hover:text-zinc-700"
          >
            Raw
          </TabsTrigger>
          <TabsTrigger
            value="metadata"
            class="h-full flex items-center px-2.5 text-[11px] font-medium transition-colors border-b-2 border-transparent data-[state=active]:border-brand data-[state=active]:text-brand text-zinc-400 hover:text-zinc-700"
          >
            元数据
          </TabsTrigger>
        </TabsList>
      </TabsRoot>

      <div class="flex items-center gap-1">
        <button
          class="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors disabled:opacity-50"
          :disabled="!currentDoc"
          :title="tts.speaking.value ? '停止朗读' : '朗读全文'"
          @click="handleReadAloud"
        >
          <Square v-if="tts.speaking.value" class="w-3.5 h-3.5 text-brand" />
          <Volume2 v-else class="w-3.5 h-3.5" />
        </button>
        <button
          class="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
          :title="copied ? '已复制' : '复制当前标签页内容'"
          @click="handleCopy"
        >
          <Check v-if="copied" class="w-3.5 h-3.5 text-green-500" />
          <Copy v-else class="w-3.5 h-3.5" />
        </button>
        <button
          class="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors disabled:opacity-50"
          :disabled="isRefreshing"
          title="刷新"
          @click="handleRefresh"
        >
          <RefreshCw
            class="w-3.5 h-3.5"
            :class="{ 'animate-spin': isRefreshing }"
          />
        </button>
        <button
          class="p-1.5 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
          :disabled="isDeleting || !currentDoc"
          title="从记忆库删除"
          aria-label="从记忆库删除"
          @click="requestDelete"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Tab Content -->
    <MarkdownPreview
      v-show="contextTab === 'markdown'"
      ref="markdownPreviewRef"
    />
    <HighlightsPanel
      v-show="contextTab === 'highlights'"
      @jump="handleJumpToHighlight"
    />
    <RelatedPanel v-show="contextTab === 'related'" />
    <RawPreview v-show="contextTab === 'raw'" />
    <MetadataPanel v-show="contextTab === 'metadata'" />

    <!-- Delete confirm -->
    <ConfirmModal
      v-if="showDeleteConfirm && currentDoc"
      title="删除文档"
      :desc="`确定从记忆库删除「${currentDoc.title || '未命名文档'}」吗？关联的对话记录也会被删除。此操作不可撤销。`"
      confirm-text="删除"
      danger
      @cancel="cancelDelete"
      @confirm="confirmDelete"
    />
  </div>
</template>
