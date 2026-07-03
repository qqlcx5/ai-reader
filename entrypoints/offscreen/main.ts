/**
 * Offscreen document — provides a DOM environment for background-initiated
 * RSS feed parsing and article extraction, without depending on the side panel
 * being open.
 *
 * Message protocol (all messages have a `type` field):
 *
 *   INCOMING (background → offscreen):
 *     { type: 'PARSE_FEED', xml: string }
 *       → { ok: true, feed: ParsedFeed } | { ok: false, error: string }
 *     { type: 'EXTRACT_HTML', html: string, url: string, meta: object }
 *       → { ok: true, data: ExtractedPageData } | { ok: false, error: string }
 *     { type: 'PING' }
 *       → { ok: true }
 *
 *   The offscreen doc also handles its own lifecycle: it closes itself after
 *   5 minutes of inactivity to avoid lingering.
 */

import { parseFeed } from '@/services/feed/parser'
import { extractFromHtml } from '@/utils/content/extract'
import type { ParsedFeed } from '@/services/feed/parser'
import type { ExtractedPageData } from '@/utils/content/extract'

const IDLE_TIMEOUT_MS = 5 * 60 * 1000
let idleTimer: ReturnType<typeof setTimeout> | null = null

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    console.log('[offscreen] idle timeout, closing')
    window.close()
  }, IDLE_TIMEOUT_MS)
}

// The browser global inside offscreen documents is `chrome` (MV3).
// WXT polyfills `browser` for content scripts but offscreen docs run as
// normal pages — use whichever is available.
const runtime = (globalThis as any).browser?.runtime ?? (globalThis as any).chrome?.runtime

runtime?.onMessage.addListener(
  (message: any, _sender: any, sendResponse: (response: any) => void) => {
    if (!message?.type) return

    resetIdleTimer()

    switch (message.type) {
      case 'PING':
        sendResponse({ ok: true })
        return false

      case 'PARSE_FEED': {
        try {
          const feed: ParsedFeed = parseFeed(message.xml)
          sendResponse({ ok: true, feed })
        } catch (e) {
          sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) })
        }
        return false
      }

      case 'EXTRACT_HTML': {
        const { html, url, meta } = message
        extractFromHtml(html, url, meta || {})
          .then((data: ExtractedPageData) => {
            sendResponse({ ok: true, data })
          })
          .catch((e: any) => {
            sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) })
          })
        return true // async response
      }

      default:
        return false
    }
  },
)

resetIdleTimer()
console.log('[offscreen] ready')
