/**
 * Capture service.
 *
 * The glue between the content script, persistence, the search
 * index, and the side panel. The high-level flow is:
 *
 *   1. Ask the content script of `tabId` to extract the page.
 *   2. Hand the result to `documentRepository.put()`.
 *   3. Broadcast `UPSERT_DOCUMENT` so the search worker can pick
 *      it up.
 *   4. Open the side panel on `tabId` (no-op if it was already
 *      open).
 *   5. Return the document id to the caller.
 *
 * Why this lives outside `entrypoints/background.ts`:
 *   - It keeps the WXT entrypoint small and focused on message
 *     routing.
 *   - It can be unit tested without spinning up a Service Worker
 *     — we just inject mocks for `sendToTab`, the repository, and
 *     the messaging helpers.
 */

import type { CapturedDocument } from '@db/schema'
import { documentRepository } from '@core/documents/document.repository'
import { sendToTab, broadcast, sendMessageAsync } from '@shared/messaging/runtime-client'
import { extractPageContent } from './content-extractor'
import { CaptureError } from './types'

/** Injected for tests so we can stub `chrome.sidePanel.open`. */
export interface CaptureDeps {
  /** Sends a message to a content script. Defaults to `sendToTab`. */
  sendToTab?: typeof sendToTab
  /** Persists a document and returns its id. Defaults to `documentRepository.put`. */
  putDocument?: (doc: CapturedDocument) => Promise<string>
  /** Broadcasts to all listeners (used for the search worker). */
  notifyIndex?: (documentId: string) => void
  /** Opens the side panel for the captured tab. */
  openSidePanel?: (tabId: number) => Promise<void>
}

const defaultDeps: Required<CaptureDeps> = {
  sendToTab,
  putDocument: (doc) => documentRepository.put(doc),
  notifyIndex: (documentId) => {
    // Search worker isn't running yet, so just broadcast.
    broadcast({ type: 'UPSERT_DOCUMENT', payload: { documentId } })
  },
  openSidePanel: async (tabId) => {
    try {
      await chrome.sidePanel.open({ tabId })
    } catch (err) {
      // On Firefox the sidePanel API is `browser.sidebar` — we
      // deliberately swallow so the capture still succeeds.
      if (typeof console !== 'undefined') {
        console.warn('[perception] chrome.sidePanel.open failed:', err)
      }
    }
  },
}

/**
 * Capture the current page in `tabId`.
 *
 * Returns the document id (also persisted in IndexedDB).
 */
export async function captureCurrentTab(
  tabId: number,
  deps: CaptureDeps = {}
): Promise<{ documentId: string; document: CapturedDocument }> {
  const d: Required<CaptureDeps> = { ...defaultDeps, ...deps }

  if (!Number.isInteger(tabId) || tabId < 0) {
    throw new CaptureError(`Invalid tabId: ${tabId}`)
  }

  // 1) Trigger content script to extract.
  let response
  try {
    response = await d.sendToTab<typeof CAPTURE_PAGE_REQUEST, {
      success: boolean
      data?: { document: CapturedDocument; source: 'defuddle' | 'fallback' }
      error?: string
    }>(tabId, { type: 'CAPTURE_PAGE', payload: {} })
  } catch (err) {
    throw new CaptureError(
      `Failed to reach content script for tab ${tabId}: ${err instanceof Error ? err.message : String(err)}`,
      err
    )
  }

  if (!response?.success || !response.data?.document) {
    throw new CaptureError(
      response?.error || 'Content script returned no document'
    )
  }

  const document = response.data.document

  // 2) Persist to IndexedDB.
  let documentId: string
  try {
    documentId = await d.putDocument(document)
  } catch (err) {
    throw new CaptureError(
      `Failed to persist captured document: ${err instanceof Error ? err.message : String(err)}`,
      err
    )
  }

  // 3) Notify the search worker / any other listeners.
  try {
    d.notifyIndex(documentId)
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[perception] notifyIndex failed:', err)
    }
  }

  // 4) Open side panel (best-effort).
  try {
    await d.openSidePanel(tabId)
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[perception] openSidePanel failed:', err)
    }
  }

  // 5) Also fire a CAPTURE_COMPLETE so the side panel can refresh.
  //    We use sendMessageAsync so a non-listening panel doesn't
  //    block us.
  sendMessageAsync({
    type: 'CAPTURE_COMPLETE',
    payload: { document: { ...document, id: documentId } },
  })

  return { documentId, document: { ...document, id: documentId } }
}

/**
 * For tests: extract a page from a `Document` object directly,
 * without any tab messaging. Useful for unit-testing the
 * extractor in isolation.
 */
export async function captureFromDocument(
  source: Document,
  url: string,
  deps: CaptureDeps = {}
): Promise<{ documentId: string; document: CapturedDocument }> {
  const d: Required<CaptureDeps> = { ...defaultDeps, ...deps }
  const result = await extractPageContent(source, url, {}, { includeRawHtml: true })
  const documentId = await d.putDocument(result.document)
  try {
    d.notifyIndex(documentId)
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[perception] notifyIndex failed:', err)
    }
  }
  return { documentId, document: { ...result.document, id: documentId } }
}

// Type used in the sendToTab generic above. Kept as a literal so
// the dts stays self-contained.
const CAPTURE_PAGE_REQUEST = 'CAPTURE_PAGE' as const
