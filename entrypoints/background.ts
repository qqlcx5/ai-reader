/**
 * AI Reader Service Worker.
 *
 * Acts as the central router for every message flowing between
 * the popup, side panel, content scripts, and the Capture
 * pipeline. The background also owns:
 *
 *   - chrome.action / chrome.sidePanel entrypoints
 *   - the active side-panel tab tracking
 *   - wiring the capture pipeline (defuddle → repository → index
 *     notification → side panel)
 *
 * The previous version of this file predated the perception /
 * search split, so its `CAPTURE_PAGE` handler is replaced with
 * one that delegates to `@core/capture/capture.service`. All
 * other existing routes are preserved unchanged.
 */

import { defineBackground } from '#imports'
import { db } from '@db/index'
import { captureCurrentTab } from '@core/capture/capture.service'
import { documentRepository } from '@core/documents/document.repository'
import { searchService } from '@core/search/search.service'
// Side-effect import: registers the search worker's factory on
// `globalThis` so `search.service` can lazily instantiate it.
import '@core/search/worker-entrypoint'
import {
  onMessage,
  sendMessageAsync,
  broadcast,
  sendToTab,
} from '@shared/messaging/runtime-client'
import {
  streamChat,
  AbortRegistry,
} from '@core/chat/chat.service'
import type { CapturedDocument } from '@db/schema'

