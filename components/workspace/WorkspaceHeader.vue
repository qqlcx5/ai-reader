<script lang="ts" setup>
import { computed, ref } from 'vue'
import { RefreshCw } from '@lucide/vue'
import { useDocumentStore } from '@/stores/document.store'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { useAppStore } from '@/stores/app.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useChatStore } from '@/stores/chat.store'
import { requestExtract } from '@/services/capture/capture.service'
import { nowISO } from '@/utils/date'
import type { DocumentEntity, ExtractionMethod } from '@/types/document'

const documentStore = useDocumentStore()
const workspaceStore = useWorkspaceStore()
const appStore = useAppStore()
const settingsStore = useSettingsStore()
const chatStore = useChatStore()

const isRefreshing = ref(false)

const domain = computed(() => {
  const url = documentStore.currentDocument?.url
  if (!url) return ''
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
})

const tokenCount = computed(() => {
  return documentStore.currentDocument?.tokenCount ?? 0
})

const statusColorMap: Record<string, string> = {
  idle: 'bg-zinc-300',
  extracting: 'bg-blue-400',
  ready: 'bg-emerald-400',
  cached: 'bg-cyan-400',
  failed: 'bg-red-400',
  stale: 'bg-amber-400',
}

const statusColor = computed(() => {
  return statusColorMap[workspaceStore.captureStatus] || statusColorMap.idle
})

const showRefresh = computed(() => true)

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
  <div class="h-14 shrink-0 border-b border-zinc-200 bg-white/75 backdrop-blur-md px-3 flex items-center justify-between">
    <div class="flex items-center gap-2 min-w-0">
      <div class="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center shrink-0">
        <svg class="w-4 h-4 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      </div>
      <div class="min-w-0">
        <div class="text-[13px] font-medium truncate max-w-[145px]">
          {{ documentStore.currentDocument?.title || '未选择文档' }}
        </div>
        <div class="text-[10px] text-zinc-400 flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full" :class="statusColor" />
          <template v-if="domain">{{ domain }}</template>
          <template v-else>—</template>
          <span v-if="tokenCount > 0">· {{ tokenCount.toLocaleString() }} tokens</span>
        </div>
      </div>
    </div>

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
  </div>
</template>
