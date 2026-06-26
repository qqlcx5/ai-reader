/**
 * Pinia store for the local search layer.
 *
 * The store is intentionally thin: it never talks to the
 * search worker directly. All work is delegated to the
 * background script through the existing message protocol
 * (`SEARCH_QUERY`, `INDEX_READY`, etc.), so the side panel
 * never has to deal with the worker lifecycle.
 *
 * The store also subscribes once at construction time to the
 * `INDEX_READY` broadcast so the user sees a fresh "N
 * documents indexed" badge whenever the worker finishes (re)-
 * building.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SearchResult } from '@db/schema'
import { sendMessage, onMessage } from '@shared/messaging/runtime-client'
import { SEARCH_RESULTS_LIMIT } from '@shared/constants'

export const useSearchStore = defineStore('search', () => {
  // ---- State ----
  const query = ref('')
  const results = ref<SearchResult[]>([])
  const isSearching = ref(false)
  const error = ref<string | null>(null)
  const searchHistory = ref<string[]>([])
  const indexStatus = ref<'idle' | 'indexing' | 'ready' | 'error'>('idle')
  const indexSize = ref(0)
  const hasActiveSubscription = ref(false)

  // ---- Getters ----
  const hasResults = computed(() => results.value.length > 0)
  const isEmpty = computed(
    () =>
      query.value.length > 0 &&
      results.value.length === 0 &&
      !isSearching.value &&
      indexStatus.value === 'ready'
  )

  // ---- Internal ----
  function ensureSubscription(): void {
    if (hasActiveSubscription.value) return
    hasActiveSubscription.value = true
    onMessage('INDEX_READY', (message) => {
      const { documentCount } = (message.payload || {}) as { documentCount?: number }
      indexStatus.value = 'ready'
      if (typeof documentCount === 'number') indexSize.value = documentCount
      return false
    })
  }

  // ---- Actions ----
  async function search(queryStr: string, limit = SEARCH_RESULTS_LIMIT) {
    ensureSubscription()
    query.value = queryStr
    isSearching.value = true
    error.value = null
    results.value = []

    try {
      const response = await sendMessage('SEARCH_QUERY', {
        query: queryStr,
        limit,
      })
      if (response?.success) {
        results.value = (response.data as SearchResult[]) || []
      } else {
        error.value = response?.error || 'Search failed'
      }

      // Add to history (dedup, cap at 20).
      const trimmed = queryStr.trim()
      if (trimmed && !searchHistory.value.includes(trimmed)) {
        searchHistory.value.unshift(trimmed)
        if (searchHistory.value.length > 20) {
          searchHistory.value = searchHistory.value.slice(0, 20)
        }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Search failed'
    } finally {
      isSearching.value = false
    }
  }

  /**
   * Pull the current index status. Called once on Search page
   * mount; live updates come through the `INDEX_READY` event.
   */
  async function refreshIndexStatus() {
    ensureSubscription()
    try {
      const res = await sendMessage('GET_INDEX_STATUS', {})
      if (res?.success && res.data) {
        const data = res.data as { ready?: boolean; documentCount?: number }
        indexStatus.value = data.ready ? 'ready' : 'indexing'
        if (typeof data.documentCount === 'number') indexSize.value = data.documentCount
      }
    } catch (err) {
      // Non-fatal — leave the previous status in place.
      if (typeof console !== 'undefined') {
        console.warn('[search.store] refreshIndexStatus failed:', err)
      }
    }
  }

  function clearSearch() {
    query.value = ''
    results.value = []
    error.value = null
  }

  function clearHistory() {
    searchHistory.value = []
  }

  return {
    // state
    query,
    results,
    isSearching,
    error,
    searchHistory,
    indexStatus,
    indexSize,
    // getters
    hasResults,
    isEmpty,
    // actions
    search,
    refreshIndexStatus,
    clearSearch,
    clearHistory,
  }
})
