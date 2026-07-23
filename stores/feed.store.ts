import dayjs from 'dayjs'
import { defineStore } from 'pinia'
import { ref, computed, reactive } from 'vue'
import { FeedRepository } from '../db/repositories/feed.repository'
import { FeedItemRepository } from '../db/repositories/feed-item.repository'
import { refreshFeed, refreshAll, addSubscription } from '../services/feed/refresh'
import { collectFeedItem } from '../services/feed/collect'
import { AiJobRepository } from '../db/repositories/ai-job.repository'
import { ChatRepository } from '../db/repositories/chat.repository'
import { DocumentRepository } from '../db/repositories/document.repository'
import { toast } from '@/utils/toast'
import type { FeedEntity, FeedItemEntity } from '@/types/feed'
import type { AiJobEntity } from '@/types/ai-job'
import { retryJob } from '@/services/ai-job/job-control'
import type { ConversationEntity } from '@/types/chat'
import { db } from '@/db/index'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CollectPhase = 'idle' | 'collecting' | 'done' | 'error'

export interface CollectStatus {
  phase: CollectPhase
  total: number
  collected: number
  failed: number
  finishedAt?: string
}

export interface RefreshResult {
  newItems: number
  collected: number
}

export interface CollectItemDetail {
  itemId: string
  title: string
  link: string
  feedId: string
  feedTitle: string
  ok: boolean
  reason?: string
  documentId?: string
  wordCount?: number
}

