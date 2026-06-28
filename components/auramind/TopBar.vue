<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { PanelRight, BookOpen, Settings, RefreshCw } from '@lucide/vue'
import LZString from 'lz-string'
import { useAppStore } from '@/stores/app.store'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { useDocumentStore } from '@/stores/document.store'
import { useSettingsStore } from '@/stores/settings.store'
import { requestExtract } from '@/services/capture/capture.service'
import { nowISO } from '@/utils/date'
import type { DocumentEntity } from '@/types/document'
import WorkspaceHeader from '@/components/auramind/WorkspaceHeader.vue'
import LibraryHeader from '@/components/auramind/LibraryHeader.vue'

const appStore = useAppStore()
const workspaceStore = useWorkspaceStore()
const documentStore = useDocumentStore()
const settingsStore = useSettingsStore()

const isRefreshing = ref(false)
const isLibraryRefreshing = ref(false)

const showRefresh = computed(() => {
  return appStore.currentView === 'workspace' && workspaceStore.documentSource === 'current-page'
})

const libraryDocCount = computed(() => documentStore.documents.length)

const navItems = [
  { key: 'workspace', icon: PanelRight, label: '工作区' },
  { key: 'library', icon: BookOpen, label: '记忆库' },
  { key: 'settings', icon: Settings, label: '设置' },
] as const

// Refresh library documents when switching to library view
watch(
  () => appStore.currentView,
  async (newView) => {
    if (newView === 'library') {
      try {
        await documentStore.refreshDocuments()
      } catch {
        // non-critical
      }
    }
  },
  { immediate: true },
)

async function handleLibraryRefresh() {
  isLibraryRefreshing.value = true
  try {
    await documentStore.refreshDocuments()
  } catch {
    // non-critical
  } finally {
    isLibraryRefreshing.value = false
  }
}

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
  rawHtml?: string
  rawHtmlCompressed?: boolean
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
    rawHtml: data.rawHtml,
    rawHtmlCompressed: data.rawHtmlCompressed,
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
  const tabId = appStore.activeTab?.id
  if (!tabId) {
    appStore.showToast('无法获取当前标签页', 'error')
    return
  }

  isRefreshing.value = true
  workspaceStore.setExtracting(true)

  try {
    const extracted = await requestExtract(tabId)

    const saveRawHtml = settingsStore.settings.capture.saveRawHtml
    const compressRawHtml = settingsStore.settings.capture.compressRawHtml
    let rawHtml: string | undefined
    let rawHtmlCompressed: boolean | undefined

    if (saveRawHtml && (extracted as any).sanitizedHtml) {
      if (compressRawHtml) {
        rawHtml = LZString.compress((extracted as any).sanitizedHtml)
        rawHtmlCompressed = true
      } else {
        rawHtml = (extracted as any).sanitizedHtml
        rawHtmlCompressed = false
      }
    }

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
      rawHtml,
      rawHtmlCompressed,
    })

    documentStore.setCurrentDocument(doc)
    documentStore.setPageDocument(doc)
    await documentStore.saveDocument(doc)

    workspaceStore.setCaptureStatus('ready')
    appStore.showToast('抓取完成', 'success')
  } catch (err: any) {
    workspaceStore.setCaptureStatus('failed')
    appStore.showToast(err.message || '抓取失败', 'error')
  } finally {
    isRefreshing.value = false
    workspaceStore.setExtracting(false)
  }
}
</script>

<template>
  <header class="h-14 shrink-0 border-b border-zinc-200 bg-white/75 backdrop-blur-md px-3 flex items-center justify-between">
    <!-- Left: Conditional header content -->
    <WorkspaceHeader v-if="appStore.currentView === 'workspace'" />
    <LibraryHeader
      v-else-if="appStore.currentView === 'library'"
      :doc-count="libraryDocCount"
      @refresh="handleLibraryRefresh"
    />

    <!-- Right: Refresh + nav buttons -->
    <div class="flex items-center gap-1">
      <button
        v-if="showRefresh"
        class="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors disabled:opacity-50"
        :disabled="isRefreshing"
        title="重新抓取"
        @click="handleRefresh"
      >
        <RefreshCw
          class="w-4 h-4"
          :class="{ 'animate-spin': isRefreshing }"
        />
      </button>
      <button
        v-for="item in navItems"
        :key="item.key"
        class="p-1.5 rounded-md transition-colors"
        :class="appStore.currentView === item.key ? 'text-brand bg-indigo-50' : 'text-zinc-500 hover:bg-zinc-100'"
        :title="item.label"
        @click="appStore.setCurrentView(item.key)"
      >
        <component :is="item.icon" class="w-4 h-4" />
      </button>
    </div>
  </header>
</template>
