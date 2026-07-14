import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TabInfo } from '../types/message'
import { toast as toastService } from '@/utils/toast'

export type AppView = 'workspace' | 'library' | 'analysis' | 'settings' | 'usage' | 'feeds'

export const useAppStore = defineStore('app', () => {
  const currentView = ref<AppView>('workspace')
  const isLoading = ref(false)
  const toastMessage = ref('')
  const toastType = ref<'success' | 'error' | 'info'>('info')
  const activeTab = ref<TabInfo | null>(null)
  const showPageChangeHint = ref(false)

  // View history for back navigation (e.g. library → doc detail → back).
  const viewHistory = ref<AppView[]>([])
  const canGoBack = computed(() => viewHistory.value.length > 0)

  function setCurrentView(view: AppView, options: { resetHistory?: boolean } = {}) {
    if (view === currentView.value) {
      if (options.resetHistory) viewHistory.value = []
      return
    }
    if (options.resetHistory) {
      viewHistory.value = []
    } else {
      viewHistory.value.push(currentView.value)
    }
    currentView.value = view
  }

  /** Pop the previous view. Returns false when there is nowhere to go back to. */
  function goBack(): boolean {
    const prev = viewHistory.value.pop()
    if (prev === undefined) return false
    currentView.value = prev
    return true
  }

  function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    // 镜像状态保留，以便外部读 store.toastMessage 仍可工作
    toastMessage.value = message
    toastType.value = type
    // 真正显示由 vue-sonner 接管
    if (type === 'success') toastService.success(message)
    else if (type === 'error') toastService.error(message)
    else toastService.info(message)
  }

  function clearToast() {
    toastMessage.value = ''
    toastService.clear()
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
    viewHistory,
    canGoBack,
    setCurrentView,
    goBack,
    showToast,
    clearToast,
    setActiveTab,
    setLoading,
  }
})
