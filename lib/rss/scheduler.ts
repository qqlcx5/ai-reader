/**
 * M8 — RSS feed scheduler.
 *
 * Uses `browser.alarms` to set up periodic alarms for each enabled RSS
 * feed. Each alarm fires as `rss:<feedId>`. When the alarm triggers, the
 * background service worker fetches the feed, deduplicates, optionally
 * summarizes, and writes new items to Dexie.
 */
import type { RssFeedRecord } from './types';

export const RSS_ALARM_PREFIX = 'rss:';

/** Minimum interval accepted by chrome.alarms (in minutes). */
const MIN_INTERVAL_MINUTES = 1;

/** Maximum number of RSS sources the extension will schedule. */
const MAX_FEEDS = 50;

/**
 * Schedule alarms for all enabled feeds.
 *
 * Clears existing RSS alarms first to handle feed additions/removals.
 * If a feed has no `refreshIntervalMinutes`, uses 360 (6 hours).
 */
export async function scheduleAllFeeds(feeds: RssFeedRecord[]): Promise<void> {
  const alarms = getAlarmsApi();
  if (!alarms) return;

  const enabled = feeds.filter((f) => f.enabled).slice(0, MAX_FEEDS);

  // Clear only RSS alarms (preserve other alarms like auto-backup).
  await clearRssAlarms(alarms);

  for (const feed of enabled) {
    const interval = Math.max(
      MIN_INTERVAL_MINUTES,
      feed.refreshIntervalMinutes ?? 360,
    );
    await alarms.create(`${RSS_ALARM_PREFIX}${feed.id}`, {
      periodInMinutes: interval,
    });
  }
}

/**
 * Clear all RSS alarms. Does NOT touch non-RSS alarms.
 */
export async function clearRssAlarms(
  alarms: AlarmsApi = getAlarmsApi()!,
): Promise<void> {
  if (!alarms) return;
  try {
    if (typeof alarms.clearAll === 'function') {
      // clearAll is only available in chrome.alarms; browser.alarms has
      // the same shape but let's be defensive.
      const allAlarms = typeof alarms.getAll === 'function'
        ? await alarms.getAll()
        : [];
      for (const alarm of allAlarms) {
        if (alarm.name.startsWith(RSS_ALARM_PREFIX)) {
          await alarms.clear(alarm.name);
        }
      }
    }
  } catch {
    // best-effort
  }
}

/**
 * Check if an alarm name is an RSS feed alarm, returning the feedId if so.
 */
export function parseRssAlarmName(name: string): string | null {
  if (name.startsWith(RSS_ALARM_PREFIX) && name.length > RSS_ALARM_PREFIX.length) {
    return name.slice(RSS_ALARM_PREFIX.length);
  }
  return null;
}

// ─── Alarm API abstraction (same pattern as M6 scheduler) ────────────

interface AlarmInfo {
  name: string;
}

interface AlarmsApi {
  create(name: string, options: { periodInMinutes: number }): Promise<void> | void;
  clear(name: string): Promise<boolean> | boolean;
  getAll?(): Promise<AlarmInfo[]> | AlarmInfo[];
  clearAll?(): Promise<void> | void;
}

function getAlarmsApi(): AlarmsApi | null {
  const candidates: unknown[] = [];
  if (typeof browser !== 'undefined') candidates.push(browser);
  if (typeof chrome !== 'undefined') candidates.push(chrome);
  for (const c of candidates) {
    if (!c || typeof c !== 'object') continue;
    const alarms = (c as Record<string, unknown>).alarms as Partial<AlarmsApi> | undefined;
    if (alarms && typeof alarms.create === 'function' && typeof alarms.clear === 'function') {
      return alarms as AlarmsApi;
    }
  }
  return null;
}
