// ============================================================
// PageMind — Background Service Worker (Message Router)
// ============================================================

import { browser } from 'wxt/browser'
import type { ExtractResult } from '@/domain'
import { AppError } from '@/domain'

// Chrome-specific sidePanel API (not in webextension-polyfill)
declare const chrome: {
  sidePanel: {
    setPanelBehavior: (opts: { openPanelOnActionClick: boolean }) => Promise<void>
  }
  runtime: {
    onMessage: {
      addListener: (callback: (...args: any[]) => any) => void
    }
    id?: string
  }
  tabs: {
    query: (queryInfo: any) => Promise<any[]>
    sendMessage: (tabId: number, message: any) => Promise<any>
  }
  scripting: {
    executeScript: (details: any) => Promise<any>
  }
}

export default defineBackground(() => {
  console.log('PageMind background', { id: browser.runtime.id })

  // Use Chrome native API for side panel
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err: Error) => console.warn('sidePanel behavior error:', err))

  // ---- Message Router ----
  chrome.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: (response: any) => void) => {
    switch (message.type) {
      case 'GET_ACTIVE_TAB':
        handleGetActiveTab(sendResponse)
        return true // keep channel open for async sendResponse

      case 'EXTRACT_PAGE':
        handleExtractPage(message.tabId as number, sendResponse)
        return true

      case 'PING':
        sendResponse({ success: true, data: true })
        return false

      case 'COPY_MARKDOWN':
        handleCopyMarkdown(message.text as string, sendResponse)
        return true

      default:
        return false
    }
  })
})

// ---- Handlers ----

async function handleGetActiveTab(
  sendResponse: (response: any) => void
) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab || !tab.url) {
      sendResponse({ success: false, error: '未找到当前页面' })
      return
    }
    sendResponse({
      success: true,
      data: { tabId: tab.id!, url: tab.url, title: tab.title ?? '' },
    })
  } catch (err) {
    sendResponse({ success: false, error: String(err) })
  }
}

async function handleExtractPage(
  tabId: number,
  sendResponse: (response: any) => void
) {
  try {
    // Defensive: fallback to active tab if tabId is invalid
    let targetTabId = tabId
    if (!targetTabId || targetTabId < 1) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) {
        sendResponse({ success: false, error: '无法获取当前标签页' })
        return
      }
      targetTabId = tab.id
    }
    // 1. 确保轻量 Content Script 已注入并就绪
    let ready = false
    try {
      const pingRes = await chrome.tabs.sendMessage(targetTabId, { type: 'PING' })
      ready = pingRes?.success === true
    } catch {
      // Content Script 未注入，尝试注入
    }

    if (!ready) {
      await injectContentScript(targetTabId)
    }

    // 2. 注入 Extract Content Script（含 defuddle 完整提取逻辑）
    await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      files: ['content-scripts/extract.js'],
    })

    // 等待 Extract Content Script 就绪
    for (let i = 0; i < 10; i++) {
      try {
        const res = await chrome.tabs.sendMessage(targetTabId, { type: 'EXTRACT_PAGE' })
        sendResponse(res)
        return
      } catch {
        // 尚未就绪，继续等待
      }
      await new Promise((r) => setTimeout(r, 100))
    }
    throw new Error('Extract Content Script 注入后未就绪')
  } catch (err) {
    sendResponse({ success: false, error: String(err) })
  }
}

async function handleCopyMarkdown(
  text: string,
  sendResponse: (response: any) => void
) {
  try {
    await navigator.clipboard.writeText(text)
    sendResponse({ success: true, data: undefined })
  } catch {
    sendResponse({ success: false, error: '剪贴板复制失败' })
  }
}

/**
 * 注入 Content Script 并等待就绪（Ping-based 就绪检测）
 */
async function injectContentScript(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content-scripts/content.js'],
  })

  // 轮询等待 Content Script 就绪
  for (let i = 0; i < 8; i++) {
    try {
      const res = await chrome.tabs.sendMessage(tabId, { type: 'PING' })
      if (res?.success) return
    } catch {
      // 尚未就绪，继续等待
    }
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error('Content Script 注入后未就绪')
}
