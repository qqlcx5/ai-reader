/**
 * AI Reader content script.
 *
 * Runs in `ISOLATED` world on every page (WXT's default for
 * content scripts). Responsibilities:
 *
 *   1. Inject a small, draggable + closable floating button
 *      into the host page so the user can trigger capture.
 *   2. On click, send `CAPTURE_PAGE` to the background; the
 *      background then orchestrates defuddle via `sendToTab` and
 *      persists the result.
 *   3. Respond to background-initiated `CAPTURE_PAGE` requests
 *      with the extracted document (used by keyboard shortcuts /
 *      popup buttons that don't have direct access to the DOM).
 *
 * The button is namespaced under `ai-reader-*` so it never
 * clashes with the host page.
 */

import { defineContentScript } from '#imports'
import { extractPageContent } from '@core/capture/content-extractor'
import { sendMessageAsync } from '@shared/messaging/runtime-client'

const BUTTON_ID = 'ai-reader-floating-btn'
const BUTTON_HOST_ID = 'ai-reader-floating-host'
const STORAGE_KEY = 'ai_reader_floating_pos'
const VISIBLE_KEY = 'ai_reader_floating_visible'

export default defineContentScript({
  matches: ['<all_urls>'],
  // Run at document_idle so the page is mostly settled by the
  // time we extract. We don't need DOM_READY (defuddle wants a
  // full DOM but the extractor already waits for the page).
  runAt: 'document_idle',
  main() {
    // Don't run inside iframes — capture is per top-level page.
    if (window !== window.top) return

    mountFloatingButton()

    chrome.runtime.onMessage.addListener(
      (message: { type?: string; payload?: Record<string, unknown> }, _sender, sendResponse) => {
        if (message?.type === 'CAPTURE_PAGE') {
          // Background-driven capture: extract, return via
          // sendResponse. The button click uses a different path
          // (sends CAPTURE_PAGE upward and lets the background
          // orchestrate the round-trip), so we don't loop.
          extractPageContent(document, window.location.href, {}, { includeRawHtml: true })
            .then((result) => {
              sendResponse({
                success: true,
                data: { document: result.document, source: result.source },
              })
            })
            .catch((err: unknown) => {
              sendResponse({
                success: false,
                error: err instanceof Error ? err.message : String(err),
              })
            })
          return true
        }
        return false
      }
    )
  },
})

/* ---------------------------------------------------------------- *
 * Floating button
 * ---------------------------------------------------------------- */

