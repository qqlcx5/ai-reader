<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue'
import type { RSSFeedRecord, RSSArticleRecord } from '@/lib/db/types'
import { rssRepo } from '@/lib/db/repositories/rss.repo'
import DailyBriefingCard from './DailyBriefingCard.vue'
import FeedList from './FeedList.vue'
import AddFeedModal from './AddFeedModal.vue'

const feeds = ref<RSSFeedRecord[]>([])
const showAddModal = ref(false)
const loading = ref(true)

async function loadFeeds() {
  try {
    feeds.value = await rssRepo.listFeeds()
  } catch (err) {
    console.error('[RSSPanel] loadFeeds failed', err)
  } finally {
    loading.value = false
  }
}

function onFeedsChanged() {
  loadFeeds()
}

function onAddModalClosed() {
  showAddModal.value = false
  loadFeeds()
}

function onStartChat(article: RSSArticleRecord, feedTitle: string) {
  // 将文章摘要/描述作为上下文注入 Chat（M4 集成）
  chrome.runtime.sendMessage({
    type: 'START_CHAT_WITH_CONTEXT',
    context: {
      title: article.title,
      url: article.link,
      content: article.summary,
      source: feedTitle,
    },
  }).catch(() => {})
}

// 监听 RSS 更新消息（badge 更新后刷新列表）
function onMessage(msg: unknown) {
  if (
    msg &&
    typeof msg === 'object' &&
    (msg as Record<string, unknown>).type === 'RSS_UPDATED'
  ) {
    loadFeeds()
  }
}

onMounted(() => {
  loadFeeds()
  chrome.runtime.onMessage?.addListener(onMessage)
})

onUnmounted(() => {
  chrome.runtime.onMessage?.removeListener(onMessage)
})
</script>

<template>
  <div class="rss-panel">
    <!-- 顶部今日简报 -->
    <DailyBriefingCard class="rss-panel__briefing" />

    <!-- 工具栏 -->
    <div class="rss-panel__toolbar">
      <span class="rss-panel__toolbar-title">RSS 订阅</span>
      <button
        class="rss-panel__add-btn"
        title="添加订阅源"
        @click="showAddModal = true"
        aria-label="添加 RSS 订阅源"
      >
        + 添加
      </button>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="rss-panel__loading">
      <span class="rss-panel__spinner">⟳</span>
      加载中…
    </div>

    <!-- 订阅列表 -->
    <div v-else class="rss-panel__list">
      <FeedList
        :feeds="feeds"
        @feeds-changed="onFeedsChanged"
        @start-chat="onStartChat"
      />
    </div>

    <!-- 添加订阅 Modal -->
    <AddFeedModal
      v-if="showAddModal"
      @close="showAddModal = false"
      @added="onAddModalClosed"
    />
  </div>
</template>

<style scoped>
.rss-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.rss-panel__briefing {
  flex-shrink: 0;
  margin: 8px 8px 0;
}

.rss-panel__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 8px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
}

.rss-panel__toolbar-title {
  font-size: var(--fs-xs);
  font-weight: 800;
  color: var(--text);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.rss-panel__add-btn {
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 700;
  color: var(--primary);
  background: var(--primary-soft);
  border: 1px solid #d2d6ff;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: background 0.1s;
}

.rss-panel__add-btn:hover {
  background: #e0e2fc;
}

.rss-panel__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 24px;
  font-size: var(--fs-xs);
  color: var(--muted);
}

.rss-panel__spinner {
  animation: spin 1s linear infinite;
  display: inline-block;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.rss-panel__list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 4px;
}
</style>
