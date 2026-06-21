/**
 * M8 RSS Pipeline — Scheduler
 *
 * Manages chrome.alarms-based periodic polling of RSS feeds.
 * Runs in the Background Service Worker context.
 *
 * Based on design-08-rss-pipeline.md §4.
 */

import type { RssFeed } from './types';
import { processFeed } from './fetcher';
import type { RssConfig } from './types';
import { loadRssFeeds, loadRssConfig } from './feed-store';

// ─── Alarm Constants ─────────────────────────────────────────────────

const ALARM_PREFIX = 'rss:';
const SCHEDULER_ALARM = 'rss-scheduler-check';

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Initialize the RSS scheduler.
 * Called once from the background service worker's init.
 *
 * 1. Load saved feeds and config
 * 2. Schedule alarms for all enabled feeds
 * 3. Listen for alarm events
 */
export async function initScheduler(): Promise<void> {
  // Only run in background context
  if (!chrome.alarms) return;

  const feeds = await loadRssFeeds();
  await scheduleAllFeeds(feeds);

  // Listen for alarm events
  chrome.alarms.onAlarm.addListener(handleAlarm);
}

/** Schedule alarms for all enabled feeds */
export async function scheduleAllFeeds(feeds: RssFeed[]): Promise<void> {
  if (!chrome.alarms) return;

  // Clear existing RSS alarms
  const allAlarms = await chrome.alarms.getAll();
  for (const alarm of allAlarms) {
    if (alarm.name.startsWith(ALARM_PREFIX) || alarm.name === SCHEDULER_ALARM) {
      await chrome.alarms.clear(alarm.name);
    }
  }

  for (const feed of feeds) {
    if (!feed.enabled) continue;
    await chrome.alarms.create(`${ALARM_PREFIX}${feed.id}`, {
      periodInMinutes: feed.intervalMinutes,
    });
  }

  // Also schedule a periodic config check
  await chrome.alarms.create(SCHEDULER_ALARM, {
    periodInMinutes: 60, // Check every hour for config changes
  });
}

/** Reschedule a single feed (after user updates interval) */
export async function rescheduleFeed(feed: RssFeed): Promise<void> {
  if (!chrome.alarms) return;

  await chrome.alarms.clear(`${ALARM_PREFIX}${feed.id}`);
  if (feed.enabled) {
    await chrome.alarms.create(`${ALARM_PREFIX}${feed.id}`, {
      periodInMinutes: feed.intervalMinutes,
    });
  }
}

/** Unschedule a feed (when disabled or removed) */
export async function unscheduleFeed(feedId: string): Promise<void> {
  if (!chrome.alarms) return;
  await chrome.alarms.clear(`${ALARM_PREFIX}${feedId}`);
}

// ─── Alarm Handler ───────────────────────────────────────────────────

async function handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  // Config refresh alarm
  if (alarm.name === SCHEDULER_ALARM) {
    const feeds = await loadRssFeeds();
    await scheduleAllFeeds(feeds);
    return;
  }

  // Feed polling alarm
  if (alarm.name.startsWith(ALARM_PREFIX)) {
    const feedId = alarm.name.slice(ALARM_PREFIX.length);
    const feeds = await loadRssFeeds();
    const feed = feeds.find((f) => f.id === feedId);
    if (feed && feed.enabled) {
      await processFeed(feed);
    }
  }
}
