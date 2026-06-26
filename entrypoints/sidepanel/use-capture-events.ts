/**
 * Side-panel side-effects for capture events.
 *
 * The background fires `CAPTURE_COMPLETE` after it has persisted
 * a freshly-captured document. This composable subscribes once
 * at mount, switches the active tab to "chat" (where the
 * captured document is most useful), and emits a Vue ref so the
 * ChatPage can pick the document up.
 */

import { onMounted, onBeforeUnmount, ref } from 'vue'
import { onMessage } from '@shared/messaging/runtime-client'
import type { CapturedDocument } from '@db/schema'

export interface CaptureEvents {
  /** Most recent captured document (or null). */
  currentDocument: typeof currentDocument
  /** Increment every time a new capture completes. */
  captureCount: typeof captureCount
  /** Switch the active side-panel tab. */
  setActiveTab: (tab: string) => void
}

const currentDocument = ref<CapturedDocument | null>(null)
const captureCount = ref(0)

export function useCaptureEvents(opts: {
  initialTab: string
  preferredTabOnCapture?: string
} = { initialTab: 'chat' }) {
  const activeTab = ref<string>(opts.initialTab)
  const preferred = opts.preferredTabOnCapture ?? 'chat'

  let dispose: (() => void) | null = null

  onMounted(() => {
    dispose = onMessage('CAPTURE_COMPLETE', (message) => {
      const doc = (message.payload as { document?: CapturedDocument } | undefined)
        ?.document
      if (doc) {
        currentDocument.value = doc
        captureCount.value += 1
        activeTab.value = preferred
      }
      return false
    })
  })

  onBeforeUnmount(() => {
    dispose?.()
  })

  return {
    activeTab,
    currentDocument,
    captureCount,
  }
}
