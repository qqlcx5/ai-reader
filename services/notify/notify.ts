/**
 * System notifications for background events (page-watch changes, daily
 * digest). Fire-and-forget; requires the 'notifications' permission (added).
 *
 * Clicking a notification opens the side panel via the pending-action
 * mechanism so the relevant view is shown even when the panel was closed.
 */
import type { AppView } from '@/stores/app.store'

const browserApi: any = (globalThis as any).browser ?? (globalThis as any).chrome

export function notify(
  id: string,
  title: string,
  message: string,
  target?: AppView,
): void {
  try {
    browserApi?.notifications?.create?.(`auramind-${id}`, {
      type: 'basic',
      iconUrl: browserApi?.runtime?.getURL?.('/icon/128.png') || '/icon/128.png',
      title,
      message,
    })
    if (target) {
      // Remember where a notification click should land; the background's
      // click handler routes it through the pending-action flow.
      browserApi?.storage?.local?.set?.({ [`notify-target-${id}`]: target }).catch?.(() => {})
    }
  } catch (e) {
    console.warn('[bg] notification failed:', e)
  }
}

/** Wire notification clicks: open the side panel on the stored target view. */
export function setupNotificationClicks(openPanel: (tabId?: number) => void, setPending: (view: AppView) => void): void {
  try {
    browserApi?.notifications?.onClicked?.addListener?.((notificationId: string) => {
      const key = `notify-target-${notificationId.replace('auramind-', '')}`
      browserApi?.storage?.local?.get?.(key).then((stored: any) => {
        const target = (stored?.[key] as AppView) || undefined
        if (target) setPending(target)
        browserApi?.storage?.local?.remove?.(key).catch?.(() => {})
        browserApi?.tabs?.query?.({ active: true, currentWindow: true }, (tabs: any[]) => {
          openPanel(tabs?.[0]?.id)
        })
      }).catch(() => {
        browserApi?.tabs?.query?.({ active: true, currentWindow: true }, (tabs: any[]) => {
          openPanel(tabs?.[0]?.id)
        })
      })
    })
  } catch (e) {
    console.warn('[bg] notification click wiring failed:', e)
  }
}
