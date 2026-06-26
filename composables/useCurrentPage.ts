// ============================================================
// PageMind — Current Page Detection Composable
// ============================================================
// Wraps messaging.getActiveTab() for reactive page metadata + validity checks.

import { ref, computed } from 'vue'
import { getActiveTab } from '@/messaging/client'
import type { PageMetadata } from '@/domain'

const RESTRICTED_PROTOCOLS = /^(chrome|chrome-extension|edge|about|moz-extension):\/\//

export function isRestrictedUrl(url: string): boolean {
  return RESTRICTED_PROTOCOLS.test(url)
}

export function useCurrentPage() {
  const page = ref<PageMetadata | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isRestricted = computed(() => {
    if (!page.value?.url) return false
    return isRestrictedUrl(page.value.url)
  })

  async function detect() {
    loading.value = true
    error.value = null
    try {
      const tab = await getActiveTab()
      page.value = {
        title: tab.title || '',
        url: tab.url || '',
        siteName: parseHostname(tab.url || ''),
        faviconUrl: undefined,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误'
      error.value = msg
      page.value = null
    } finally {
      loading.value = false
    }
  }

  return { page, loading, error, isRestricted, detect }
}

function parseHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}
