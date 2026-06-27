import { ref } from 'vue'
import type { PageMetadata } from '@/shared/domain'

export function useCurrentPage() {
  const metadata = ref<PageMetadata>({
    title: '',
    url: '',
    siteName: '',
    author: '',
    publishedAt: '',
    description: '',
    faviconUrl: '',
    lang: '',
  })
  const isLoading = ref(false)

  async function fetchCurrentPage() {
    isLoading.value = true
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) return
      metadata.value.url = tab.url ?? ''
      metadata.value.title = tab.title ?? ''
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'GET_PAGE_METADATA' })
      if (response) {
        metadata.value = { ...metadata.value, ...response }
      }
    } catch {
      // Content script may not be injected
    } finally {
      isLoading.value = false
    }
  }

  return { metadata, isLoading, fetchCurrentPage }
}
