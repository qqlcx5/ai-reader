<script lang="ts" setup>
import { onMounted, onUnmounted, watch } from 'vue'
import { useAppStore } from '@/stores/app.store'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useDocumentStore } from '@/stores/document.store'
import { useModelStore } from '@/stores/model.store'
import { useChatStore } from '@/stores/chat.store'
import { usePromptTemplateStore } from '@/stores/prompt-template.store'
import { requestExtract } from '@/services/capture/capture.service'
import { nowISO } from '@/utils/date'
import { isWindowMode } from '@/utils/open-window'
import { useBackNavigation } from '@/composables/useBackNavigation'
import TopBar from '@/components/auramind/TopBar.vue'
import WorkspaceView from '@/components/auramind/WorkspaceView.vue'
import LibraryView from '@/components/auramind/LibraryView.vue'
import AnalysisView from '@/components/auramind/AnalysisView.vue'
import SettingsView from '@/components/auramind/SettingsView.vue'
import UsageView from '@/components/auramind/UsageView.vue'
import FeedsView from '@/components/auramind/FeedsView.vue'
import ReviewView from '@/components/auramind/ReviewView.vue'
import CardManagerView from '@/components/auramind/CardManagerView.vue'
import WatchView from '@/components/auramind/WatchView.vue'
import InsightsView from '@/components/auramind/InsightsView.vue'
import GraphView from '@/components/auramind/GraphView.vue'
import PageChangeHint from '@/components/auramind/PageChangeHint.vue'
import CommandPalette from '@/components/common/CommandPalette.vue'
import ShortcutsHelp from '@/components/common/ShortcutsHelp.vue'
import Toaster from '@/components/Toaster.vue'
import type { MessageEnvelope, TabActivatedPayload, TabUpdatedPayload } from '@/types/message'
import type { DocumentEntity } from '@/types/document'

const appStore = useAppStore()
const workspaceStore = useWorkspaceStore()
const settingsStore = useSettingsStore()
const documentStore = useDocumentStore()
const modelStore = useModelStore()
const chatStore = useChatStore()
const promptTemplateStore = usePromptTemplateStore()

// In popped-out window mode there is no associated page tab, so skip the
// current-page capture flow entirely (window is for library + chat).
const windowMode = isWindowMode()

// Register mouse-back / Alt+Left / Esc → goBack listeners.
useBackNavigation()

function handleBackgroundMessage(
  message: MessageEnvelope<TabActivatedPayload | TabUpdatedPayload> | { type: string; payload?: { tabId?: number; message?: string; count?: number } },
) {
  if (message.type === 'FLOATING_CAPTURE') {
    const tabId = message.payload?.tabId
    if (tabId) triggerAutoExtract(tabId)
    return
  }
  if (message.type === 'WATCH_CHANGED') {
    const count = (message.payload as any)?.count ?? 0
    const title = (message.payload as any)?.title ?? ''
    appStore.showToast(count > 1 ? `监控：${count} 个页面有更新` : `监控：「${title}」有更新`, 'success')
    return
  }
  if (message.type === 'OMNIBOX_SEARCH') {
    const query = (message.payload as any)?.query || ''
    window.dispatchEvent(new CustomEvent('auramind:omnibox', { detail: { query } }))
    return
  }
  if (message.type === 'CAPTURE_PAGE') {
    const tabId = message.payload?.tabId
    if (tabId) triggerAutoExtract(tabId)
    return
  }
  if (message.type === 'OPEN_REVIEW') {
    appStore.setCurrentView('review', { resetHistory: true })
    return
  }
  if (message.type === 'AI_JOB_SKIPPED') {
    const payload = message.payload
    if (payload?.message) {
      appStore.showToast(payload.message, 'warning')
    }
    return
  }
  if (message.type === 'TAB_ACTIVATED' || message.type === 'TAB_UPDATED') {
    const payload = message.payload as TabActivatedPayload | TabUpdatedPayload
    appStore.setActiveTab(payload.tab)
    if (workspaceStore.documentSource === 'library') {
      appStore.showPageChangeHint = true
    }

    // Auto-extract on tab change
    if (!windowMode && settingsStore.settings.capture.autoExtractOnTabChange) {
      triggerAutoExtract(payload.tab.id)
    }
  }
}

function isInjectableUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}

