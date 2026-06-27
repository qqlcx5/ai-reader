import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { TabInfo } from '../types/message'

export type AppView = 'workspace' | 'library' | 'settings'

export const useAppStore = defineStore('app', () => {
  const currentView = ref<AppView>('workspace')
  const isLoading = ref(false)
  const toastMessage = ref('')
  const toastType = ref<'success' | 'error' | 'info'>('info')
  const activeTab = ref<TabInfo | null>(null)
  const showPageChangeHint = ref(false)

  function setCurrentView(view: AppView) {
    currentView.value = view
  }

  function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    toastMessage.value = message
    toastType.value = type
  }

  function clearToast() {
    toastMessage.value = ''
  }

  function setActiveTab(tab: TabInfo) {
    activeTab.value = tab
  }

  function setLoading(loading: boolean) {
    isLoading.value = loading
  }

  return {
    currentView,
    isLoading,
    toastMessage,
    toastType,
    activeTab,
    showPageChangeHint,
    setCurrentView,
    showToast,
    clearToast,
    setActiveTab,
    setLoading,
  }
})
