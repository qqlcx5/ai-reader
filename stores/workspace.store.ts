import { defineStore } from 'pinia'
import { ref } from 'vue'

export type WorkspaceTab = 'capture' | 'preview'
export type ContextTab = 'markdown' | 'highlights' | 'raw' | 'metadata'
export type CaptureStatus = 'idle' | 'extracting' | 'ready' | 'cached' | 'failed' | 'stale'

export const useWorkspaceStore = defineStore('workspace', () => {
  const currentWorkspaceTab = ref<WorkspaceTab>('capture')
  const currentContextTab = ref<ContextTab>('markdown')
  const documentSource = ref<'current-page' | 'library'>('current-page')
  const isExtracting = ref(false)
  const captureStatus = ref<CaptureStatus>('idle')
  const showPageChangeHint = ref(false)

  function setWorkspaceTab(tab: WorkspaceTab) {
    currentWorkspaceTab.value = tab
  }

  function setContextTab(tab: ContextTab) {
    currentContextTab.value = tab
  }

  function setDocumentSource(source: 'current-page' | 'library') {
    documentSource.value = source
  }

  function setExtracting(extracting: boolean) {
    isExtracting.value = extracting
    if (extracting) {
      captureStatus.value = 'extracting'
    }
  }

  function setCaptureStatus(status: CaptureStatus) {
    captureStatus.value = status
  }

  return {
    currentWorkspaceTab,
    currentContextTab,
    documentSource,
    isExtracting,
    captureStatus,
    showPageChangeHint,
    setWorkspaceTab,
    setContextTab,
    setDocumentSource,
    setExtracting,
    setCaptureStatus,
  }
})
