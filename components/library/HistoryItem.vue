<script lang="ts" setup>
/**
 * M6 — HistoryItem
 * 历史记录列表项：favicon + 标题 + 相对时间 + 消息数 badge + 字数标签
 * hover 效果：bg-obsidian-bg / shadow-sm
 */
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import type { ConversationRecord } from '@/lib/db/types'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const props = defineProps<{
  item: ConversationRecord
  selected?: boolean
  compact?: boolean
}>()

const emit = defineEmits<{
  (e: 'click', item: ConversationRecord): void
  (e: 'contextmenu', payload: { item: ConversationRecord; event: MouseEvent }): void
  (e: 'long-press', item: ConversationRecord): void
}>()

function formatRelativeTime(ts: number): string {
  return dayjs(ts).fromNow()
}

function formatWordCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k 字`
  return `${count} 字`
}

// Long press support
let longPressTimer: ReturnType<typeof setTimeout> | null = null

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  longPressTimer = setTimeout(() => {
    emit('long-press', props.item)
  }, 600)
}

function onPointerUp() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function onContextMenu(e: MouseEvent) {
  e.preventDefault()
  emit('contextmenu', { item: props.item, event: e })
}
</script>

<template>
  <div
    class="history-item"
    :class="{
      'history-item--selected': selected,
      'history-item--compact': compact,
    }"
    role="button"
    tabindex="0"
    :aria-label="item.title"
    @click="emit('click', item)"
    @keydown.enter="emit('click', item)"
    @contextmenu="onContextMenu"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
    @pointerleave="onPointerUp"
  >
    <!-- Favicon -->
    <div class="history-item__favicon-wrap">
      <img
        v-if="item.favicon"
        class="history-item__favicon"
        :src="item.favicon"
        :alt="item.domain"
        loading="lazy"
        @error="($event.target as HTMLImageElement).style.display = 'none'"
      />
      <span v-else class="history-item__favicon-fallback">
        {{ item.domain.charAt(0).toUpperCase() }}
      </span>
    </div>

    <!-- Main content -->
    <div class="history-item__body">
      <div class="history-item__title">{{ item.title || item.url }}</div>
      <div class="history-item__meta">
        <span class="history-item__time">{{ formatRelativeTime(item.updatedAt) }}</span>
        <span class="history-item__sep">·</span>
        <span class="history-item__domain">{{ item.domain }}</span>
      </div>
    </div>

    <!-- Badges -->
    <div class="history-item__badges">
      <span v-if="item.messageCount > 0" class="history-item__badge history-item__badge--msg">
        {{ item.messageCount }}
      </span>
      <span class="history-item__badge history-item__badge--words">
        {{ formatWordCount(item.wordCount) }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.history-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  height: 64px;
  box-sizing: border-box;
  cursor: pointer;
  border-radius: var(--radius-md, 8px);
  border: 1px solid transparent;
  transition: background 0.12s, box-shadow 0.12s, border-color 0.12s;
  outline: none;
  user-select: none;
}

.history-item:hover,
.history-item:focus-visible {
  background: var(--bg, #f4f2ec);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  border-color: var(--border, #e6e2d8);
}

.history-item--selected {
  background: var(--primary-soft, #eef0ff);
  border-color: rgba(91, 96, 229, 0.25);
}

.history-item--compact {
  height: 52px;
  padding: 7px 10px;
}

/* Favicon */
.history-item__favicon-wrap {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--card, #faf9f5);
  border: 1px solid var(--border, #e6e2d8);
  display: flex;
  align-items: center;
  justify-content: center;
}

.history-item--compact .history-item__favicon-wrap {
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.history-item__favicon {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.history-item__favicon-fallback {
  font-size: 16px;
  font-weight: 700;
  color: var(--muted, #7a7568);
}

/* Body */
.history-item__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.history-item__title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text, #2e2d2a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.history-item__meta {
  display: flex;
  align-items: center;
  gap: 4px;
}

.history-item__time {
  font-size: 10px;
  color: var(--muted, #7a7568);
  white-space: nowrap;
}

.history-item__sep {
  font-size: 10px;
  color: var(--muted-light, #b0aca0);
}

.history-item__domain {
  font-size: 10px;
  color: var(--muted, #7a7568);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80px;
}

/* Badges */
.history-item__badges {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  flex-shrink: 0;
}

.history-item__badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: var(--radius-pill, 999px);
  white-space: nowrap;
}

.history-item__badge--msg {
  background: var(--primary-soft, #eef0ff);
  color: var(--primary, #5b60e5);
}

.history-item__badge--words {
  background: var(--card, #faf9f5);
  color: var(--muted, #7a7568);
  border: 1px solid var(--border, #e6e2d8);
}
</style>
