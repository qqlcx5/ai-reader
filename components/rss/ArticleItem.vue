<script lang="ts" setup>
import { computed } from 'vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import type { RSSArticleRecord } from '@/lib/db/types'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const props = defineProps<{
  article: RSSArticleRecord
  feedTitle: string
}>()

const emit = defineEmits<{
  (e: 'markRead', articleId: string): void
  (e: 'startChat', article: RSSArticleRecord): void
}>()

const relativeTime = computed(() => dayjs(props.article.publishedAt).fromNow())

function onStartChat() {
  emit('markRead', props.article.id)
  emit('startChat', props.article)
}

function onMarkRead() {
  emit('markRead', props.article.id)
}
</script>

<template>
  <div
    class="article-item"
    :class="{ 'article-item--unread': !article.isRead, 'article-item--read': article.isRead }"
    @click="onMarkRead"
  >
    <!-- 标题行 -->
    <div class="article-item__header">
      <a
        :href="article.link"
        target="_blank"
        rel="noopener noreferrer"
        class="article-item__title"
        @click.stop
      >
        {{ article.title }}
      </a>
      <span v-if="!article.isRead" class="article-item__unread-dot" aria-label="未读" />
    </div>

    <!-- AI 摘要区 -->
    <div v-if="article.summary" class="article-item__summary">
      {{ article.summary }}
    </div>

    <!-- 底部：来源 + 时间 + 按钮 -->
    <div class="article-item__footer">
      <div class="article-item__meta">
        <span class="article-item__source">{{ feedTitle }}</span>
        <span class="article-item__sep">·</span>
        <span class="article-item__time">{{ relativeTime }}</span>
      </div>
      <button class="article-item__chat-btn" @click.stop="onStartChat">
        以此开启对话
      </button>
    </div>
  </div>
</template>

<style scoped>
.article-item {
  padding: 10px 12px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.1s;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-left: 4px solid transparent;
}

.article-item:hover {
  background: var(--card);
}

.article-item--unread {
  border-left-color: var(--primary);
}

.article-item--read {
  opacity: 0.85;
}

.article-item__header {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.article-item__title {
  flex: 1;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--text);
  line-height: 1.45;
  text-decoration: none;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.article-item__title:hover {
  color: var(--primary);
  text-decoration: underline;
}

.article-item__unread-dot {
  flex-shrink: 0;
  margin-top: 4px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--primary);
}

.article-item__summary {
  font-size: 11px;
  line-height: 1.55;
  color: var(--muted);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 7px 10px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.article-item__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.article-item__meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--muted-light);
  min-width: 0;
}

.article-item__source {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
}

.article-item__sep {
  flex-shrink: 0;
}

.article-item__time {
  white-space: nowrap;
  flex-shrink: 0;
}

.article-item__chat-btn {
  flex-shrink: 0;
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 600;
  color: var(--primary);
  background: var(--primary-soft);
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s;
  white-space: nowrap;
}

.article-item__chat-btn:hover {
  background: #e0e2fc;
  border-color: #c5c9f8;
}
</style>
