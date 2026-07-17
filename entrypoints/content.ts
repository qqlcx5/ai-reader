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
    })
  },
})
