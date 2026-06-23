<script lang="ts" setup>
import { ref, computed } from 'vue'
import type { RSSFeedRecord, RSSArticleRecord } from '@/lib/db/types'
import { rssRepo } from '@/lib/db/repositories/rss.repo'
import { fetchFeed } from '@/lib/rss/fetcher'
import { computeArticleId, filterNewArticles } from '@/lib/rss/dedup'
import { updateBadge } from '@/lib/rss/badge'
import ArticleItem from './ArticleItem.vue'

const props = defineProps<{
  feeds: RSSFeedRecord[]
}>()

const emit = defineEmits<{
  (e: 'feedsChanged'): void
  (e: 'startChat', article: RSSArticleRecord, feedTitle: string): void
}>()

const expandedFeedId = ref<string | null>(null)
const loadingFeedId = ref<string | null>(null)
const contextMenuFeedId = ref<string | null>(null)
const contextMenuPos = ref({ x: 0, y: 0 })

function toggleFeed(feedId: string) {
  expandedFeedId.value = expandedFeedId.value === feedId ? null : feedId
  contextMenuFeedId.value = null
}

function getUnreadCount(feed: RSSFeedRecord): number {
  return feed.articles.filter((a) => !a.isRead).length
}

function getFaviconUrl(feed: RSSFeedRecord): string {
  try {
    const u = new URL(feed.url)
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=16`
  } catch {
    return ''
  }
}

function onContextMenu(e: MouseEvent, feedId: string) {
  e.preventDefault()
  contextMenuFeedId.value = feedId
  contextMenuPos.value = { x: e.clientX, y: e.clientY }
}

function closeContextMenu() {
  contextMenuFeedId.value = null
}

async function deleteFeed(feedId: string) {
  closeContextMenu()
  if (!confirm('确认删除该订阅源？')) return
  await rssRepo.delete(feedId)
  if (expandedFeedId.value === feedId) expandedFeedId.value = null
  await updateBadge()
  emit('feedsChanged')
}

async function refreshFeed(feedId: string) {
  closeContextMenu()
  const feed = props.feeds.find((f) => f.id === feedId)
  if (!feed) return

  loadingFeedId.value = feedId
  try {
    const rawData = await fetchFeed(feed.url)
    const existingIds = new Set(feed.articles.map((a) => a.id))
    const newRawArticles = await filterNewArticles(rawData.items, existingIds)

    if (newRawArticles.length > 0) {
      const newArticles: RSSArticleRecord[] = []
      for (const raw of newRawArticles) {
        const id = await computeArticleId(raw)
        newArticles.push({
          id,
          link: raw.link,
          title: raw.title,
          summary: raw.description.slice(0, 200),
          publishedAt: raw.pubDate,
          isRead: false,
        })
      }
      await rssRepo.updateArticles(feedId, newArticles)
      await updateBadge()
      emit('feedsChanged')
    }
  } catch (err) {
    console.error('[FeedList] refresh failed', err)
  } finally {
    loadingFeedId.value = null
  }
}

async function markArticleRead(feedId: string, articleId: string) {
  await rssRepo.markAsRead(feedId, articleId)
  await updateBadge()
  emit('feedsChanged')
}

function onStartChat(article: RSSArticleRecord, feedTitle: string) {
  emit('startChat', article, feedTitle)
}
</script>

<template>
  <div class="feed-list" @click.self="closeContextMenu">
    <div v-if="feeds.length === 0" class="feed-list__empty">
      <span class="feed-list__empty-icon">📡</span>
      <p class="feed-list__empty-text">暂无订阅源</p>
      <p class="feed-list__empty-hint">点击上方"+"添加</p>
    </div>

    <div
      v-for="feed in feeds"
      :key="feed.id"
      class="feed-list__item"
    >
      <!-- Feed 行 -->
      <div
        class="feed-list__feed-row"
        @click="toggleFeed(feed.id)"
        @contextmenu="onContextMenu($event, feed.id)"
      >
        <img
          v-if="getFaviconUrl(feed)"
          :src="getFaviconUrl(feed)"
          class="feed-list__favicon"
          alt=""
          width="16"
          height="16"
          @error="($event.target as HTMLImageElement).style.display = 'none'"
        />
        <span class="feed-list__feed-icon" v-else>📡</span>

        <span class="feed-list__feed-title">{{ feed.title }}</span>

        <span v-if="loadingFeedId === feed.id" class="feed-list__spinner">⟳</span>

        <span
          v-if="getUnreadCount(feed) > 0"
          class="feed-list__badge"
        >
          {{ getUnreadCount(feed) }}
        </span>

        <span class="feed-list__chevron" :class="{ 'feed-list__chevron--open': expandedFeedId === feed.id }">
          ›
        </span>
      </div>

      <!-- 文章列表（展开） -->
      <div v-if="expandedFeedId === feed.id" class="feed-list__articles">
        <p v-if="feed.articles.length === 0" class="feed-list__no-articles">
          暂无文章
        </p>
        <ArticleItem
          v-for="article in feed.articles"
          :key="article.id"
          :article="article"
          :feed-title="feed.title"
          @mark-read="markArticleRead(feed.id, $event)"
          @start-chat="onStartChat($event, feed.title)"
        />
      </div>
    </div>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <div
        v-if="contextMenuFeedId"
        class="feed-list__ctx-menu"
        :style="{ top: contextMenuPos.y + 'px', left: contextMenuPos.x + 'px' }"
        @click.stop
      >
        <button class="feed-list__ctx-item" @click="refreshFeed(contextMenuFeedId!)">
          ↻ 立即刷新
        </button>
        <button class="feed-list__ctx-item feed-list__ctx-item--danger" @click="deleteFeed(contextMenuFeedId!)">
          ✕ 删除订阅源
        </button>
      </div>
    </Teleport>

    <!-- 点击外部关闭右键菜单 -->
    <div v-if="contextMenuFeedId" class="feed-list__ctx-overlay" @click="closeContextMenu" />
  </div>
</template>

<style scoped>
.feed-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.feed-list__empty {
  padding: 24px 12px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.feed-list__empty-icon {
  font-size: 28px;
  margin-bottom: 4px;
}

.feed-list__empty-text {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--text);
  margin: 0;
}

.feed-list__empty-hint {
  font-size: var(--fs-xs);
  color: var(--muted);
  margin: 0;
}

.feed-list__item {
  border-radius: var(--radius-md);
  overflow: hidden;
}

.feed-list__feed-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: background 0.1s;
  user-select: none;
}

.feed-list__feed-row:hover {
  background: var(--card);
}

.feed-list__favicon {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  flex-shrink: 0;
}

.feed-list__feed-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.feed-list__feed-title {
  flex: 1;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.feed-list__spinner {
  font-size: 14px;
  color: var(--muted);
  animation: spin 1s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.feed-list__badge {
  flex-shrink: 0;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 700;
  background: var(--primary);
  color: #fff;
  border-radius: var(--radius-pill);
  min-width: 18px;
  text-align: center;
}

.feed-list__chevron {
  flex-shrink: 0;
  font-size: 16px;
  color: var(--muted);
  transform: rotate(0deg);
  transition: transform 0.15s;
  line-height: 1;
}

.feed-list__chevron--open {
  transform: rotate(90deg);
}

.feed-list__articles {
  padding-left: 4px;
  border-left: 2px solid var(--border);
  margin-left: 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 4px;
  padding-bottom: 4px;
}

.feed-list__no-articles {
  font-size: var(--fs-xs);
  color: var(--muted);
  padding: 8px 12px;
  margin: 0;
}

/* 右键菜单 */
.feed-list__ctx-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
}

.feed-list__ctx-menu {
  position: fixed;
  z-index: 1000;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 4px;
  min-width: 140px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.feed-list__ctx-item {
  display: block;
  width: 100%;
  padding: 7px 10px;
  font-size: var(--fs-xs);
  font-weight: 600;
  text-align: left;
  color: var(--text);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.1s;
}

.feed-list__ctx-item:hover {
  background: var(--card);
}

.feed-list__ctx-item--danger {
  color: var(--red);
}

.feed-list__ctx-item--danger:hover {
  background: var(--red-soft);
}
</style>
