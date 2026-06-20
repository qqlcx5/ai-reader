import { defineStore } from 'pinia';
import { ref, computed, watch, toRaw } from 'vue';
import { browser } from 'wxt/browser';
import {
  type RSSFeedConfig,
  type RSSDigestItem,
  type RSSFilterSettings,
  type RSSGlobalSettings,
  generateFeedId,
  generateDigestId,
  DEFAULT_FEEDS,
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_FILTER_SETTINGS,
  RSS_CATEGORY_META,
  migrateFeed,
  exportOPML,
  importOPML,
  applyKeywordFilter,
  parseTagResponse,
  titlesSimilar,
} from '@/utils/rss';

const FEEDS_STORAGE_KEY = 'ai-reader-rss-feeds';
const DIGESTS_STORAGE_KEY = 'ai-reader-rss-digests';
const SETTINGS_STORAGE_KEY = 'ai-reader-rss-settings';
const FILTER_STORAGE_KEY = 'ai-reader-rss-filter';
const MAX_DIGESTS = 100;

export const useRSSStore = defineStore('rss', () => {
  const feeds = ref<RSSFeedConfig[]>([]);
  const digests = ref<RSSDigestItem[]>([]);
  const globalSettings = ref<RSSGlobalSettings>({ ...DEFAULT_GLOBAL_SETTINGS });
  const filter = ref<RSSFilterSettings>({ ...DEFAULT_FILTER_SETTINGS });
  const ready = ref(false);

  const unreadCount = computed(() => digests.value.filter((d) => !d.isRead).length);
  const starredCount = computed(() => digests.value.filter((d) => d.starred).length);
  const laterReadCount = computed(() => digests.value.filter((d) => d.laterRead).length);

  const sortedDigests = computed(() =>
    [...digests.value].sort((a, b) => {
      if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
      return b.publishedAt - a.publishedAt;
    })
  );

  const filteredDigests = computed(() => {
    let result = [...digests.value];

    // 1. Category filter
    if (filter.value.selectedCategories.length > 0) {
      result = result.filter((d) => filter.value.selectedCategories.includes(d.category));
    }

    // 2. Unread
    if (filter.value.onlyUnread) {
      result = result.filter((d) => !d.isRead);
    }

    // 3. Starred
    if (filter.value.onlyStarred) {
      result = result.filter((d) => d.starred);
    }

    // 4. Later read
    if (filter.value.onlyLaterRead) {
      result = result.filter((d) => d.laterRead);
    }

    // 5. Max age
    if (filter.value.maxAgeHours > 0) {
      const cutoff = Date.now() - filter.value.maxAgeHours * 60 * 60 * 1000;
      result = result.filter((d) => d.publishedAt >= cutoff);
    }

    // 6,7. Keyword filtering + matchedKeywords
    result = applyKeywordFilter(result, filter.value);

    // Sort: unread first, then by publishedAt descending
    result.sort((a, b) => {
      if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
      return b.publishedAt - a.publishedAt;
    });

    return result;
  });

  const categories = computed(() => {
    const counts = new Map<string, number>();
    for (const f of feeds.value) {
      counts.set(f.category, (counts.get(f.category) || 0) + 1);
    }
    return (Object.keys(RSS_CATEGORY_META) as Array<keyof typeof RSS_CATEGORY_META>).map((cat) => ({
      category: cat,
      label: RSS_CATEGORY_META[cat].label,
      color: RSS_CATEGORY_META[cat].color,
      count: counts.get(cat) || 0,
      active: filter.value.selectedCategories.includes(cat),
    }));
  });

  const feedStats = computed(() => {
    return feeds.value.map((feed) => {
      const feedDigests = digests.value.filter((d) => d.feedId === feed.id);
      return {
        feedId: feed.id,
        name: feed.name,
        total: feedDigests.length,
        unread: feedDigests.filter((d) => !d.isRead).length,
        starred: feedDigests.filter((d) => d.starred).length,
      };
    });
  });

  const badgeCount = computed(() => {
    switch (globalSettings.value.badgeMode) {
      case 'all':
        return digests.value.length;
      case 'starred':
        return starredCount.value;
      case 'unread':
      default:
        return unreadCount.value;
    }
  });

  async function load() {
    const data = await browser.storage.local.get([
      FEEDS_STORAGE_KEY,
      DIGESTS_STORAGE_KEY,
      SETTINGS_STORAGE_KEY,
      FILTER_STORAGE_KEY,
    ]);

    const savedFeeds = data[FEEDS_STORAGE_KEY] as RSSFeedConfig[] | undefined;
    if (savedFeeds && Array.isArray(savedFeeds) && savedFeeds.length > 0) {
      // Migration: ensure legacy feeds have new fields
      feeds.value = savedFeeds.map((f) => migrateFeed(f));
    } else {
      // First load: populate default feeds
      feeds.value = DEFAULT_FEEDS.map((f) => ({ ...f, id: generateFeedId() }));
      await persistFeeds();
    }

    const savedDigests = data[DIGESTS_STORAGE_KEY] as RSSDigestItem[] | undefined;
    if (savedDigests && Array.isArray(savedDigests)) {
      digests.value = savedDigests.map((d) => ({
        ...d,
        category: d.category || 'custom',
        tags: d.tags || [],
        starred: d.starred ?? false,
        laterRead: d.laterRead ?? false,
        aiTags: d.aiTags || [],
        matchedKeywords: d.matchedKeywords || [],
      }));
    }

    const savedSettings = data[SETTINGS_STORAGE_KEY] as RSSGlobalSettings | undefined;
    if (savedSettings && typeof savedSettings === 'object') {
      globalSettings.value = { ...DEFAULT_GLOBAL_SETTINGS, ...savedSettings };
    }

    const savedFilter = data[FILTER_STORAGE_KEY] as RSSFilterSettings | undefined;
    if (savedFilter && typeof savedFilter === 'object') {
      filter.value = { ...DEFAULT_FILTER_SETTINGS, ...savedFilter };
    }

    ready.value = true;
  }

  async function persistFeeds() {
    const plain = toRaw(feeds.value).map((f) => ({ ...toRaw(f) }));
    await browser.storage.local.set({ [FEEDS_STORAGE_KEY]: plain });
  }

  async function persistDigests() {
    const plain = toRaw(digests.value).map((d) => ({ ...toRaw(d) }));
    await browser.storage.local.set({ [DIGESTS_STORAGE_KEY]: plain });
  }

  async function persistSettings() {
    await browser.storage.local.set({ [SETTINGS_STORAGE_KEY]: toRaw(globalSettings.value) });
  }

  async function persistFilter() {
    await browser.storage.local.set({ [FILTER_STORAGE_KEY]: toRaw(filter.value) });
  }

  async function addFeed(url: string, name?: string, category: string = 'custom', tags: string[] = []) {
    // Check for duplicate URL
    if (feeds.value.some((f) => f.url === url)) return;
    const feed: RSSFeedConfig = {
      id: generateFeedId(),
      url,
      name: name?.trim() || url,
      enabled: true,
      category: category as RSSFeedConfig['category'],
      tags: tags || [],
      lastFetchedAt: 0,
      lastItemGuid: '',
      fetchIntervalMinutes: globalSettings.value.fetchIntervalMinutes,
      maxItemsPerFetch: globalSettings.value.defaultMaxItemsPerFeed,
      autoName: true,
    };
    feeds.value.push(feed);
    await persistFeeds();
  }

  async function removeFeed(id: string) {
    const idx = feeds.value.findIndex((f) => f.id === id);
    if (idx < 0) return;
    feeds.value.splice(idx, 1);
    // Also remove digests from this feed
    digests.value = digests.value.filter((d) => d.feedId !== id);
    await persistFeeds();
    await persistDigests();
  }

  async function toggleFeed(id: string) {
    const feed = feeds.value.find((f) => f.id === id);
    if (!feed) return;
    feed.enabled = !feed.enabled;
    await persistFeeds();
  }

  async function updateFeed(id: string, patch: Partial<RSSFeedConfig>) {
    const feed = feeds.value.find((f) => f.id === id);
    if (!feed) return;
    Object.assign(feed, patch);
    await persistFeeds();
  }

  async function markAsRead(id: string) {
    const digest = digests.value.find((d) => d.id === id);
    if (!digest) return;
    digest.isRead = true;
    await persistDigests();
    updateBadge();
  }

  async function markAllAsRead() {
    for (const d of digests.value) {
      d.isRead = true;
    }
    await persistDigests();
    updateBadge();
  }

  async function markFeedAsRead(feedId: string) {
    for (const d of digests.value) {
      if (d.feedId === feedId) d.isRead = true;
    }
    await persistDigests();
    updateBadge();
  }

  async function removeDigest(id: string) {
    const idx = digests.value.findIndex((d) => d.id === id);
    if (idx < 0) return;
    digests.value.splice(idx, 1);
    await persistDigests();
    updateBadge();
  }

  async function clearAll() {
    digests.value = [];
    await persistDigests();
    updateBadge();
  }

  async function clearReadDigests() {
    digests.value = digests.value.filter((d) => !d.isRead || d.starred || d.laterRead);
    await persistDigests();
    updateBadge();
  }

  async function refreshFeeds() {
    await browser.runtime.sendMessage({ action: 'rss-refresh' }).catch(() => {});
  }

  async function refreshFeed(id: string) {
    await browser.runtime.sendMessage({ action: 'rss-refresh-feed', feedId: id }).catch(() => {});
  }

  async function addDigests(items: RSSDigestItem[]) {
    let added = false;
    for (const item of items) {
      // Dedup by id
      if (digests.value.some((d) => d.id === item.id)) continue;
      digests.value.unshift(item);
      added = true;
    }
    // Trim to max
    if (digests.value.length > MAX_DIGESTS) {
      digests.value = digests.value.slice(0, MAX_DIGESTS);
    }
    if (added) {
      await persistDigests();
      updateBadge();
    }
  }

  async function updateDigest(id: string, patch: Partial<RSSDigestItem>) {
    const digest = digests.value.find((d) => d.id === id);
    if (!digest) return;
    Object.assign(digest, patch);
    await persistDigests();
    // Update badge if isRead changed
    if ('isRead' in patch) updateBadge();
  }

  function getDigest(id: string): RSSDigestItem | undefined {
    return digests.value.find((d) => d.id === id);
  }

  // Filtering
  function setCategoryFilter(categories: RSSFilterSettings['selectedCategories']) {
    filter.value.selectedCategories = categories;
    persistFilter();
  }

  function toggleCategory(category: RSSFilterSettings['selectedCategories'][number]) {
    const idx = filter.value.selectedCategories.indexOf(category);
    if (idx >= 0) {
      filter.value.selectedCategories.splice(idx, 1);
    } else {
      filter.value.selectedCategories.push(category);
    }
    persistFilter();
  }

  function setKeywordFilter(whitelist: string[], blacklist: string[]) {
    filter.value.whitelistKeywords = whitelist.filter(Boolean);
    filter.value.blacklistKeywords = blacklist.filter(Boolean);
    persistFilter();
  }

  function setMatchInTitle(v: boolean) {
    filter.value.matchInTitle = v;
    persistFilter();
  }

  function setMatchInSummary(v: boolean) {
    filter.value.matchInSummary = v;
    persistFilter();
  }

  function setMaxAgeHours(hours: number) {
    filter.value.maxAgeHours = hours;
    persistFilter();
  }

  function setOnlyUnread(v: boolean) {
    filter.value.onlyUnread = v;
    persistFilter();
  }

  function setOnlyStarred(v: boolean) {
    filter.value.onlyStarred = v;
    persistFilter();
  }

  function setOnlyLaterRead(v: boolean) {
    filter.value.onlyLaterRead = v;
    persistFilter();
  }

  function clearFilter() {
    filter.value = { ...DEFAULT_FILTER_SETTINGS };
    persistFilter();
  }

  function searchDigests(query: string): RSSDigestItem[] {
    const q = query.trim().toLowerCase();
    if (!q) return digests.value;
    return digests.value.filter((d) =>
      d.title.toLowerCase().includes(q) || d.summary.toLowerCase().includes(q)
    );
  }

  async function toggleStar(id: string) {
    const digest = digests.value.find((d) => d.id === id);
    if (!digest) return;
    digest.starred = !digest.starred;
    await persistDigests();
    updateBadge();
  }

  async function toggleLaterRead(id: string) {
    const digest = digests.value.find((d) => d.id === id);
    if (!digest) return;
    digest.laterRead = !digest.laterRead;
    await persistDigests();
  }

  async function updateGlobalSettings(patch: Partial<RSSGlobalSettings>) {
    Object.assign(globalSettings.value, patch);
    await persistSettings();
  }

  async function extractAITags(digestId: string, summary: string): Promise<string[]> {
    // In real app this calls LLM; here we provide a local fallback that can be mocked in tests
    const tags = parseTagResponse(summary);
    const digest = digests.value.find((d) => d.id === digestId);
    if (digest) {
      digest.aiTags = tags.slice(0, 3);
      await persistDigests();
    }
    return tags.slice(0, 3);
  }

  function exportFeedsOPML(): string {
    return exportOPML(feeds.value);
  }

  async function importFeedsOPML(opmlText: string): Promise<number> {
    const imported = importOPML(opmlText);
    let count = 0;
    for (const item of imported) {
      if (feeds.value.some((f) => f.url === item.url)) continue;
      const feed: RSSFeedConfig = {
        id: generateFeedId(),
        url: item.url,
        name: item.name || item.url,
        enabled: true,
        category: item.category || 'custom',
        tags: item.tags || [],
        lastFetchedAt: 0,
        lastItemGuid: '',
        fetchIntervalMinutes: globalSettings.value.fetchIntervalMinutes,
        maxItemsPerFetch: globalSettings.value.defaultMaxItemsPerFeed,
        autoName: false,
      };
      feeds.value.push(feed);
      count++;
    }
    await persistFeeds();
    return count;
  }

  function updateBadge() {
    const count = badgeCount.value;
    const text = count > 0 ? String(count > 99 ? '99+' : count) : '';
    browser.action.setBadgeText({ text }).catch(() => {});
    browser.action.setBadgeBackgroundColor({ color: '#ef4444' }).catch(() => {});
  }

  // Debounced auto-save for feeds and settings
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  watch(feeds, () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(persistFeeds, 500);
  }, { deep: true });

  watch(globalSettings, () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(persistSettings, 500);
  }, { deep: true });

  watch(filter, () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(persistFilter, 500);
  }, { deep: true });

  // Load on init
  load();

  return {
    feeds,
    digests,
    globalSettings,
    filter,
    ready,
    unreadCount,
    starredCount,
    laterReadCount,
    sortedDigests,
    filteredDigests,
    categories,
    feedStats,
    badgeCount,
    load,
    addFeed,
    removeFeed,
    toggleFeed,
    updateFeed,
    markAsRead,
    markAllAsRead,
    markFeedAsRead,
    removeDigest,
    clearAll,
    clearReadDigests,
    refreshFeeds,
    refreshFeed,
    addDigests,
    updateDigest,
    getDigest,
    setCategoryFilter,
    toggleCategory,
    setKeywordFilter,
    setMatchInTitle,
    setMatchInSummary,
    setMaxAgeHours,
    setOnlyUnread,
    setOnlyStarred,
    setOnlyLaterRead,
    clearFilter,
    searchDigests,
    toggleStar,
    toggleLaterRead,
    updateGlobalSettings,
    extractAITags,
    exportFeedsOPML,
    importFeedsOPML,
    persistFeeds,
    persistDigests,
    persistSettings,
    persistFilter,
    updateBadge,
  };
});
