// ============================================================
// PageMind — Content Script (Lightweight Message Listener)
// ============================================================
// Only handles PING. Heavy extraction logic lives in extract.content.ts,
// injected via chrome.scripting.executeScript on demand.
//
// Generation Counter: zombie content scripts from old extension versions
// silently yield to the freshest injection.

import type { MessageResponse } from '@/messaging/types'

declare global {
  interface Window {
    __pageMindGeneration?: number
  }
}

// ---- Generation Counter (runs once per injection) ----
window.__pageMindGeneration = (window.__pageMindGeneration ?? 0) + 1
const myGeneration = window.__pageMindGeneration

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    chrome.runtime.onMessage.addListener(
      (message: { type: string; [k: string]: unknown }, _sender, sendResponse) => {
        if (window.__pageMindGeneration !== myGeneration) return false

        if (message.type === 'PING') {
          sendResponse({ success: true, data: true } satisfies MessageResponse<true>)
          return false
        }

        return false
      },
    )
  },
})
