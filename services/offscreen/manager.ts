/**
 * Offscreen document manager — ensures a single offscreen document exists
 * for background-initiated DOM operations (feed parsing, HTML extraction).
 *
 * MV3 service workers can't use DOMParser. The offscreen document provides
 * a hidden DOM environment that persists until it's closed or goes idle.
 *
 * Firefox (MV2 persistent background page) already has DOMParser — messages
 * are handled locally there and offscreen is never created.
 */

import { parseFeed } from '@/services/feed/parser'
import { extractFromHtml } from '@/utils/content/extract'

const OFFSCREEN_URL = 'offscreen.html'

const browser: any = (globalThis as any).browser ?? (globalThis as any).chrome

let creating: Promise<void> | null = null

async function hasOffscreen(): Promise<boolean> {
  const existing = await browser.offscreen?.hasDocument?.()
  if (existing) return true
  // Fallback: check existing contexts
  try {
    const contexts = await browser.runtime?.getContexts?.({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
    })
    return Array.isArray(contexts) && contexts.length > 0
  } catch {
    return false
  }
}

export async function ensureOffscreen(): Promise<void> {
  if (await hasOffscreen()) return

  if (creating) {
    await creating
    return
  }

  creating = browser.offscreen
    .createDocument({
      url: OFFSCREEN_URL,
      reasons: ['DOM_PARSER', 'DOM_SCRAPING'],
      justification: 'Parse RSS feeds and extract article content in background without side panel',
    })
    .then(() => {
      console.log('[bg] offscreen document created')
    })
    .catch((e: any) => {
      console.warn('[bg] failed to create offscreen document:', e)
      throw e
    })
    .finally(() => {
      creating = null
    })

  await creating
}

/** Handle DOM-dependent messages in-process (Firefox persistent bg page). */
export async function handleLocally(message: any): Promise<any> {
  try {
    if (message.type === 'PARSE_FEED') {
      return { ok: true, feed: parseFeed(message.xml) }
    }
    if (message.type === 'EXTRACT_HTML') {
      const data = await extractFromHtml(message.html, message.url, message.meta || {})
      return { ok: true, data }
    }
    return null
  } catch (e: any) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Send a message to the offscreen document and await its response.
 * Returns null if the offscreen document can't be created or the message fails.
 */
export async function sendToOffscreen<T = any>(message: any): Promise<T | null> {
  // Firefox persistent background page: full DOM APIs, no offscreen needed.
  if (typeof DOMParser !== 'undefined') {
    return handleLocally(message)
  }
  try {
    await ensureOffscreen()
    const res = await browser.runtime.sendMessage(message)
    if (!res) {
      console.warn('[bg] offscreen returned empty for:', message?.type)
    } else if (!res.ok && res.error) {
      console.warn(`[bg] offscreen ${message?.type} error:`, res.error)
    }
    return res as T
  } catch (e) {
    console.warn('[bg] offscreen message failed:', message?.type, e)
    return null
  }
}
