import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { FeedRepository } from '../db/repositories/feed.repository'
import { FeedItemRepository } from '../db/repositories/feed-item.repository'
import { refreshFeed, refreshAll, addSubscription } from '../services/feed/refresh'
import { collectFeedItem, collectItems } from '../services/feed/collect'
import type { FeedEntity, FeedItemEntity } from '../types/feed'

export const useFeedStore = defineStore('feed', () => {
  const feeds = ref<FeedEntity[]>([])
  const selectedFeedId = ref<string | null>(null)
  const items = ref<FeedItemEntity[]>([])
  const refreshing = ref(false)
  const unreadByFeed = ref<Record<string, number>>({})

  const totalUnread = computed(() =>
    Object.values(unreadByFeed.value).reduce((s, n) => s + n, 0),
  )

  function unreadOf(feedId: string): number {
    return unreadByFeed.value[feedId] ?? 0
  }

  const folders = computed(() => {
    const m = new Map<string, FeedEntity[]>()
    for (const f of feeds.value) {
      const k = f.folder || '未分组'
      m.set(k, [...(m.get(k) ?? []), f])
    }
    return [...m.entries()].map(([folder, list]) => ({
      folder,
      list,
      unread: list.reduce((s, f) => s + (unreadByFeed.value[f.id] ?? 0), 0),
    }))
  })

  async function loadUnread() {
    const m: Record<string, number> = {}
    for (const f of feeds.value) {
      m[f.id] = await FeedItemRepository.unreadCount(f.id)
    }
    unreadByFeed.value = m
  }

  async function loadFeeds() {
    feeds.value = await FeedRepository.findAll()
    await loadUnread()
  }

  async function selectFeed(id: string | null) {
    selectedFeedId.value = id
    items.value = id ? await FeedItemRepository.findByFeed(id) : []
  }

  async function refresh(id?: string) {
    refreshing.value = true
    try {
      if (id) {
        const feed = feeds.value.find((f) => f.id === id) ?? (await FeedRepository.findById(id))
        if (feed) await refreshFeed(feed)
      } else {
        await refreshAll()
      }
      await loadFeeds()
      if (selectedFeedId.value) items.value = await FeedItemRepository.findByFeed(selectedFeedId.value)
    } finally {
      refreshing.value = false
    }
  }

  async function subscribe(url: string, folder?: string) {
    await addSubscription(url, folder)
    await loadFeeds()
  }

  async function unsubscribe(id: string) {
    await FeedRepository.delete(id)
    if (selectedFeedId.value === id) await selectFeed(null)
    await loadFeeds()
  }

  async function markRead(itemId: string) {
    const readAt = new Date().toISOString()
    await FeedItemRepository.markRead(itemId, readAt)
    const it = items.value.find((i) => i.id === itemId)
    if (it && !it.readAt) {
      it.readAt = readAt
      const fid = it.feedId
      if (unreadByFeed.value[fid] > 0) unreadByFeed.value[fid]--
    }
  }

  /** Collect a feed item into the library (defuddle full article → DocumentEntity). */
  async function collect(itemId: string) {
    const item = items.value.find((i) => i.id === itemId)
    if (!item || item.documentId) return
    const entity = await collectFeedItem(item, 'manual')
    const idx = items.value.findIndex((i) => i.id === itemId)
    if (idx >= 0) {
      items.value[idx] = {
        ...items.value[idx],
        documentId: entity.id,
        collectedAt: new Date().toISOString(),
      }
    }
  }

  /** Toggle auto-collect for a feed. When turning on, backfill existing
   *  uncollected items (capped, best-effort). */
  async function setAutoCollect(id: string, value: boolean) {
    const feed = feeds.value.find((f) => f.id === id)
    if (!feed || feed.autoCollect === value) return
    await FeedRepository.save({ ...feed, autoCollect: value, updatedAt: new Date().toISOString() })
    await loadFeeds()
    if (value) {
      const all = await FeedItemRepository.findByFeed(id)
      await collectItems(all.filter((i) => !i.documentId), 'auto')
      if (selectedFeedId.value === id) items.value = await FeedItemRepository.findByFeed(id)
      await loadUnread()
    }
  }

  return {
    feeds,
    selectedFeedId,
    items,
    refreshing,
    folders,
    unreadByFeed,
    totalUnread,
    unreadOf,
    loadFeeds,
    selectFeed,
    refresh,
    subscribe,
    unsubscribe,
    markRead,
    collect,
    setAutoCollect,
  }
})
