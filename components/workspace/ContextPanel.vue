<script lang="ts" setup>
import { ref, computed } from 'vue'
import TabsRoot from '@/components/ui/Tabs.vue'
import TabsList from '@/components/ui/TabsList.vue'
import TabsTrigger from '@/components/ui/TabsTrigger.vue'
import { Copy, Check, RefreshCw } from '@lucide/vue'
import { useDocumentStore } from '@/stores/document.store'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { useAppStore } from '@/stores/app.store'
import { useChatStore } from '@/stores/chat.store'
import { requestExtract } from '@/services/capture/capture.service'
import { nowISO } from '@/utils/date'
import type { DocumentEntity } from '@/types/document'
import MarkdownPreview from '@/components/workspace/MarkdownPreview.vue'
import RawPreview from '@/components/workspace/RawPreview.vue'
import MetadataPanel from '@/components/workspace/MetadataPanel.vue'

const documentStore = useDocumentStore()
const workspaceStore = useWorkspaceStore()
const appStore = useAppStore()
const chatStore = useChatStore()

const isRefreshing = ref(false)
const copied = ref(false)

const contextTab = computed({
  get: () => workspaceStore.currentContextTab,
  set: (val) => workspaceStore.setContextTab(val),
})

function buildDocumentEntity(data: {
  url: string
  title: string
  markdown: string
  rawText?: string
  siteName?: string
  author?: string
  description?: string
  publishedAt?: string
  canonicalUrl?: string
  contentHash: string
  wordCount: number
  tokenCount: number
  extractionMethod: 'defuddle' | 'fallback'
  sanitizedHtml?: string
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
    rawText: data.rawText,
    rawHtml: data.sanitizedHtml,
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
      const tabId = appStore.activeTab?.id
      if (!tabId) {
        appStore.showToast('无法获取当前标签页', 'error')
        return
      }
      workspaceStore.setExtracting(true)

      const extracted = await requestExtract(tabId)

      const doc = buildDocumentEntity({
        url: extracted.url,
        title: extracted.title,
        markdown: extracted.markdown,
        rawText: extracted.rawText,
        siteName: extracted.siteName,
        author: extracted.author,
        description: extracted.description,
        publishedAt: extracted.publishedAt,
        canonicalUrl: extracted.canonicalUrl,
        contentHash: extracted.contentHash,
        wordCount: extracted.wordCount,
        tokenCount: extracted.tokenCount,
        extractionMethod: extracted.extractionMethod,
        sanitizedHtml: (extracted as any).sanitizedHtml,
      })

      documentStore.setCurrentDocument(doc)
      documentStore.setPageDocument(doc)
      await documentStore.saveDocument(doc)
      workspaceStore.setCaptureStatus('ready')
    } else {
      // Reload from IndexedDB for library-sourced documents
      const docId = documentStore.currentDocument?.id
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
    content = documentStore.currentDocument?.markdown
      || documentStore.currentDocument?.rawText
      || documentStore.currentDocument?.rawHtml
      || ''
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
      </div>
    </div>

    <!-- Tab Content -->
    <MarkdownPreview v-show="contextTab === 'markdown'" />
    <RawPreview v-show="contextTab === 'raw'" />
    <MetadataPanel v-show="contextTab === 'metadata'" />
  </div>
</template>