export interface CollectDetailResult {
  total: number
  collected: number
  failed: number
  items: CollectItemDetail[]
  finishedAt: string
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useFeedStore = defineStore('feed', () => {
  const feeds = ref<FeedEntity[]>([])
  const selectedFeedId = ref<string | null>(null)
  const items = ref<FeedItemEntity[]>([])
  const refreshing = ref(false)
  const unreadByFeed = ref<Record<string, number>>({})

  // Per-feed collect status (in-memory, not persisted)
  const collectStatus = reactive<Record<string, CollectStatus>>({})

  // Last refresh result (for toast on panel open)
  const lastRefreshResult = ref<RefreshResult | null>(null)

  // Last collect result details (per-item, for status panel)
  const lastCollectDetails = ref<CollectDetailResult | null>(null)

  // AI analysis jobs keyed by documentId (for items in the current view)
  const aiJobMap = ref<Record<string, AiJobEntity>>({})
  // AI analysis conversations keyed by documentId (for result preview)
  const aiConvMap = ref<Record<string, ConversationEntity>>({})

  const totalUnread = computed(() =>
    Object.values(unreadByFeed.value).reduce((s, n) => s + n, 0),
  )

  function unreadOf(feedId: string): number {
    return unreadByFeed.value[feedId] ?? 0
  }

  function collectStatusOf(feedId: string): CollectStatus {
    return collectStatus[feedId] ?? { phase: 'idle', total: 0, collected: 0, failed: 0 }
  }

  // ---- Global collect stats (for status panel) ----

  /** Per-feed item counts: total / collected / pending. */
  const feedItemStats = ref<Record<string, { total: number; collected: number; pending: number; failed: number }>>({})

  /** Whether any feed is currently collecting. */
  const anyCollecting = computed(() =>
    Object.values(collectStatus).some((s) => s.phase === 'collecting'),
  )

  /** Total pending (uncollected) items across all feeds. */
  const totalPending = computed(() =>
    Object.values(feedItemStats.value).reduce((s, v) => s + v.pending, 0),
  )

  /** Total collected items across all feeds. */
  const totalCollected = computed(() =>
    Object.values(feedItemStats.value).reduce((s, v) => s + v.collected, 0),
  )

  /** Number of feeds with autoCollect enabled. */
  const autoCollectFeeds = computed(() =>
    feeds.value.filter((f) => f.autoCollect),
  )

  /** Pending items from autoCollect feeds only (matches collectAllPending scope). */
  const autoPending = computed(() =>
    autoCollectFeeds.value.reduce((s, f) => s + (feedItemStats.value[f.id]?.pending ?? 0), 0),
  )

  /** Collected items from autoCollect feeds only. */
  const autoCollected = computed(() =>
    autoCollectFeeds.value.reduce((s, f) => s + (feedItemStats.value[f.id]?.collected ?? 0), 0),
  )

  /** Items that failed collection from autoCollect feeds (collectError set). */
  const autoFailed = computed(() =>
    autoCollectFeeds.value.reduce((s, f) => s + (feedItemStats.value[f.id]?.failed ?? 0), 0),
  )

  // AI analysis summary (across all items in view)
  const aiSummary = computed(() => {
    const jobs = Object.values(aiJobMap.value)
    return {
      total: jobs.length,
      pending: jobs.filter((j) => j.status === 'pending').length,
      processing: jobs.filter((j) => j.status === 'processing').length,
      success: jobs.filter((j) => j.status === 'success').length,
      failed: jobs.filter((j) => j.status === 'failed').length,
    }
  })
  const aiAnyProcessing = computed(() => aiSummary.value.processing > 0)

  /** Get AI job status for a feed item (by its documentId). */
  function aiJobOf(documentId?: string): AiJobEntity | undefined {
    if (!documentId) return undefined
    return aiJobMap.value[documentId]
  }

  /** Get AI analysis conversation for a feed item (by its documentId). */
  function aiConvOf(documentId?: string): ConversationEntity | undefined {
    if (!documentId) return undefined
    return aiConvMap.value[documentId]
  }

  /** Load AI jobs for all collected items in the current feed view. */
  async function loadAiJobs() {
    const docIds = items.value
      .filter((i) => i.documentId)
      .map((i) => i.documentId!)
    if (!docIds.length) {
      aiJobMap.value = {}
      aiConvMap.value = {}
      return
    }
    // Batch load: for each docId, find its AI job
    const allJobs = await AiJobRepository.findAll()
    const map: Record<string, AiJobEntity> = {}
    for (const job of allJobs) {
      if (docIds.includes(job.documentId)) {
        map[job.documentId] = job
      }
    }
    aiJobMap.value = map

    // Load conversations for ALL docIds that have conversations (not just AI job successes)
    const allConvs = await ChatRepository.findAll()
    const convMap: Record<string, ConversationEntity> = {}
    for (const c of allConvs) {
      if (c.documentId && docIds.includes(c.documentId)) {
        // Prefer the conversation that matches the AI job's conversationId,
        // otherwise just take the first one found for this document
        if (!convMap[c.documentId]) {
          convMap[c.documentId] = c
        }
      }
    }
    aiConvMap.value = convMap
  }

  /** Retry a failed AI job. */
  async function retryAiJob(jobId: string) {
    const job = aiJobMap.value[jobId] ?? (await AiJobRepository.findById(jobId))
    if (!job || job.status !== 'failed') return
    await retryJob(job)
    await loadAiJobs()
    // Trigger drain
    const { drainAll } = await import('../services/ai-job/processor')
    drainAll().then(() => loadAiJobs())
  }

  /** Load item stats (total / collected / pending) for all feeds. */
  async function loadFeedItemStats() {
    const stats: Record<string, { total: number; collected: number; pending: number; failed: number }> = {}
    for (const f of feeds.value) {
      const all = await FeedItemRepository.findByFeed(f.id)
      const collected = all.filter((i) => i.documentId).length
      const failed = all.filter((i) => i.collectError).length
      stats[f.id] = { total: all.length, collected, pending: all.length - collected, failed }
    }
    feedItemStats.value = stats
  }

  /** Collect all pending items across all feeds (via background). */
  async function collectAllPending() {
    const runtime = (globalThis as any).browser?.runtime
    if (!runtime) {
      toast.error('无法连接后台服务', { category: 'rss' })
      return
    }

    const feedsWithAuto = autoCollectFeeds.value
    if (!feedsWithAuto.length) {
      toast.info('没有开启自动入库的订阅源', { category: 'rss' })
      return
    }

    const toastId = toast.loading('正在收集已开启自动入库的源…', { category: 'rss' })
    let totalCollected = 0
    let totalFailed = 0
    const allItemResults: CollectItemDetail[] = []

    for (const feed of feedsWithAuto) {
      setCollectStatus(feed.id, { phase: 'collecting', total: 0, collected: 0, failed: 0 })
      try {
        const res = await runtime.sendMessage({ type: 'COLLECT_FEED_ITEMS', feedId: feed.id })
        if (res?.ok) {
          const c = res.collected ?? 0
          const f = res.failed ?? 0
          totalCollected += c
          totalFailed += f
          // c > 0 → done; f > 0 → error; both 0 → idle (nothing to collect)
          setCollectStatus(feed.id, {
            phase: c > 0 ? 'done' : f > 0 ? 'error' : 'idle',
            collected: c,
            failed: f,
            finishedAt: dayjs().toISOString(),
          })
          if (res.items?.length) {
            allItemResults.push(...res.items.map((r: any) => ({
            ...r,
            feedId: feed.id,
            feedTitle: feed.title,
          } as CollectItemDetail)))
          }
          // Auto-clear 'done' and 'error' after 8s so the badge doesn't persist
          setTimeout(() => {
            const s = collectStatus[feed.id]
            if (s?.phase === 'done' || s?.phase === 'error') clearCollectStatus(feed.id)
          }, 8000)
        } else {
          setCollectStatus(feed.id, { phase: 'error', finishedAt: dayjs().toISOString() })
          setTimeout(() => {
            const s = collectStatus[feed.id]
            if (s?.phase === 'error') clearCollectStatus(feed.id)
          }, 8000)
        }
      } catch {
        setCollectStatus(feed.id, { phase: 'error', finishedAt: dayjs().toISOString() })
        setTimeout(() => {
          const s = collectStatus[feed.id]
          if (s?.phase === 'error') clearCollectStatus(feed.id)
        }, 8000)
      }
    }

    toast.dismiss(toastId)
    await loadFeedItemStats()
    if (selectedFeedId.value) items.value = await FeedItemRepository.findByFeed(selectedFeedId.value)
    await loadUnread()

    // Store details for status panel
    if (allItemResults.length) {
      lastCollectDetails.value = {
        total: allItemResults.length,
        collected: totalCollected,
        failed: totalFailed,
        items: allItemResults,
        finishedAt: dayjs().toISOString(),
      }
    }

    if (totalCollected > 0 && totalFailed > 0) {
      toast.warning(`共收集 ${totalCollected} 篇，${totalFailed} 篇失败`, { category: 'rss' })
    } else if (totalCollected > 0) {
      toast.success(`共收集 ${totalCollected} 篇到记忆库`, { category: 'rss' })
    } else if (totalFailed > 0) {
      toast.error(`${totalFailed} 篇收集失败`, { category: 'rss' })
    } else {
      toast.info('没有待入库的条目', { category: 'rss' })
    }
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
    await loadFeedItemStats()
  }

  async function selectFeed(id: string | null) {
    selectedFeedId.value = id
    items.value = id ? await FeedItemRepository.findByFeed(id) : []
    void loadAiJobs()
  }

  /** Set a feed's collect status. */
  function setCollectStatus(feedId: string, patch: Partial<CollectStatus>) {
    const prev = collectStatus[feedId] ?? { phase: 'idle', total: 0, collected: 0, failed: 0 }
    collectStatus[feedId] = { ...prev, ...patch }
  }

  /** Clear collect status back to idle (called after a delay or on disable). */
  function clearCollectStatus(feedId: string) {
    delete collectStatus[feedId]
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

  /** Refresh via background, with toast feedback. */
  async function refreshViaBackground() {
    refreshing.value = true
    try {
      const runtime = (globalThis as any).browser?.runtime
      if (!runtime) {
        await refresh()
        return
      }
      const res = await runtime.sendMessage({ type: 'TRIGGER_FEED_REFRESH' })
      await loadFeeds()
      if (selectedFeedId.value) items.value = await FeedItemRepository.findByFeed(selectedFeedId.value)
      if (res?.ok) {
        lastRefreshResult.value = { newItems: res.totalNew ?? 0, collected: res.totalCollected ?? 0 }
        if (res.totalNew > 0) {
          const msg = res.totalCollected > 0
            ? `刷新完成，新增 ${res.totalNew} 条，${res.totalCollected} 篇已入库`
            : `刷新完成，新增 ${res.totalNew} 条`
          toast.success(msg, { category: 'rss' })
        }
      } else if (res?.error) {
        toast.error(`刷新失败：${res.error}`, { category: 'rss' })
      }
    } catch (e) {
      // Fallback to panel-side refresh
      await refresh()
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

  /** Move a feed to a different folder (pass undefined for 未分组). */
  async function moveFolder(id: string, folder: string | undefined) {
    const feed = feeds.value.find((f) => f.id === id)
    if (!feed) return
    await FeedRepository.save({ ...feed, folder, updatedAt: dayjs().toISOString() })
    await loadFeeds()
  }

  async function markRead(itemId: string) {
    const readAt = dayjs().toISOString()
    await FeedItemRepository.markRead(itemId, readAt)
    const it = items.value.find((i) => i.id === itemId)
    if (it && !it.readAt) {
      it.readAt = readAt
      const fid = it.feedId
      if (unreadByFeed.value[fid] > 0) unreadByFeed.value[fid]--
    }
    // If the item has an associated document, mark it as fully read too.
    if (it?.documentId) {
      try {
        await DocumentRepository.updateReadProgress(it.documentId, 1, readAt)
      } catch {
        // non-critical
      }
    }
  }

  /** Collect a single feed item into the library (manual, panel-side). */
  async function collect(itemId: string) {
    const item = items.value.find((i) => i.id === itemId)
    if (!item || item.documentId) return
    const entity = await collectFeedItem(item, 'manual')
    const idx = items.value.findIndex((i) => i.id === itemId)
    if (idx >= 0) {
      items.value[idx] = {
        ...items.value[idx],
        documentId: entity.id,
        collectedAt: dayjs().toISOString(),
      }
    }
  }

  /** Remove a feed item's document from memory (uncollect). */
  async function uncollect(itemId: string) {
    const item = items.value.find((i) => i.id === itemId)
    if (!item?.documentId) return
    const docId = item.documentId
    // 1. Delete AI jobs for this document
    await AiJobRepository.deleteByDocument(docId)
    // 2. Delete conversations for this document
    await ChatRepository.deleteByDocumentIds([docId])
    // 3. Delete the document itself
    await DocumentRepository.delete(docId)
    // 4. Clear feed item's document reference
    await FeedItemRepository.clearDocument(itemId)
    // 5. Update local state
    const idx = items.value.findIndex((i) => i.id === itemId)
    if (idx >= 0) {
      items.value[idx] = {
        ...items.value[idx],
        documentId: undefined,
        collectedAt: undefined,
      }
    }
    // 6. Refresh AI job state
    delete aiJobMap.value[docId]
    delete aiConvMap.value[docId]
    await loadFeedItemStats()
  }

  /** Toggle auto-collect for a feed. */
  async function setAutoCollect(id: string, value: boolean) {
    const feed = feeds.value.find((f) => f.id === id)
    if (!feed || feed.autoCollect === value) return
    await FeedRepository.save({ ...feed, autoCollect: value, updatedAt: dayjs().toISOString() })
    await loadFeeds()

    if (!value) {
      clearCollectStatus(id)
      toast.info('已关闭自动入库', { category: 'rss' })
      return
    }

    // Delegate collection to background
    const runtime = (globalThis as any).browser?.runtime
    if (!runtime) return

    setCollectStatus(id, { phase: 'collecting', total: 0, collected: 0, failed: 0 })
    const toastId = toast.loading('正在收集现有条目…', { category: 'rss' })

    try {
      const res = await runtime.sendMessage({ type: 'COLLECT_FEED_ITEMS', feedId: id })
      toast.dismiss(toastId)

      if (selectedFeedId.value === id) items.value = await FeedItemRepository.findByFeed(id)
      await loadUnread()
      await loadFeedItemStats()

      if (res?.ok) {
        const collected = res.collected ?? 0
        const failed = res.failed ?? 0
        const total = res.total ?? 0
        const feedTitle = feed.title
        setCollectStatus(id, {
          phase: collected > 0 ? 'done' : (total > 0 && failed > 0) ? 'error' : 'idle',
          total,
          collected,
          failed,
          finishedAt: dayjs().toISOString(),
        })
        // Store item-level details for the status panel
        lastCollectDetails.value = {
          total,
          collected,
          failed,
          items: (res.items ?? []).map((r: any) => ({
            ...r,
            feedId: id,
            feedTitle,
          } as CollectItemDetail)),
          finishedAt: dayjs().toISOString(),
        }
        if (collected > 0 && failed > 0) {
          toast.warning(`已收集 ${collected} 篇，${failed} 篇失败`, { category: 'rss' })
        } else if (collected > 0) {
          toast.success(`已收集 ${collected} 篇到记忆库`, { category: 'rss' })
        } else if (total > 0 && failed > 0) {
          toast.error(`${failed} 篇收集失败`, { category: 'rss' })
        } else {
          toast.info('没有待收集的条目', { category: 'rss' })
        }
        // Auto-clear "done" and "error" status after 8s
        setTimeout(() => {
          const s = collectStatus[id]
          if (s?.phase === 'done' || s?.phase === 'error') clearCollectStatus(id)
        }, 8000)
      } else {
        setCollectStatus(id, { phase: 'error', finishedAt: dayjs().toISOString() })
        toast.error(`收集失败：${res?.error || '未知错误'}`, { category: 'rss' })
        setTimeout(() => {
          const s = collectStatus[id]
          if (s?.phase === 'error') clearCollectStatus(id)
        }, 8000)
      }
    } catch (e: any) {
      toast.dismiss(toastId)
      setCollectStatus(id, { phase: 'error', finishedAt: dayjs().toISOString() })
      toast.error(`收集请求失败：${e?.message || e}`, { category: 'rss' })
      setTimeout(() => {
        const s = collectStatus[id]
        if (s?.phase === 'error') clearCollectStatus(id)
      }, 8000)
    }
  }

  /** Handle background notifications (FEEDS_REFRESHED, FEEDS_COLLECTED). */
  async function onBackgroundEvent(message: any) {
    if (message?.type === 'FEEDS_REFRESHED') {
      await loadFeeds()
      if (selectedFeedId.value) items.value = await FeedItemRepository.findByFeed(selectedFeedId.value)
      const { totalNew, totalCollected } = message.payload ?? {}
      if (totalNew > 0) {
        const msg = totalCollected > 0
          ? `RSS 更新：${totalNew} 条新文章，${totalCollected} 篇已入库`
          : `RSS 更新：${totalNew} 条新文章`
        toast.info(msg, { category: 'rss' })
      }
    }

    if (message?.type === 'FEEDS_COLLECTED') {
      const { feedId, collected, items: itemResults } = message
      if (selectedFeedId.value === feedId) {
        items.value = await FeedItemRepository.findByFeed(feedId)
      }
      await loadUnread()
      const failed = itemResults?.filter((r: any) => !r.ok).length ?? 0
      setCollectStatus(feedId, {
        phase: collected > 0 ? 'done' : failed > 0 ? 'error' : 'idle',
        collected,
        failed,
        finishedAt: dayjs().toISOString(),
      })
      // Store details for status panel
      if (itemResults?.length) {
        const feed = feeds.value.find((f) => f.id === feedId)
        lastCollectDetails.value = {
          total: itemResults.length,
          collected,
          failed,
          items: itemResults.map((r: any) => ({
            ...r,
            feedId,
            feedTitle: feed?.title ?? feedId,
          } as CollectItemDetail)),
          finishedAt: dayjs().toISOString(),
        }
      }
      // Auto-clear after 8s
      setTimeout(() => {
        const s = collectStatus[feedId]
        if (s?.phase === 'done' || s?.phase === 'error') clearCollectStatus(feedId)
      }, 8000)
      await loadFeedItemStats()
      void loadAiJobs()
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
    collectStatus,
    lastRefreshResult,
    lastCollectDetails,
    collectStatusOf,
    setCollectStatus,
    clearCollectStatus,
    feedItemStats,
    anyCollecting,
    totalPending,
    totalCollected,
    autoCollectFeeds,
    autoPending,
    autoCollected,
    autoFailed,
    aiJobMap,
    aiConvMap,
    aiSummary,
    aiAnyProcessing,
    aiJobOf,
    aiConvOf,
    loadAiJobs,
    retryAiJob,
    loadFeedItemStats,
    collectAllPending,
    loadFeeds,
    selectFeed,
    refresh,
    refreshViaBackground,
    subscribe,
    unsubscribe,
    moveFolder,
    markRead,
    collect,
    uncollect,
    setAutoCollect,
    onBackgroundEvent,
  }
})
