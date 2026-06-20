import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { getProvider } from '@/utils/llm';
import type { ProviderConfig, ProviderSettings } from '@/utils/llm/types';
import {
  parseRSS,
  truncateText,
  titlesSimilar,
  buildSummaryPrompt,
  buildTagExtractPrompt,
  parseTagResponse,
  migrateFeed,
  type RSSFeedConfig,
  type RSSDigestItem,
  type RSSGlobalSettings,
  DEFAULT_GLOBAL_SETTINGS,
} from '@/utils/rss';

const STREAM_IDLE_TIMEOUT = 120_000;
const RSS_ALARM_NAME = 'rss-fetch';
const RSS_FETCH_CHECK_INTERVAL_MINUTES = 5;

export default defineBackground(() => {
  // Open side panel when extension icon is clicked
  browser.action.onClicked.addListener((tab) => {
    if (tab.id) {
      browser.sidePanel.open({ tabId: tab.id });
    }
  });

  // --- RSS Alarm Setup ---
  browser.alarms.create(RSS_ALARM_NAME, { periodInMinutes: RSS_FETCH_CHECK_INTERVAL_MINUTES });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === RSS_ALARM_NAME) {
      checkAndFetchFeeds().catch((e) => console.error('RSS fetch error:', e));
    }
  });

  // --- RSS Message Handler ---
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.action === 'rss-refresh') {
      checkAndFetchFeeds(true).catch((e) => console.error('RSS refresh error:', e));
      sendResponse({ ok: true });
      return false;
    }

    if (message?.action === 'rss-refresh-feed') {
      refreshSingleFeed(message.feedId).catch((e) => console.error('RSS refresh feed error:', e));
      sendResponse({ ok: true });
      return false;
    }

    if (message?.action === 'rss-retry-summary') {
      const { digestId } = message;
      retrySummary(digestId).catch((e) => console.error('RSS retry summary error:', e));
      sendResponse({ ok: true });
      return false;
    }

    if (message?.action === 'extractContent') {
      browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        if (tabs[0]?.id) {
          browser.tabs.sendMessage(tabs[0].id, message).then(sendResponse).catch((e) => {
            sendResponse({
              error: 'extraction_failed',
              message: e instanceof Error ? e.message : '无法提取页面内容，请刷新页面后重试',
            });
          });
        } else {
          sendResponse({
            error: 'no_active_tab',
            message: '没有活动标签页，请打开一个网页后重试',
          });
        }
      });
      return true; // async response
    }
  });

  // Keyboard shortcuts
  if (browser.commands) {
    browser.commands.onCommand.addListener(async (command) => {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab?.id) return;

      switch (command) {
        case 'summarize':
          browser.runtime.sendMessage({ action: 'shortcut', command: 'summarize' }).catch(() => {});
          break;
        case 'toggle-panel':
          browser.sidePanel.open({ tabId: tab.id });
          break;
        case 'abort-all':
          browser.runtime.sendMessage({ action: 'shortcut', command: 'abort-all' }).catch(() => {});
          break;
      }
    });
  }

  // Port-based streaming for LLM requests
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== 'llm-stream') return;

    port.onMessage.addListener((msg) => {
      if (msg.action === 'start') {
        const { providerId, config, prompt } = msg as {
          providerId: string;
          config: ProviderConfig;
          prompt: string;
        };

        const controller = new AbortController();
        let idleTimer: ReturnType<typeof setTimeout> | null = null;

        function resetIdleTimer() {
          if (idleTimer) clearTimeout(idleTimer);
          idleTimer = setTimeout(() => {
            try {
              port.postMessage({
                type: 'error',
                error: { type: 'network', message: '响应超时，请检查网络或稍后重试' },
              });
            } catch {}
            controller.abort();
            port.disconnect();
          }, STREAM_IDLE_TIMEOUT);
        }

        function clearIdleTimer() {
          if (idleTimer) {
            clearTimeout(idleTimer);
            idleTimer = null;
          }
        }

        resetIdleTimer();

        const provider = getProvider(providerId);
        provider.stream(config, {
          prompt,
          signal: controller.signal,
          onDelta: (text) => {
            resetIdleTimer();
            try { port.postMessage({ type: 'delta', text }); } catch {}
          },
          onDone: () => {
            clearIdleTimer();
            try { port.postMessage({ type: 'done' }); } catch {}
          },
          onError: (err) => {
            clearIdleTimer();
            try { port.postMessage({ type: 'error', error: err }); } catch {}
          },
        });

        port.onDisconnect.addListener(() => {
          clearIdleTimer();
          controller.abort();
        });
      }

      if (msg.action === 'abort') {
        port.disconnect();
      }
    });
  });

  // --- RSS Fetching Logic ---

  async function loadFeedsWithMigration(): Promise<RSSFeedConfig[]> {
    const data = await browser.storage.local.get('ai-reader-rss-feeds');
    const feeds = (data['ai-reader-rss-feeds'] as RSSFeedConfig[]) || [];
    return feeds.map((f) => migrateFeed(f));
  }

  async function loadGlobalSettings(): Promise<RSSGlobalSettings> {
    const data = await browser.storage.local.get('ai-reader-rss-settings');
    const settings = data['ai-reader-rss-settings'] as RSSGlobalSettings | undefined;
    return { ...DEFAULT_GLOBAL_SETTINGS, ...(settings || {}) };
  }

  async function checkAndFetchFeeds(force = false) {
    const feeds = await loadFeedsWithMigration();
    const globalSettings = await loadGlobalSettings();
    const enabledFeeds = feeds.filter((f) => f.enabled);
    const now = Date.now();

    for (const feed of enabledFeeds) {
      const intervalMs = (feed.fetchIntervalMinutes || globalSettings.fetchIntervalMinutes || 30) * 60 * 1000;
      const due = force || !feed.lastFetchedAt || now - feed.lastFetchedAt >= intervalMs;
      if (!due) continue;
      try {
        await fetchFeed(feed, globalSettings);
      } catch (e) {
        console.error(`Failed to fetch feed ${feed.url}:`, e);
        await updateFeedMeta(feed, feed.lastItemGuid, e instanceof Error ? e.message : String(e));
      }
    }
  }

  async function refreshSingleFeed(feedId: string) {
    const feeds = await loadFeedsWithMigration();
    const feed = feeds.find((f) => f.id === feedId);
    if (!feed || !feed.enabled) return;
    const globalSettings = await loadGlobalSettings();
    try {
      await fetchFeed(feed, globalSettings);
    } catch (e) {
      console.error(`Failed to fetch feed ${feed.url}:`, e);
      await updateFeedMeta(feed, feed.lastItemGuid, e instanceof Error ? e.message : String(e));
    }
  }

  async function fetchFeed(feed: RSSFeedConfig, globalSettings: RSSGlobalSettings) {
    const response = await fetch(feed.url, {
      headers: { 'Accept': 'application/rss+xml, application/xml, text/xml, */*' },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const xml = await response.text();
    const parsed = parseRSS(xml);
    if (parsed.items.length === 0) {
      await updateFeedMeta(feed, feed.lastItemGuid || '');
      return;
    }

    // Auto name from feed title if enabled
    if (feed.autoName && (!feed.name || feed.name === feed.url) && parsed.title) {
      await updateFeedName(feed, parsed.title);
      feed.name = parsed.title;
    }

    // Find new items (guid != lastItemGuid)
    const lastGuid = feed.lastItemGuid;
    let newItems = parsed.items;
    if (lastGuid) {
      const lastIdx = parsed.items.findIndex((item) => item.guid === lastGuid);
      if (lastIdx >= 0) {
        newItems = parsed.items.slice(0, lastIdx);
      }
    }

    // Take up to maxItemsPerFetch newest items
    const maxItems = feed.maxItemsPerFetch || globalSettings.defaultMaxItemsPerFeed || 3;
    newItems = newItems.slice(0, maxItems);
    if (newItems.length === 0) {
      await updateFeedMeta(feed, parsed.items[0].guid);
      return;
    }

    // Get settings for provider config
    const settingsData = await browser.storage.local.get('ai-reader-settings');
    const settings = settingsData['ai-reader-settings'] as ProviderSettings | undefined;
    if (!settings?.enabledProviders?.length) {
      await updateFeedMeta(feed, newItems[0].guid);
      return;
    }

    const providerId = settings.enabledProviders[0];
    const config: ProviderConfig | undefined = settings.providers?.[providerId];
    if (!config || (!config.apiKey && providerId !== 'ollama')) {
      await updateFeedMeta(feed, newItems[0].guid);
      return;
    }

    // Load existing digests for dedup
    const digestsData = await browser.storage.local.get('ai-reader-rss-digests');
    const existingDigests = (digestsData['ai-reader-rss-digests'] as RSSDigestItem[]) || [];
    const existingIds = new Set(existingDigests.map((d) => d.id));
    const existingTitles = new Set(globalSettings.dedupeByTitle ? existingDigests.map((d) => d.title) : []);

    // Create digest items and start summarizing
    const newDigests: RSSDigestItem[] = [];
    for (const item of newItems) {
      const digestId = `${feed.id}:${item.guid}`;
      if (existingIds.has(digestId)) continue;
      if (globalSettings.dedupeByTitle && existingTitles.has(item.title)) continue;
      if (globalSettings.dedupeByTitle && newDigests.some((d) => titlesSimilar(d.title, item.title))) continue;

      const digest: RSSDigestItem = {
        id: digestId,
        feedId: feed.id,
        feedName: feed.name || parsed.title || feed.url,
        category: feed.category || 'custom',
        tags: feed.tags || [],
        title: item.title,
        url: item.link,
        publishedAt: item.pubDate,
        fetchedAt: Date.now(),
        summary: '',
        isRead: false,
        summarizing: true,
        summaryError: '',
        starred: false,
        laterRead: false,
        aiTags: [],
        matchedKeywords: [],
      };
      newDigests.push(digest);
      if (globalSettings.dedupeByTitle) existingTitles.add(item.title);
    }

    if (newDigests.length === 0) {
      await updateFeedMeta(feed, newItems[0].guid);
      return;
    }

    const updatedDigests = [...newDigests, ...existingDigests].slice(0, 100);
    await browser.storage.local.set({ 'ai-reader-rss-digests': updatedDigests });

    // Notify sidepanel
    browser.runtime.sendMessage({ action: 'rss-digest-updated' }).catch(() => {});

    // Update badge
    updateBadgeFromDigests(updatedDigests, globalSettings);

    // Update feed metadata
    await updateFeedMeta(feed, newItems[0].guid);

    // Start summarizing each new digest
    for (const digest of newDigests) {
      const item = newItems.find((i) => `${feed.id}:${i.guid}` === digest.id);
      if (!item) continue;
      summarizeDigest(digest, providerId, config, item.title, item.description, globalSettings);
    }
  }

  async function updateFeedMeta(feed: RSSFeedConfig, lastGuid: string, error?: string) {
    const data = await browser.storage.local.get('ai-reader-rss-feeds');
    const feeds = (data['ai-reader-rss-feeds'] as RSSFeedConfig[]) || [];
    const idx = feeds.findIndex((f) => f.id === feed.id);
    if (idx >= 0) {
      feeds[idx].lastFetchedAt = Date.now();
      feeds[idx].lastItemGuid = lastGuid;
      feeds[idx].lastFetchedError = error;
      await browser.storage.local.set({ 'ai-reader-rss-feeds': feeds });
    }
  }

  async function updateFeedName(feed: RSSFeedConfig, name: string) {
    const data = await browser.storage.local.get('ai-reader-rss-feeds');
    const feeds = (data['ai-reader-rss-feeds'] as RSSFeedConfig[]) || [];
    const idx = feeds.findIndex((f) => f.id === feed.id);
    if (idx >= 0) {
      feeds[idx].name = name;
      await browser.storage.local.set({ 'ai-reader-rss-feeds': feeds });
    }
  }

  function updateBadgeFromDigests(digests: RSSDigestItem[], globalSettings: RSSGlobalSettings) {
    let count = 0;
    switch (globalSettings.badgeMode) {
      case 'all':
        count = digests.length;
        break;
      case 'starred':
        count = digests.filter((d) => d.starred).length;
        break;
      case 'unread':
      default:
        count = digests.filter((d) => !d.isRead).length;
    }
    const badgeText = count > 0 ? String(count > 99 ? '99+' : count) : '';
    browser.action.setBadgeText({ text: badgeText }).catch(() => {});
    browser.action.setBadgeBackgroundColor({ color: '#ef4444' }).catch(() => {});
  }

  async function summarizeDigest(
    digest: RSSDigestItem,
    providerId: string,
    config: ProviderConfig,
    title: string,
    content: string,
    globalSettings: RSSGlobalSettings
  ) {
    const truncatedContent = truncateText(content, 2000);
    const prompt = buildSummaryPrompt(globalSettings, title, truncatedContent);

    try {
      const provider = getProvider(providerId);
      let summary = '';
      const controller = new AbortController();

      await provider.stream(config, {
        prompt,
        signal: controller.signal,
        onDelta: (text) => {
          summary += text;
        },
        onDone: async () => {
          const finalSummary = truncateText(summary.trim(), globalSettings.summaryMaxChars);
          await updateDigestInStorage(digest.id, {
            summary: finalSummary,
            summarizing: false,
            summaryError: '',
          });
          browser.runtime.sendMessage({ action: 'rss-digest-updated' }).catch(() => {});
          if (globalSettings.autoExtractTags) {
            extractTags(digest.id, finalSummary, providerId, config, globalSettings);
          }
          if (globalSettings.enableNotifications) {
            showSummaryNotification(digest, finalSummary);
          }
        },
        onError: async (err) => {
          await updateDigestInStorage(digest.id, {
            summarizing: false,
            summaryError: err.message || '总结失败',
          });
          browser.runtime.sendMessage({ action: 'rss-digest-updated' }).catch(() => {});
        },
      });
    } catch (e) {
      await updateDigestInStorage(digest.id, {
        summarizing: false,
        summaryError: e instanceof Error ? e.message : '总结失败',
      });
      browser.runtime.sendMessage({ action: 'rss-digest-updated' }).catch(() => {});
    }
  }

  async function extractTags(
    digestId: string,
    summary: string,
    providerId: string,
    config: ProviderConfig,
    globalSettings: RSSGlobalSettings
  ) {
    const prompt = buildTagExtractPrompt(globalSettings, summary);
    try {
      const provider = getProvider(providerId);
      let response = '';
      const controller = new AbortController();
      await provider.stream(config, {
        prompt,
        signal: controller.signal,
        onDelta: (text) => { response += text; },
        onDone: async () => {
          const tags = parseTagResponse(response);
          await updateDigestInStorage(digestId, { aiTags: tags });
          browser.runtime.sendMessage({ action: 'rss-digest-updated' }).catch(() => {});
        },
        onError: () => {},
      });
    } catch {
      // ignore tag extraction errors
    }
  }

  function showSummaryNotification(digest: RSSDigestItem, summary: string) {
    if (!browser.notifications) return;
    browser.notifications.create({
      type: 'basic',
      iconUrl: browser.runtime.getURL('/icon/48.png'),
      title: digest.title,
      message: summary.slice(0, 100) + (summary.length > 100 ? '...' : ''),
    }).catch(() => {});
  }

  async function updateDigestInStorage(digestId: string, patch: Partial<RSSDigestItem>) {
    const data = await browser.storage.local.get('ai-reader-rss-digests');
    const digests = (data['ai-reader-rss-digests'] as RSSDigestItem[]) || [];
    const idx = digests.findIndex((d) => d.id === digestId);
    if (idx >= 0) {
      Object.assign(digests[idx], patch);
      await browser.storage.local.set({ 'ai-reader-rss-digests': digests });
    }
  }

  async function retrySummary(digestId: string) {
    const data = await browser.storage.local.get(['ai-reader-rss-digests', 'ai-reader-settings', 'ai-reader-rss-settings']);
    const digests = (data['ai-reader-rss-digests'] as RSSDigestItem[]) || [];
    const digest = digests.find((d) => d.id === digestId);
    if (!digest) return;

    const settings = data['ai-reader-settings'] as ProviderSettings | undefined;
    if (!settings?.enabledProviders?.length) return;

    const providerId = settings.enabledProviders[0];
    const config: ProviderConfig | undefined = settings.providers?.[providerId];
    if (!config || (!config.apiKey && providerId !== 'ollama')) return;

    const globalSettings = { ...DEFAULT_GLOBAL_SETTINGS, ...(data['ai-reader-rss-settings'] as RSSGlobalSettings | undefined || {}) };

    // Mark as summarizing again
    await updateDigestInStorage(digestId, { summarizing: true, summaryError: '' });
    browser.runtime.sendMessage({ action: 'rss-digest-updated' }).catch(() => {});

    // Re-fetch the article content from the feed (best effort: use what we have)
    const title = digest.title;
    const content = digest.summary || '无内容';
    summarizeDigest(digest, providerId, config, title, content, globalSettings);
  }

  // Initial fetch on startup (delayed to avoid competing with extension init)
  setTimeout(() => {
    checkAndFetchFeeds(true).catch((e) => console.error('Initial RSS fetch error:', e));
  }, 5000);
});
