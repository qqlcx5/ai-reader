import { useDocumentStore } from '@/stores/document.store'
import { useModelStore } from '@/stores/model.store'
import { useCollectionStore } from '@/stores/collection.store'
import { useSettingsStore } from '@/stores/settings.store'
import { initSearchIndex } from '@/services/search'

/**
 * Reload every store + the search index after a bulk DB change (WebDAV sync,
 * JSON import). Sync/import write directly to IndexedDB, so the in-memory
 * store refs — which drive the UI — must be reloaded or the change is invisible.
 */
export async function refreshAfterDataChange(): Promise<void> {
  const documentStore = useDocumentStore()
  const modelStore = useModelStore()
  const collectionStore = useCollectionStore()
  const settingsStore = useSettingsStore()
  await Promise.all([
    documentStore.refreshDocuments(),
    modelStore.loadModels(),
    collectionStore.loadCollections(),
    settingsStore.loadSettings(),
    initSearchIndex(),
  ])
}
