<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { PanelRight, BookOpen, Settings, RefreshCw, Gauge, Rss, Maximize2, ArrowLeft, Zap } from '@lucide/vue'
import { useAppStore } from '@/stores/app.store'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { useDocumentStore } from '@/stores/document.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useChatStore } from '@/stores/chat.store'
import { requestExtract } from '@/services/capture/capture.service'
import { nowISO } from '@/utils/date'
import { openAppWindow, isWindowMode } from '@/utils/open-window'
import type { DocumentEntity, ExtractionMethod } from '@/types/document'
import WorkspaceHeader from '@/components/auramind/WorkspaceHeader.vue'
import LibraryHeader from '@/components/auramind/LibraryHeader.vue'

const appStore = useAppStore()
const workspaceStore = useWorkspaceStore()
const documentStore = useDocumentStore()
const settingsStore = useSettingsStore()
const chatStore = useChatStore()

const isRefreshing = ref(false)
const isLibraryRefreshing = ref(false)
const windowMode = isWindowMode()

const showRefresh = computed(() => appStore.currentView === 'workspace')

const libraryDocCount = computed(() => documentStore.documents.length)

const navItems = [
  { key: 'workspace', icon: PanelRight, label: '工作区' },
  { key: 'library', icon: BookOpen, label: '记忆库' },
  { key: 'analysis', icon: Zap, label: 'AI 分析' },
  { key: 'feeds', icon: Rss, label: '订阅' },
  { key: 'usage', icon: Gauge, label: '用量' },
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
  const tabId = appStore.activeTab?.id
  if (!tabId) {
    appStore.showToast('无法获取当前标签页', 'error')
    return
  }

  isRefreshing.value = true
  workspaceStore.setExtracting(true)

  try {
    const extracted = await requestExtract(tabId)

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
    workspaceStore.setDocumentSource('current-page')

    workspaceStore.setCaptureStatus('ready')
    appStore.showToast('抓取完成', 'success')

    try {
      await chatStore.loadConversations(documentStore.currentDocument?.id || doc.id)
    } catch {
      // non-critical
    }
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
    <div v-else></div>

    <!-- Right: Refresh + nav buttons -->
    <div class="flex items-center gap-1">
      <button
        v-if="appStore.canGoBack"
        class="p-1.5 rounded-md text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
        title="返回 (Alt+←)"
        @click="appStore.goBack()"
      >
        <ArrowLeft class="w-4 h-4" />
      </button>
      <button
        v-if="!windowMode"
        class="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
        title="在独立窗口打开"
        @click="openAppWindow"
      >
        <Maximize2 class="w-4 h-4" />
      </button>
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
        :class="appStore.currentView === item.key ? 'text-brand bg-brand/10' : 'text-zinc-500 hover:bg-zinc-100'"
        :title="item.label"
        @click="appStore.setCurrentView(item.key, { resetHistory: true })"
      >
        <component :is="item.icon" class="w-4 h-4" />
      </button>
    </div>
  </header>
</template>