async function triggerAutoExtract(tabId: number) {
  const url = appStore.activeTab?.url || ''

  // Content scripts cannot be injected into chrome://, chrome-extension://,
  // about:blank, new tab pages, etc. Silently skip non-injectable pages.
  if (!isInjectableUrl(url)) return

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

    // Load conversations associated with this document.
    // Use the merged doc id (saveDocument may have merged into an existing record
    // with a different id, and conversations are keyed by that original id).
    const savedId = documentStore.currentDocument?.id || doc.id
    try {
      await chatStore.loadConversations(savedId)
    } catch {
      // non-critical
    }
  } catch (err) {
    const msg = (err as Error)?.message || ''

    // Connection errors mean the page became non-injectable between the URL
    // check and the extraction attempt (e.g. the tab navigated to a chrome://
    // page). Silently skip — this is not a real failure.
    if (
      msg.includes('Receiving end does not exist') ||
      msg.includes('Could not establish connection')
    ) {
      return
    }

    console.error('[triggerAutoExtract] capture failed for tab', tabId, err)
    workspaceStore.setCaptureStatus('failed')
  } finally {
    workspaceStore.setExtracting(false)
  }
}

let removeListener: (() => void) | null = null

// ── Theme: apply dark class from settings + system preference ──
const systemDark = window.matchMedia('(prefers-color-scheme: dark)')
function applyTheme() {
  const dark = settingsStore.theme === 'dark'
    || (settingsStore.theme === 'system' && systemDark.matches)
  document.documentElement.classList.toggle('dark', dark)
}
systemDark.addEventListener('change', applyTheme)

// Command-palette actions that need App-local plumbing (e.g. capture).
function onPaletteAction(e: Event) {
  const type = (e as CustomEvent).detail?.type
  if (type === 'capture' && appStore.activeTab?.id) {
    triggerAutoExtract(appStore.activeTab.id)
  }
}
window.addEventListener('auramind:palette-action', onPaletteAction as EventListener)
watch(() => settingsStore.theme, applyTheme)

onMounted(async () => {
  await settingsStore.loadSettings()
  applyTheme()
  await modelStore.loadModels()
  if (documentStore.currentDocumentId) {
    await documentStore.loadDocument(documentStore.currentDocumentId).catch(() => {})
  }

  // Initialize prompt templates (writes builtins on first run)
  await promptTemplateStore.initTemplates()

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

  // Get current tab info and auto-extract on open (skip in window mode)
  if (!windowMode && browser?.runtime?.sendMessage) {
    browser.runtime
      .sendMessage({ type: 'GET_CURRENT_TAB' })
      .then((tab: any) => {
        if (tab) appStore.setActiveTab(tab)
        if (settingsStore.settings.capture.autoExtractOnOpen && tab?.id) {
          triggerAutoExtract(tab.id)
        }
      })
      .catch(() => {})

    // Context menu / keyboard command that fired while the panel was closed.
    browser.runtime
      .sendMessage({ type: 'GET_PENDING_ACTION' })
      .then((action: any) => {
        if (!action) return
        if (action.type === 'CAPTURE_PAGE' && action.tabId) triggerAutoExtract(action.tabId)
        if (action.type === 'OPEN_REVIEW') appStore.setCurrentView('review', { resetHistory: true })
        if (action.type === 'OMNIBOX_SEARCH') {
          window.dispatchEvent(new CustomEvent('auramind:omnibox', { detail: { query: action.query || '' } }))
        }
      })
      .catch(() => {})
  }
})

onUnmounted(() => {
  removeListener?.()
  window.removeEventListener('auramind:palette-action', onPaletteAction as EventListener)
})
</script>

<template>
  <div class="h-full w-full bg-[#FAFAFA] soft-shadow border border-zinc-200 overflow-hidden flex flex-col font-sans text-zinc-900 relative">
    <TopBar />
    <PageChangeHint v-show="appStore.currentView === 'workspace'" />

    <WorkspaceView v-show="appStore.currentView === 'workspace'" />
    <LibraryView v-if="appStore.currentView === 'library'" />
    <AnalysisView v-show="appStore.currentView === 'analysis'" />
    <FeedsView v-show="appStore.currentView === 'feeds'" />
    <ReviewView v-show="appStore.currentView === 'review'" />
    <CardManagerView v-show="appStore.currentView === 'cards'" />
    <WatchView v-show="appStore.currentView === 'watch'" />
    <InsightsView v-show="appStore.currentView === 'insights'" />
    <GraphView v-show="appStore.currentView === 'graph'" />
    <UsageView v-show="appStore.currentView === 'usage'" />
    <SettingsView v-show="appStore.currentView === 'settings'" />

    <Toaster />
    <CommandPalette />
    <ShortcutsHelp />
  </div>
</template>