function mountFloatingButton() {
  if (document.getElementById(BUTTON_HOST_ID)) return

  const host = document.createElement('div')
  host.id = BUTTON_HOST_ID
  host.setAttribute('data-ai-reader', 'floating-host')

  const shadow = host.attachShadow({ mode: 'open' })

  const wrapper = document.createElement('div')
  wrapper.className = 'ai-reader-fab'
  wrapper.innerHTML = `
    <button class="ai-reader-fab__btn" type="button" aria-label="Capture page with AI Reader" title="Capture page">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    </button>
    <button class="ai-reader-fab__close" type="button" aria-label="Hide button" title="Hide">×</button>
  `

  const style = document.createElement('style')
  style.textContent = `
    :host { all: initial; }
    .ai-reader-fab {
      position: fixed;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      user-select: none;
      touch-action: none;
    }
    .ai-reader-fab--hidden { display: none; }
    .ai-reader-fab__btn,
    .ai-reader-fab__close {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
      transition: transform 120ms ease, background 120ms ease;
      color: white;
    }
    .ai-reader-fab__btn {
      background: linear-gradient(135deg, #6366f1, #4f46e5);
    }
    .ai-reader-fab__close {
      background: rgba(15, 23, 42, 0.6);
      font-size: 20px;
      line-height: 1;
    }
    .ai-reader-fab__btn:hover { transform: scale(1.05); }
    .ai-reader-fab__btn:active { transform: scale(0.95); }
    .ai-reader-fab__btn--busy { background: #f59e0b !important; }
    .ai-reader-fab__btn--ok { background: #22c55e !important; }
    .ai-reader-fab__btn--err { background: #ef4444 !important; }
    .ai-reader-fab--dragging .ai-reader-fab__btn { cursor: grabbing; }
  `
  shadow.appendChild(style)
  shadow.appendChild(wrapper)

  // Restore last position / visibility.
  let position = readStoredPosition() || defaultPosition()
  let visible = readStoredVisibility()
  applyPosition(wrapper, position)
  if (!visible) wrapper.classList.add('ai-reader-fab--hidden')

  const btn = shadow.querySelector<HTMLButtonElement>('.ai-reader-fab__btn')!
  const closeBtn = shadow.querySelector<HTMLButtonElement>('.ai-reader-fab__close')!

  // --- Drag support ---
  let dragState: { startX: number; startY: number; origLeft: number; origTop: number } | null = null
  let didDrag = false
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    const rect = wrapper.getBoundingClientRect()
    dragState = {
      startX: e.clientX,
      startY: e.clientY,
      origLeft: rect.left,
      origTop: rect.top,
    }
    didDrag = false
    wrapper.classList.add('ai-reader-fab--dragging')
    wrapper.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent) => {
    if (!dragState) return
    const dx = e.clientX - dragState.startX
    const dy = e.clientY - dragState.startY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag = true
    const left = clamp(dragState.origLeft + dx, 8, window.innerWidth - 8 - wrapper.offsetWidth)
    const top = clamp(dragState.origTop + dy, 8, window.innerHeight - 8 - wrapper.offsetHeight)
    wrapper.style.left = `${left}px`
    wrapper.style.top = `${top}px`
    wrapper.style.right = 'auto'
    wrapper.style.bottom = 'auto'
    position = { left, top }
  }
  const onPointerUp = (e: PointerEvent) => {
    if (!dragState) return
    try { wrapper.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
    wrapper.classList.remove('ai-reader-fab--dragging')
    if (didDrag) {
      // Save new position
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(position))
      } catch {
        /* ignore quota */
      }
    }
    dragState = null
  }
  wrapper.addEventListener('pointerdown', onPointerDown)
  wrapper.addEventListener('pointermove', onPointerMove)
  wrapper.addEventListener('pointerup', onPointerUp)
  wrapper.addEventListener('pointercancel', onPointerUp)

  // --- Click → trigger capture ---
  btn.addEventListener('click', async (e) => {
    e.preventDefault()
    if (didDrag) {
      didDrag = false
      return
    }
    btn.classList.add('ai-reader-fab__btn--busy')
    try {
      // Hand off to background — it will orchestrate the full
      // round-trip (extraction via sendToTab → persist → side
      // panel → index notify).
      sendMessageAsync({ type: 'CAPTURE_PAGE', payload: {} })
      btn.classList.remove('ai-reader-fab__btn--busy')
      btn.classList.add('ai-reader-fab__btn--ok')
      setTimeout(() => btn.classList.remove('ai-reader-fab__btn--ok'), 1200)
    } catch (err) {
      console.warn('[ai-reader] capture trigger failed', err)
      btn.classList.remove('ai-reader-fab__btn--busy')
      btn.classList.add('ai-reader-fab__btn--err')
      setTimeout(() => btn.classList.remove('ai-reader-fab__btn--err'), 1500)
    }
  })

  // --- Close button ---
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    wrapper.classList.add('ai-reader-fab--hidden')
    try {
      sessionStorage.setItem(VISIBLE_KEY, '0')
    } catch {
      /* ignore quota */
    }
  })

  // --- Restore command (sent by background if user re-enables
  // the button from options) ---
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'AI_READER_SHOW_BUTTON') {
      wrapper.classList.remove('ai-reader-fab--hidden')
      try { sessionStorage.setItem(VISIBLE_KEY, '1') } catch { /* ignore */ }
    }
    return false
  })

  document.documentElement.appendChild(host)
}

function defaultPosition() {
  return {
    left: Math.max(8, window.innerWidth - 8 - 100),
    top: Math.max(8, window.innerHeight - 8 - 100),
  }
}

function applyPosition(el: HTMLElement, pos: { left: number; top: number }) {
  el.style.left = `${pos.left}px`
  el.style.top = `${pos.top}px`
  el.style.right = 'auto'
  el.style.bottom = 'auto'
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function readStoredPosition(): { left: number; top: number } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { left?: number; top?: number }
    if (typeof parsed.left === 'number' && typeof parsed.top === 'number') {
      return { left: parsed.left, top: parsed.top }
    }
  } catch {
    /* ignore */
  }
  return null
}

function readStoredVisibility(): boolean {
  try {
    return sessionStorage.getItem(VISIBLE_KEY) !== '0'
  } catch {
    return true
  }
}
