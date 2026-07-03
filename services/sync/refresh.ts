import { getActivePinia } from 'pinia'
import { useDocumentStore } from '@/stores/document.store'
import { useModelStore } from '@/stores/model.store'
import { useCollectionStore } from '@/stores/collection.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useFeedStore } from '@/stores/feed.store'
import { useChatStore } from '@/stores/chat.store'
import { initSearchIndex } from '@/services/search'

/**
 * Reload every store + the search index after a bulk DB change (WebDAV sync,
 * JSON import). Sync/import write directly to IndexedDB, so the in-memory
 * store refs — which drive the UI — must be reloaded or the change is invisible.
 *
 * Safe to call without an active Pinia instance (e.g., in tests): silently no-ops.
 */
export async function refreshAfterDataChange(): Promise<void> {
  if (!getActivePinia()) return

  const documentStore = useDocumentStore()
  const modelStore = useModelStore()
  const collectionStore = useCollectionStore()
  const settingsStore = useSettingsStore()
  const feedStore = useFeedStore()
  const chatStore = useChatStore()
  await Promise.all([
    documentStore.refreshDocuments(),
    modelStore.loadModels(),
    collectionStore.loadCollections(),
    settingsStore.loadSettings(),
    feedStore.loadFeeds(),
    initSearchIndex(),
  ])
  // chatStore has no full-reload API (conversations are per-document).
  // Reset in-memory state so the user doesn't see stale conversations
  // after import/sync. The per-document list will reload when the user
  // next clicks a document in LibraryView.
  chatStore.resetState()
}
