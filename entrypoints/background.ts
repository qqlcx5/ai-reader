import { setupFeedAlarm, onFeedAlarm } from '@/services/feed/bg-refresh'
import { reclaimStaleJobs } from '@/services/ai-job/processor'
import { bgDrain } from '@/services/ai-job/bg-drain'
import { runSchedules } from '@/services/schedule/runner'
import { updateReviewBadge } from '@/services/review/badge'

export default defineBackground(() => {
  console.log('AuraMind background', { id: browser.runtime.id })

  // Crash recovery: any job stuck in 'processing' from a prior SW lifetime
  // can never complete (its AbortController is gone). Flip to failed once.
  void reclaimStaleJobs()

  const b = browser as any

  // Clear the tracked app-window id when that window closes (singleton cleanup).
  b.windows?.onRemoved?.addListener(() => {
    b.storage?.local?.remove('appWindowId').catch(() => {})
  })

  // Side Panel: open on action click
  const sidePanel = b.sidePanel || (globalThis as any).chrome?.sidePanel
  if (sidePanel) {
    sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err: Error) => {
      console.warn('sidePanel behavior error:', err)
    })
  }

  // Tab activated: reopen side panel + broadcast TAB_ACTIVATED
  b.tabs.onActivated.addListener((activeInfo: any) => {
    // Reopen side panel on the new tab to keep it visible across tab switches
    if (sidePanel) {
      sidePanel.open({ tabId: activeInfo.tabId }).catch(() => {})
    }
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
    if (message.type === 'FLOATING_OPEN') {
      if (sidePanel && _sender.tab?.id) {
        sidePanel.open({ tabId: _sender.tab.id }).catch(() => {})
      }
      sendResponse({ ok: true })
      return true
    }

    if (message.type === 'FLOATING_CAPTURE') {
      const tabId = _sender.tab?.id
      if (!tabId) {
        sendResponse({ ok: false, message: '无法识别当前标签页' })
        return true
      }
      b.runtime.sendMessage({ type: 'FLOATING_CAPTURE', payload: { tabId } }).catch(() => {})
      sendResponse({ ok: true })
      return true
    }

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

    if (message.type === 'EXTRACT_YOUTUBE') {
      const { tabId } = message.payload
      b.tabs
        .sendMessage(tabId, { type: 'EXTRACT_YOUTUBE' })
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

  // RSS periodic refresh — runs entirely in background via offscreen document.
  // No longer depends on the side panel being open.
  const FEED_ALARM = 'feed-refresh'
  const SCHEDULE_ALARM = 'schedule-tick'
  function setupScheduleAlarm() {
    b.alarms?.create(SCHEDULE_ALARM, { periodInMinutes: 1 }).catch(() => {})
  }
  b.runtime.onInstalled?.addListener(() => { setupFeedAlarm(); setupScheduleAlarm(); updateReviewBadge() })
  b.runtime.onStartup?.addListener(() => { setupFeedAlarm(); setupScheduleAlarm(); updateReviewBadge() })
  setupFeedAlarm()
  setupScheduleAlarm()
  updateReviewBadge().catch(() => {})
  b.alarms?.onAlarm?.addListener((alarm: any) => {
    if (alarm?.name === FEED_ALARM) {
      onFeedAlarm()
      // Newsletter inbox piggybacks on the feed cycle.
      import('@/services/inbox/inbox').then(({ pollInbox }) =>
        pollInbox().catch((e: any) => console.warn('[bg] inbox poll failed:', e)),
      )
      // Keep the due-review badge fresh.
      updateReviewBadge().catch(() => {})
      // After feed refresh may have enqueued new jobs, try a lightweight drain.
      bgDrain().catch((e: any) => console.warn('[bg] post-feed drain failed:', e))
    }
    if (alarm?.name === SCHEDULE_ALARM) {
      runSchedules().catch((e: any) => console.warn('[bg] schedule tick failed:', e))
      // Schedule runs may also enqueue jobs; give them a chance to process.
      bgDrain().catch((e: any) => console.warn('[bg] post-schedule drain failed:', e))
    }
  })

  // Panel can request an immediate refresh (e.g. on open if stale)
  b.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: any) => {
    if (message?.type === 'REVIEW_QUEUE_CHANGED') {
      updateReviewBadge()
        .then((count) => sendResponse({ ok: true, count }))
        .catch(() => sendResponse({ ok: false }))
      return true // async
    }

    if (message?.type === 'TRIGGER_INBOX_POLL') {
      import('@/services/inbox/inbox')
        .then(({ pollInbox }) => pollInbox())
        .then((result) => sendResponse({ ok: !result.error, ...result }))
        .catch((e: any) => sendResponse({ ok: false, error: e?.message || 'inbox poll failed' }))
      return true // async
    }

    if (message?.type === 'TRIGGER_FEED_REFRESH') {
      import('@/services/feed/bg-refresh').then(({ refreshAllFeeds }) => {
        refreshAllFeeds().then((results) => {
          const totalNew = results.reduce((s: number, r: any) => s + r.newItems, 0)
          const totalCollected = results.reduce((s: number, r: any) => s + r.collected, 0)
          sendResponse({ ok: true, totalNew, totalCollected })
        }).catch((e: any) => {
          sendResponse({ ok: false, error: e?.message || 'refresh failed' })
        })
      })
      return true // async
    }

    // Panel requests batch collection of a feed's uncollected items
    if (message?.type === 'COLLECT_FEED_ITEMS') {
      const { feedId } = message
      import('@/services/feed/bg-refresh').then(({ collectFeedItems }) => {
        collectFeedItems(feedId).then((result) => {
          sendResponse({ ok: true, collected: result.collected, total: result.total, failed: result.failed, items: result.items })
        }).catch((e: any) => {
          sendResponse({ ok: false, error: e?.message || 'collect failed' })
        })
      })
      return true // async
    }
  })
})