export default defineBackground(() => {
  console.log('AI Reader background service worker started')

  // Keep track of active side panel tabs
  const activeSidePanelTabs = new Set<number>()
  // Per-session abort controllers; one per in-flight stream.
  const chatAbortRegistry = new AbortRegistry()

  // Handle extension icon click - open side panel
  chrome.action.onClicked.addListener(async (tab) => {
    if (tab.id) {
      try {
        await chrome.sidePanel.open({ tabId: tab.id })
        activeSidePanelTabs.add(tab.id)
      } catch (err) {
        console.error('Failed to open side panel:', err)
      }
    }
  })

  // ----------------------------------------------------------------
  // Search service
  // ----------------------------------------------------------------
  // Boot the worker + initial index build. `start()` is async but
  // we don't await it — the service handles all routing via the
  // message protocol and replies to SEARCH_QUERY / INDEX_READY
  // as soon as the index is ready.
  void searchService.start()
  // Reflect the service's status into the store-facing
  // GET_INDEX_STATUS request. The background owns this channel
  // because side panels expect a synchronous reply.
  onMessage('GET_INDEX_STATUS', async (_message, _sender, sendResponse) => {
    const status = searchService.getIndexStatus()
    sendResponse({ success: true, data: status })
  })
  // The service listens to UPSERT_DOCUMENT / REMOVE_DOCUMENT
  // itself; we don't need to re-subscribe here. The
  // `DELETE_DOCUMENT` handler below also calls
  // `searchService.removeDocument` so the index drops the entry
  // before the REMOVE_DOCUMENT broadcast reaches the rest of
  // the extension.

  // ----------------------------------------------------------------
  // Capture pipeline
  // ----------------------------------------------------------------

  // Triggered by the content-script floating button (or popup).
  // We delegate to captureCurrentTab which does the round-trip
  // with the content script, persists the result, and opens the
  // side panel.
  onMessage('CAPTURE_PAGE', async (message, sender, sendResponse) => {
    try {
      const tab = sender.tab
      if (!tab?.id) {
        sendResponse({ success: false, error: 'No active tab' })
        return
      }
      const { documentId, document } = await captureCurrentTab(tab.id)
      sendResponse({ success: true, data: { documentId, document } })
    } catch (err) {
      console.error('[background] CAPTURE_PAGE failed:', err)
      sendResponse({
        success: false,
        error: err instanceof Error ? err.message : 'Capture failed',
      })
    }
  })

  // Called by capture.service after it has the document and
  // saved it. The side panel uses this to refresh.
  onMessage('CAPTURE_COMPLETE', async (message, _sender, sendResponse) => {
    try {
      const { document } = message.payload as { document: CapturedDocument }
      // Capture.service already persisted; this is a safety net
      // in case a peer context (e.g. content script) sends the
      // message directly without going through the service.
      const id = await documentRepository.put(document)
      broadcastToSidePanels({ type: 'CAPTURE_COMPLETE', payload: { document: { ...document, id } } })
      sendResponse({ success: true, data: { id } })
    } catch (err) {
      sendResponse({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to save document',
      })
    }
  })

  // ----------------------------------------------------------------
  // Document CRUD
  // ----------------------------------------------------------------

  onMessage('GET_CURRENT_DOCUMENT', async (message, _sender, sendResponse) => {
    try {
      const { documentId } = (message.payload || {}) as { documentId?: string }
      let doc: CapturedDocument | undefined
      if (documentId) {
        doc = await documentRepository.get(documentId)
      } else {
        // Most recent document.
        const all = await documentRepository.listAll()
        doc = all[0]
      }
      sendResponse({ success: true, data: doc })
    } catch (err) {
      sendResponse({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to get current document',
      })
    }
  })

  onMessage('GET_DOCUMENTS', async (message, _sender, sendResponse) => {
    try {
      const { limit = 100, offset = 0 } = (message.payload || {}) as { limit?: number; offset?: number }
      const documents = await db.documents.limit(limit).offset(offset).toArray()
      const count = await db.documents.count()
      sendResponse({ success: true, data: { documents, count } })
    } catch (err) {
      sendResponse({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to get documents',
      })
    }
  })

  onMessage('DELETE_DOCUMENT', async (message, _sender, sendResponse) => {
    try {
      const { id } = message.payload as { id: string }
      await db.documents.delete(id)
      await db.chatHistories.where('documentId').equals(id).delete()
      // Drop from the search index and notify all contexts.
      searchService.removeDocument(id)
      broadcast({ type: 'REMOVE_DOCUMENT', payload: { documentId: id } })
      sendResponse({ success: true })
    } catch (err) {
      sendResponse({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete document',
      })
    }
  })

  // ----------------------------------------------------------------
  // Side panel
  // ----------------------------------------------------------------

  onMessage('OPEN_SIDE_PANEL', async (message, _sender, sendResponse) => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      const activeTab = tabs[0]
      if (activeTab?.id) {
        await chrome.sidePanel.open({ tabId: activeTab.id })
        activeSidePanelTabs.add(activeTab.id)
        const { documentId } = (message.payload || {}) as { documentId?: string }
        if (documentId) {
          await chrome.storage.local.set({ ai_reader_open_doc: documentId })
        }
      }
      sendResponse({ success: true })
    } catch (err) {
      sendResponse({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to open side panel',
      })
    }
  })

  // ----------------------------------------------------------------
  // Search query routing. The background owns the message
  // channel and delegates the actual work to the search
  // service. This keeps the `sendResponse` contract clean:
  // exactly one listener replies to the requester.
  // ----------------------------------------------------------------

  onMessage('SEARCH_QUERY', async (message, _sender, sendResponse) => {
    try {
      const { query, limit } = (message.payload || {}) as {
        query: string
        limit?: number
      }
      const results = await searchService.query(query, limit)
      sendResponse({ success: true, data: results })
    } catch (err) {
      sendResponse({
        success: false,
        error: err instanceof Error ? err.message : 'Search failed',
      })
    }
  })

  // ----------------------------------------------------------------
  // Search-worker / index notifications
  // ----------------------------------------------------------------

  // Notification of a new index being ready (from the search
  // worker when it spins up). We just log it for now.
  onMessage('INDEX_READY', async (message, _sender, sendResponse) => {
    const { documentCount } = (message.payload || {}) as { documentCount?: number }
    console.log(`[background] INDEX_READY (${documentCount ?? '?'} docs)`)
    sendResponse({ success: true })
  })

  // ----------------------------------------------------------------
  // Chat (Chat with Doc)
  // ----------------------------------------------------------------

  /**
   * Start a streaming chat completion against the chosen model
   * for a given document. The response is returned synchronously
   * (with the new historyId / messageIds) and the actual deltas
   * are forwarded to the side panel via CHAT_STREAM_DELTA /
   * CHAT_STREAM_DONE / CHAT_STREAM_ERROR.
   */
  onMessage('START_CHAT', async (message, _sender, sendResponse) => {
    try {
      const { documentId, question, modelId, historyId } = message.payload as {
        documentId: string
        question: string
        modelId?: string
        historyId?: string
      }
      if (!documentId || !question) {
        sendResponse({ success: false, error: 'documentId and question are required' })
        return
      }
      // The registry assigns a signal per session; the
      // AbortController is reused for back-to-back messages on
      // the same session so the prior request is cancelled.
      const signal = historyId
        ? chatAbortRegistry.create(historyId)
        : new AbortController().signal
      try {
        const result = await streamChat({
          documentId,
          question,
          modelId,
          historyId,
          signal,
        })
        if (historyId) chatAbortRegistry.release(historyId)
        sendResponse({ success: true, data: result })
      } catch (err) {
        if (historyId) chatAbortRegistry.release(historyId)
        const msg = err instanceof Error ? err.message : String(err)
        // The service has already emitted a CHAT_STREAM_ERROR
        // message; we just need to surface the failure to the
        // caller's promise.
        sendResponse({ success: false, error: msg })
      }
    } catch (err) {
      sendResponse({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to start chat',
      })
    }
  })

  /**
   * Cancel the in-flight stream for a given historyId.
   */
  onMessage('ABORT_CHAT', async (message, _sender, sendResponse) => {
    const { sessionId } = (message.payload || {}) as { sessionId: string }
    if (!sessionId) {
      sendResponse({ success: false, error: 'sessionId required' })
      return
    }
    const aborted = chatAbortRegistry.abort(sessionId)
    sendResponse({ success: true, data: { aborted } })
  })

  // ----------------------------------------------------------------
  // Cross-context commands (used by tests / dev tooling)
  // ----------------------------------------------------------------

  onMessage('PING', async (_message, _sender, sendResponse) => {
    sendResponse({ success: true, data: { pong: Date.now() } })
  })

  // ----------------------------------------------------------------
  // Tab lifecycle
  // ----------------------------------------------------------------

  chrome.tabs.onRemoved.addListener((tabId) => {
    activeSidePanelTabs.delete(tabId)
  })

  // Helper to broadcast to all side panels.
  function broadcastToSidePanels(message: Parameters<typeof sendToTab>[1]) {
    activeSidePanelTabs.forEach((tabId) => {
      try {
        sendToTab(tabId, message).catch(() => {
          // tab may not have a listener; that's fine
        })
      } catch {
        /* ignore */
      }
    })
  }
})
