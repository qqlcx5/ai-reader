/**
 * "Open in window" feature: pop the app out into a standalone, resizable
 * popup window that mounts the same Vue app via /sidepanel.html?view=window.
 *
 * State is shared across the side panel and the window through IndexedDB +
 * persisted pinia state, so both views stay in sync on disk. Live reactive
 * state (e.g. an in-flight stream) does NOT sync across contexts — you're
 * expected to use one at a time.
 */

export const APP_WINDOW_ID_KEY = 'appWindowId'
const PAGE_PATH = '/sidepanel.html'

function api(): any {
  return (globalThis as any).browser ?? (globalThis as any).chrome
}

/** True when the current document is the popped-out window (not the side panel). */
export function isWindowMode(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return new URLSearchParams(window.location.search).get('view') === 'window'
  } catch {
    return false
  }
}

/**
 * Open the app in a standalone window. If one is already open, focus it
 * instead of spawning a duplicate (singleton behaviour).
 */
export async function openAppWindow(): Promise<void> {
  const b = api()
  if (!b?.windows?.create || !b?.runtime?.getURL) return

  // Focus an existing window if it's still around.
  try {
    const data = await b.storage.local.get(APP_WINDOW_ID_KEY)
    const existingId = data?.[APP_WINDOW_ID_KEY]
    if (existingId != null) {
      try {
        await b.windows.get(existingId) // throws if the window was closed
        await b.windows.update(existingId, { focused: true })
        return
      } catch {
        // stale id — fall through and create a fresh window
      }
    }
  } catch {
    // storage unavailable — ignore and create
  }

  const win = await b.windows.create({
    url: b.runtime.getURL(PAGE_PATH) + '?view=window',
    type: 'popup',
    width: 1180,
    height: 800,
  })

  if (win?.id != null) {
    try {
      await b.storage.local.set({ [APP_WINDOW_ID_KEY]: win.id })
    } catch {
      // ignore — singleton just won't persist across sidepanel reloads
    }
  }
}

/** Clear the tracked window id (used when the window is closed). */
export async function clearAppWindowId(): Promise<void> {
  const b = api()
  try {
    await b.storage.local.remove(APP_WINDOW_ID_KEY)
  } catch {
    // ignore
  }
}
