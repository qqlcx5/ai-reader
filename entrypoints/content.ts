import { defineContentScript } from 'wxt/utils/define-content-script'
import { extractPage, cleanFullHtml } from '@/utils/content/extract'
import { createApp } from 'vue'
import PageFloatingAssistant from '@/components/common/PageFloatingAssistant.vue'

export default defineContentScript({
  matches: ['*://*/*'],

  main() {
    if (document.getElementById('auramind-floating-assistant')) return
    const host = document.createElement('div')
    host.id = 'auramind-floating-assistant'
    Object.assign(host.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      pointerEvents: 'none',
    })
    document.documentElement.appendChild(host)
    createApp(PageFloatingAssistant).mount(host)

    let lastUrl = window.location.href

    function notifyPageUpdated(): void {
      browser.runtime
        .sendMessage({
          type: 'PAGE_UPDATED',
          payload: {
            url: window.location.href,
            title: document.title,
          },
        })
        .catch(() => {})
    }

    // Intercept history.pushState
    const origPushState: typeof history.pushState = history.pushState.bind(history)
    history.pushState = function (...args: Parameters<typeof history.pushState>) {
      origPushState(...args)
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href
        notifyPageUpdated()
      }
    }

    // Intercept history.replaceState
    const origReplaceState: typeof history.replaceState = history.replaceState.bind(history)
    history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
      origReplaceState(...args)
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href
        notifyPageUpdated()
      }
    }

    // Listen for popstate (back/forward navigation)
    window.addEventListener('popstate', () => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href
        notifyPageUpdated()
      }
    })

    // Handle EXTRACT_PAGE request from background
    // Aligned with obsidian-clipper's "getPageContent" pattern:
    //   - No DOMPurify on full HTML (strips too much — images, tables, etc.)
    //   - Manual cleaning: remove <script>/<style>, strip style attributes,
    //     resolve relative URLs to absolute (obsidian-clipper pattern)
    browser.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: any) => {
      if (message.type === 'EXTRACT_PAGE') {
        const url = window.location.href

        extractPage(document, url).then((data) => {
          // Clean full HTML obsidian-clipper style (no DOMPurify)
          const sanitizedHtml = cleanFullHtml(document)

          sendResponse({
            type: 'PAGE_EXTRACTED',
            payload: {
              ...data,
              sanitizedHtml,
            },
          })
        }).catch((err: Error) => {
          sendResponse({
            type: 'EXTRACT_ERROR',
            payload: { error: err.message || 'Failed to extract page' },
          })
        })

        return true // keep channel open for async sendResponse
      }

      if (message.type === 'EXTRACT_YOUTUBE') {
        extractYouTubeTranscript()
          .then((payload) => sendResponse({ type: 'YOUTUBE_TRANSCRIPT', payload }))
          .catch((err: Error) => {
            sendResponse({
              type: 'EXTRACT_ERROR',
              payload: { error: err.message || 'Failed to extract transcript' },
            })
          })
        return true
      }
    })
  },
})

// ── YouTube transcript extraction ─────────────────────────────────────

/** Extract the balanced JSON object following `ytInitialPlayerResponse =`. */
function minePlayerResponseJson(): any | null {
  for (const script of Array.from(document.querySelectorAll('script'))) {
    const text = script.textContent || ''
    const marker = text.indexOf('ytInitialPlayerResponse')
    if (marker === -1) continue
    const start = text.indexOf('{', marker)
    if (start === -1) continue
    // Brace-counting scan respecting strings to find the object end.
    let depth = 0
    let inString = false
    let escaped = false
    for (let i = start; i < text.length; i++) {
      const ch = text[i]
      if (inString) {
        if (escaped) escaped = false
        else if (ch === '\\') escaped = true
        else if (ch === '"') inString = false
        continue
      }
      if (ch === '"') inString = true
      else if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(start, i + 1))
          } catch {
            break // malformed — try the next script tag
          }
        }
      }
    }
  }
  return null
}

interface YtCaptionTrack {
  baseUrl: string
  languageCode?: string
  kind?: string
}

async function extractYouTubeTranscript(): Promise<any> {
  const player = minePlayerResponseJson()
  if (!player) throw new Error('页面上找不到播放器数据（可能不是视频页）')

  const details = player.videoDetails || {}
  const tracks: YtCaptionTrack[] =
    player.captions?.playerCaptionsTracklistRenderer?.captionTracks || []
  if (tracks.length === 0) throw new Error('这个视频没有可用的字幕')

  // Prefer Chinese, then any manual (non-ASR) track, then the first track.
  const track =
    tracks.find((t) => (t.languageCode || '').startsWith('zh')) ||
    tracks.find((t) => t.kind !== 'asr') ||
    tracks[0]

  const sep = track.baseUrl.includes('?') ? '&' : '?'
  const res = await fetch(`${track.baseUrl}${sep}fmt=json3`, { credentials: 'omit' })
  if (!res.ok) throw new Error(`字幕下载失败：HTTP ${res.status}`)
  const json: any = await res.json()

  return {
    details: {
      videoId: details.videoId || '',
      title: details.title || document.title || '',
      author: details.author,
      lengthSeconds: details.lengthSeconds ? Number(details.lengthSeconds) : undefined,
      description: details.shortDescription,
    },
    events: (json.events || []).map((e: any) => ({
      tStartMs: e.tStartMs,
      dDurationMs: e.dDurationMs,
      segs: e.segs,
    })),
  }
}
