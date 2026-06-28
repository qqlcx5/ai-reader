<script lang="ts" setup>
import { onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/stores/app.store'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useDocumentStore } from '@/stores/document.store'
import { useModelStore } from '@/stores/model.store'
import { requestExtract } from '@/services/capture/capture.service'
import { nowISO } from '@/utils/date'
import TopBar from '@/components/auramind/TopBar.vue'
import WorkspaceView from '@/components/auramind/WorkspaceView.vue'
import LibraryView from '@/components/auramind/LibraryView.vue'
import SettingsView from '@/components/auramind/SettingsView.vue'
import PageChangeHint from '@/components/auramind/PageChangeHint.vue'
import type { MessageEnvelope, TabActivatedPayload, TabUpdatedPayload } from '@/types/message'
import type { DocumentEntity } from '@/types/document'

const appStore = useAppStore()
const workspaceStore = useWorkspaceStore()
const settingsStore = useSettingsStore()
const documentStore = useDocumentStore()
const modelStore = useModelStore()

function handleBackgroundMessage(
  message: MessageEnvelope<TabActivatedPayload | TabUpdatedPayload>,
) {
  if (message.type === 'TAB_ACTIVATED' || message.type === 'TAB_UPDATED') {
    appStore.setActiveTab(message.payload.tab)
    if (workspaceStore.documentSource === 'library') {
      appStore.showPageChangeHint = true
    }

    // Auto-extract on tab change
    if (settingsStore.settings.capture.autoExtractOnTabChange) {
      triggerAutoExtract(message.payload.tab.id)
    }
  }
}

async function triggerAutoExtract(tabId: number) {
  workspaceStore.setExtracting(true)
  try {
    const extracted = await requestExtract(tabId)
    const now = nowISO()
    const doc: DocumentEntity = {
      id: extracted.contentHash,
      url: extracted.url,
      canonicalUrl: extracted.canonicalUrl,
      title: extracted.title,
      siteName: extracted.siteName,
      author: extracted.author,
      description: extracted.description,
      publishedAt: extracted.publishedAt,
      markdown: extracted.markdown,
      rawText: extracted.rawText,
      wordCount: extracted.wordCount,
      tokenCount: extracted.tokenCount,
      contentHash: extracted.contentHash,
      extractionMethod: extracted.extractionMethod,
      source: 'current-page',
      capturedAt: now,
      updatedAt: now,
    }
    documentStore.setCurrentDocument(doc)
    documentStore.setPageDocument(doc)
    await documentStore.saveDocument(doc)
    workspaceStore.setCaptureStatus('ready')
  } catch {
    workspaceStore.setCaptureStatus('failed')
  } finally {
    workspaceStore.setExtracting(false)
  }
}

let removeListener: (() => void) | null = null

onMounted(async () => {
  await settingsStore.loadSettings()
  await modelStore.loadModels()

  // Restore persisted selections. The pinia-plugin-persistedstate plugin
  // restores currentModelId / selectedModelIds from localStorage before
  // onMounted runs. After loadModels() populates the model list from
  // IndexedDB, validate that persisted IDs still reference valid models.
  if (modelStore.currentModelId) {
    const exists = modelStore.models.some(m => m.id === modelStore.currentModelId)
    if (!exists) {
      modelStore.currentModelId = null
    }
  }

  // Filter stale multi-select IDs
  if (modelStore.selectedModelIds.length > 0) {
    const valid = modelStore.selectedModelIds.filter(id =>
      modelStore.models.some(m => m.id === id),
    )
    if (valid.length !== modelStore.selectedModelIds.length) {
      modelStore.selectedModelIds = valid
    }
  }

  // Fallback: if no model is selected (neither persisted nor valid),
  // auto-select the default model.
  if (!modelStore.currentModelId && modelStore.defaultModel) {
    modelStore.selectModel(modelStore.defaultModel.id)
  }

  if (browser?.runtime?.onMessage) {
    browser.runtime.onMessage.addListener(handleBackgroundMessage)
    removeListener = () => browser.runtime.onMessage.removeListener(handleBackgroundMessage)
  }

  // Auto-extract on open
  if (settingsStore.settings.capture.autoExtractOnOpen && appStore.activeTab?.id) {
    triggerAutoExtract(appStore.activeTab.id)
  }

  // Get current tab info
  if (browser?.runtime?.sendMessage) {
    browser.runtime
      .sendMessage({ type: 'GET_CURRENT_TAB' })
      .then((tab: any) => {
        if (tab) appStore.setActiveTab(tab)
        // Try auto-extract after getting tab info
        if (settingsStore.settings.capture.autoExtractOnOpen && tab?.id) {
          triggerAutoExtract(tab.id)
        }
      })
      .catch(() => {})
  }
})

onUnmounted(() => {
  removeListener?.()
})
</script>

<template>
  <div class="h-full w-full bg-[#FAFAFA] soft-shadow border border-zinc-200 overflow-hidden flex flex-col font-sans text-zinc-900">
    <TopBar />
    <PageChangeHint v-show="appStore.currentView === 'workspace'" />

    <WorkspaceView v-show="appStore.currentView === 'workspace'" />
    <LibraryView v-show="appStore.currentView === 'library'" />
    <SettingsView v-show="appStore.currentView === 'settings'" />
  </div>
</template>
