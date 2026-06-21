/**
 * M8 RSS Pipeline — Extension Badge
 *
 * Updates the Chrome extension toolbar icon badge with unread
 * RSS item count. Shows up to 99; displays "99+" for overflow.
 *
 * Based on design-08-rss-pipeline.md §7.
 */

import { getUnreadCount } from './feed-store';

// ─── Constants ───────────────────────────────────────────────────────

const BADGE_COLOR = '#EF4444'; // Tailwind red-500
const BADGE_COLOR_DIM = '#9CA3AF'; // Tailwind gray-400

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Update the extension toolbar badge with the current unread count.
 * Call after any operation that changes read/unread state.
 */
export async function updateBadge(): Promise<void> {
  if (!chrome.action) return;

  try {
    const unreadCount = await getUnreadCount();

    if (unreadCount > 0) {
      const display = unreadCount > 99 ? '99+' : String(unreadCount);
      await chrome.action.setBadgeText({ text: display });
      await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }
  } catch (err) {
    console.error('[RSS Badge] Failed to update badge:', err);
  }
}

/**
 * Clear the badge (e.g., when all items are read or RSS is disabled).
 */
export async function clearBadge(): Promise<void> {
  if (!chrome.action) return;

  try {
    await chrome.action.setBadgeText({ text: '' });
  } catch {
    // Ignore
  }
}

/**
 * Show a dimmed badge indicating RSS is enabled but no unread items.
 */
export async function showIdleBadge(): Promise<void> {
  if (!chrome.action) return;

  try {
    await chrome.action.setBadgeText({ text: '●' });
    await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_DIM });
  } catch {
    // Ignore
  }
}
