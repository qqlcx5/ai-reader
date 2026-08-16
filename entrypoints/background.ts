import { setupFeedAlarm, onFeedAlarm } from '@/services/feed/bg-refresh'
import { reclaimStaleJobs } from '@/services/ai-job/processor'
import { bgDrain } from '@/services/ai-job/bg-drain'
import { runSchedules } from '@/services/schedule/runner'
import { updateReviewBadge } from '@/services/review/badge'
import { saveQuickNote } from '@/services/capture/quick-note'
import { notify, setupNotificationClicks } from '@/services/notify/notify'
import type { AppView } from '@/stores/app.store'

export default defineBackground(() => {
  console.log('AuraMind background', { id: browser.runtime.id })

  const b = browser as any

  // Open the side panel across engines: Chrome uses `sidePanel.open({tabId})`,
  // Firefox uses `sidebarAction.open()` (no args, needs a user gesture — our
  // callers are all menu/command/click handlers, which qualify).
  function openSidebarPanel(tabId?: number): void {
    if (sidePanel && tabId != null) {
      sidePanel.open({ tabId }).catch(() => {})
    } else if (b.sidebarAction?.open) {
      b.sidebarAction.open().catch(() => {})
    }
  }

  // ── Pending panel actions ─────────────────────────────────────────────
  // Context menu / keyboard commands may fire while the side panel is not
  // open yet. The action is stashed here; the panel asks for it on mount.
  let pendingAction: { type: 'CAPTURE_PAGE' | 'OPEN_REVIEW' | 'OMNIBOX_SEARCH' | 'OPEN_VIEW'; tabId?: number; query?: string; view?: string } | null = null

  function runPanelAction(action: { type: 'CAPTURE_PAGE' | 'OPEN_REVIEW' | 'OMNIBOX_SEARCH' | 'OPEN_VIEW'; tabId?: number; query?: string; view?: string }, tabId?: number) {
    pendingAction = action
    const target = tabId ?? action.tabId
    if (target != null || b.sidebarAction) openSidebarPanel(target)
    // If the panel is already open it handles this directly.
    b.runtime.sendMessage({ type: action.type, payload: { tabId: target, query: action.query, view: action.view } }).catch(() => {})
  }

  // System notifications: clicking opens the panel on the relevant view.
  setupNotificationClicks(
    (tabId?: number) => openSidebarPanel(tabId),
    (view: AppView) => { pendingAction = { type: 'OPEN_REVIEW' }; pendingAction = viewToAction(view) },
  )
  function viewToAction(view: AppView): any {
    // Reuse the pending-action channel: any view is reachable via OMNIBOX-style
    // pending + direct message; simplest is a generic VIEW action.
    return { type: 'OPEN_VIEW', view } as any
  }
  const MENU_CLIP_PAGE = 'auramind-clip-page'
  const MENU_CLIP_SELECTION = 'auramind-clip-selection'

  function setupContextMenus() {
    if (!b.contextMenus) return
    b.contextMenus.removeAll(() => {
      b.contextMenus.create({ id: MENU_CLIP_PAGE, title: '剪藏此页面到 AuraMind', contexts: ['page'] })
      b.contextMenus.create({ id: MENU_CLIP_SELECTION, title: '保存选中文字到 AuraMind', contexts: ['selection'] })
    })
  }

  b.runtime.onInstalled?.addListener(() => { setupContextMenus() })
  b.runtime.onStartup?.addListener(() => { setupContextMenus() })
  setupContextMenus()

  b.contextMenus?.onClicked?.addListener((info: any, tab: any) => {
    if (info.menuItemId === MENU_CLIP_PAGE && tab?.id != null) {
      runPanelAction({ type: 'CAPTURE_PAGE', tabId: tab.id })
    }
    if (info.menuItemId === MENU_CLIP_SELECTION && info.selectionText) {
      saveQuickNote({
        selection: info.selectionText,
        pageUrl: info.pageUrl || tab?.url || '',
        pageTitle: tab?.title || '',
      }).catch((e: any) => console.warn('[bg] quick note failed:', e))
    }
  })

  // ── Keyboard commands ────────────────────────────────────────────────
  b.commands?.onCommand?.addListener((command: string) => {
    if (command === 'capture-page') {
      b.tabs.query({ active: true, currentWindow: true }, (tabs: any) => {
        const tab = tabs[0]
        if (tab?.id != null) runPanelAction({ type: 'CAPTURE_PAGE', tabId: tab.id })
      })
    }
    if (command === 'open-review') {
      b.tabs.query({ active: true, currentWindow: true }, (tabs: any) => {
        const tab = tabs[0]
        runPanelAction({ type: 'OPEN_REVIEW', tabId: tab?.id }, tab?.id)
      })
    }
  })

  // ── Omnibox: "am <query>" opens the side panel with the palette ────────
  const omnibox = b.omnibox || (globalThis as any).chrome?.omnibox
  omnibox?.setDefaultSuggestion?.({ description: '在 AuraMind 中搜索：%s' })
  omnibox?.onInputEntered?.addListener((text: string) => {
    pendingAction = { type: 'OMNIBOX_SEARCH', query: text } as any
    b.tabs.query({ active: true, currentWindow: true }, (tabs: any) => {
      const tabId = tabs[0]?.id
      if (tabId != null) openSidebarPanel(tabId)
      b.runtime.sendMessage({ type: 'OMNIBOX_SEARCH', payload: { query: text } }).catch(() => {})
    })
  })

  // Crash recovery: any job stuck in 'processing' from a prior SW lifetime
  // can never complete (its AbortController is gone). Flip to failed once.
  void reclaimStaleJobs()

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
      // Firefox fallback:
      if (!sidePanel) b.sidebarAction?.open?.().catch(() => {})
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
    if (message.type === 'GET_PENDING_ACTION') {
      sendResponse(pendingAction)
      pendingAction = null
      return false
    }

    if (message.type === 'FLOATING_OPEN') {
      if (sidePanel && _sender.tab?.id) {
        sidePanel.open({ tabId: _sender.tab.id }).catch(() => {})
      } else {
        b.sidebarAction?.open?.().catch(() => {})
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
      // Daily digest piggybacks on the feed cycle too.
      import('@/services/digest/daily').then(({ maybeRunDailyDigest }) =>
        maybeRunDailyDigest()
          .then((r) => {
            if (r.ran) notify('digest', 'AuraMind 每日简报已生成', '在记忆库查看今日晨报', 'library')
          })
          .catch((e: any) => console.warn('[bg] digest failed:', e)),
      )
      // Page-change watches piggyback as well; toast + system notification.
      import('@/services/watch/watch').then(({ checkAllWatches }) =>
        checkAllWatches()
          .then(async (changed) => {
            if (changed.length > 0) {
              b.runtime.sendMessage({
                type: 'WATCH_CHANGED',
                payload: { count: changed.length, title: changed[0].title },
              }).catch(() => {})
              notify(
                `watch-${Date.now()}`,
                'AuraMind 页面监控',
                changed.length > 1
                  ? `${changed.length} 个监控页面有更新：${changed[0].title} 等`
                  : `「${changed[0].title}」有更新`,
                'watch',
              )
              // Best-effort AI summaries for the changes (async, non-blocking).
              const { annotateLatestChange } = await import('@/services/watch/summarize')
              for (const w of changed) {
                annotateLatestChange(w).catch(() => {})
              }
            }
          })
          .catch((e: any) => console.warn('[bg] watch check failed:', e)),
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
