import { defineContentScript } from 'wxt/utils/define-content-script'
import Defuddle from 'defuddle'
import { extractPage, sanitizeHtml } from '@/utils/content/extract'

export default defineContentScript({
  matches: ['*://*/*'],

  main() {
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
    browser.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: any) => {
      if (message.type === 'EXTRACT_PAGE') {
        const url = window.location.href
        const rawHtml = document.documentElement.outerHTML
        const sanitized = sanitizeHtml(rawHtml)

        extractPage(document, url, Defuddle).then((data) => {
          sendResponse({
            type: 'PAGE_EXTRACTED',
            payload: {
              ...data,
              sanitizedHtml: sanitized,
            },
          })
        })

        return true // keep channel open for async sendResponse
      }
    })
  },
})
