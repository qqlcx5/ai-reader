export default defineBackground(() => {
  console.log('AuraMind background', { id: browser.runtime.id })

  const b = browser as any

  // Side Panel: open on action click
  const sidePanel = b.sidePanel || (globalThis as any).chrome?.sidePanel
  if (sidePanel) {
    sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err: Error) => {
      console.warn('sidePanel behavior error:', err)
    })
  }

  // Tab activated: broadcast TAB_ACTIVATED
  b.tabs.onActivated.addListener((activeInfo: any) => {
    b.tabs.get(activeInfo.tabId, (tab: any) => {
      if (b.runtime.lastError || !tab) return
      b.runtime
        .sendMessage({
          type: 'TAB_ACTIVATED',
          payload: {
            tab: {
              id: tab.id,
              url: tab.url,
              title: tab.title,
              favIconUrl: tab.favIconUrl,
            },
          },
        })
        .catch(() => {})
    })
  })

  // Tab updated: broadcast TAB_UPDATED when page completes loading
  b.tabs.onUpdated.addListener((_tabId: any, changeInfo: any, tab: any) => {
    if (changeInfo.status === 'complete' && tab.url) {
      b.runtime
        .sendMessage({
          type: 'TAB_UPDATED',
          payload: {
            tab: {
              id: tab.id,
              url: tab.url,
              title: tab.title,
              favIconUrl: tab.favIconUrl,
            },
          },
        })
        .catch(() => {})
    }
  })

  // Handle getCurrentTab request
  b.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: any) => {
    if (message.type === 'GET_CURRENT_TAB') {
      b.tabs.query({ active: true, currentWindow: true }, (tabs: any) => {
        const tab = tabs[0]
        sendResponse(
          tab
            ? { id: tab.id, url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl }
            : null,
        )
      })
      return true // keep channel open for async response
    }

    if (message.type === 'EXTRACT_PAGE') {
      const { tabId } = message.payload
      b.tabs
        .sendMessage(tabId, { type: 'EXTRACT_PAGE' })
        .then((result: any) => {
          sendResponse(result)
        })
        .catch((err: Error) => {
          sendResponse({
            type: 'EXTRACT_ERROR',
            payload: { error: err.message || 'Failed to send message to tab' },
          })
        })
      return true // keep channel open for async response
    }
  })
})
