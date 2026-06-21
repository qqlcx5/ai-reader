/**
 * M8 — Badge updater.
 *
 * Queries unread RSS items count and sets the extension icon badge.
 * Uses the `browser.action` API (Chrome MV3 / Firefox).
 */
import { getDb } from '@/modules/storage/db';

const MAX_BADGE = 99;
const BADGE_COLOR = '#EF4444';

/**
 * Update the extension icon badge with the number of unread RSS items.
 *
 * Badge text is empty when there are no unread items, and capped at
 * "99+" when the count exceeds the displayable range.
 */
export async function updateBadge(): Promise<number> {
  const db = getDb();
  const unreadCount = await db.rssItems.where('isRead').equals(0).count();

  const text = unreadCount > 0 ? String(Math.min(unreadCount, MAX_BADGE)) : '';
  const displayCount = unreadCount > MAX_BADGE ? `${MAX_BADGE}+` : text;

  try {
    const action = getActionApi();
    if (action) {
      await action.setBadgeText({ text: displayCount });
      await action.setBadgeBackgroundColor({ color: BADGE_COLOR });
    }
  } catch {
    // best-effort — badge update is non-critical
  }

  return unreadCount;
}

// ─── browser.action abstraction ─────────────────────────────────────────

interface ActionApi {
  setBadgeText(details: { text: string }): Promise<void> | void;
  setBadgeBackgroundColor(details: { color: string }): Promise<void> | void;
}

function getActionApi(): ActionApi | null {
  const candidates: unknown[] = [];
  if (typeof browser !== 'undefined') candidates.push(browser);
  if (typeof chrome !== 'undefined') candidates.push(chrome);
  for (const c of candidates) {
    if (!c || typeof c !== 'object') continue;
    const action = (c as Record<string, unknown>).action as Partial<ActionApi> | undefined;
    if (action && typeof action.setBadgeText === 'function') {
      return action as ActionApi;
    }
  }
  return null;
}
