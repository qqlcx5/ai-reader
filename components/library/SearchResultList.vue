<script lang="ts" setup>
/**
 * M6 — SearchResultList
 * 搜索结果列表：使用 RecycleScroller 虚拟滚动
 * 每条结果展示：标题 + 来源类型 + 高亮 snippet
 * 高亮色：命中词背景 #fff299，文字 #5c4a00
 * 无结果时展示 EmptyState
 */
import { computed } from 'vue'
import { RecycleScroller } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import type { SearchResult } from '@/lib/library/search'
import EmptyState from '@/components/shared/EmptyState.vue'

const props = defineProps<{
  results: SearchResult[]
  query: string
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'select', result: SearchResult): void
}>()

const MATCH_TYPE_LABEL: Record<SearchResult['matchType'], string> = {
  title: '标题',
  article: '正文',
  chat: '对话',
}

const MATCH_TYPE_COLOR: Record<SearchResult['matchType'], string> = {
  title: '#5b60e5',
  article: '#2b8a3e',
  chat: '#e07c08',
}

// Enrich items with consistent height for virtual scroll
const enrichedResults = computed(() =>
  props.results.map((r) => ({ ...r, _key: r.pageId + r.matchType })),
)

function highlightSnippet(snippet: string, query: string): string {
  if (!query.trim()) return escapeHtml(snippet)
  const escaped = escapeRegex(query)
  const re = new RegExp(`(${escaped})`, 'gi')
  return escapeHtml(snippet).replace(re, '<mark class="search-hl">$1</mark>')
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
</script>

<template>
  <div class="search-result-list">
    <!-- Loading state -->
    <div v-if="loading" class="search-result-list__loading">
      <div v-for="i in 4" :key="i" class="search-result-list__skeleton" aria-hidden="true" />
    </div>

    <!-- Results via virtual scroll -->
    <RecycleScroller
      v-else-if="results.length > 0"
      class="search-result-list__scroller"
      :items="enrichedResults"
      :item-size="72"
      key-field="_key"
      v-slot="{ item }"
    >
      <div
        class="search-result-item"
        role="button"
        tabindex="0"
        @click="emit('select', item)"
        @keydown.enter="emit('select', item)"
      >
        <!-- Left: favicon -->
        <div class="search-result-item__favicon-wrap">
          <img
            v-if="item.favicon"
            class="search-result-item__favicon"
            :src="item.favicon"
            :alt="item.domain || ''"
            loading="lazy"
            @error="($event.target as HTMLImageElement).style.display = 'none'"
          />
          <span v-else class="search-result-item__favicon-fallback">
            {{ (item.domain || '?').charAt(0).toUpperCase() }}
          </span>
        </div>

        <!-- Main content -->
        <div class="search-result-item__body">
          <div class="search-result-item__title">{{ item.title }}</div>
          <div
            class="search-result-item__snippet"
            v-html="highlightSnippet(item.snippet, query)"
          />
        </div>

        <!-- Match type badge -->
        <div
          class="search-result-item__badge"
          :style="{ color: MATCH_TYPE_COLOR[item.matchType], background: MATCH_TYPE_COLOR[item.matchType] + '18' }"
        >
          {{ MATCH_TYPE_LABEL[item.matchType] }}
        </div>
      </div>
    </RecycleScroller>

    <!-- Empty state -->
    <EmptyState
      v-else-if="!loading && query"
      icon="🔍"
      title="未找到相关记录"
      :description="`没有找到包含「${query}」的内容`"
      size="sm"
    />
  </div>
</template>

<style scoped>
.search-result-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* Skeleton loading */
.search-result-list__loading {
  padding: 8px 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.search-result-list__skeleton {
  height: 68px;
  border-radius: var(--radius-md, 8px);
  background: linear-gradient(90deg, var(--card, #faf9f5) 25%, var(--border, #e6e2d8) 50%, var(--card, #faf9f5) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Virtual scroller */
.search-result-list__scroller {
  flex: 1;
  overflow-y: auto;
  padding: 4px 6px;
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar, #dedad0) transparent;
}

.search-result-list__scroller::-webkit-scrollbar {
  width: 4px;
}

.search-result-list__scroller::-webkit-scrollbar-thumb {
  background: var(--scrollbar, #dedad0);
  border-radius: 2px;
}

/* Result item */
.search-result-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  height: 72px;
  box-sizing: border-box;
  border-radius: var(--radius-md, 8px);
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, box-shadow 0.12s;
  outline: none;
}

.search-result-item:hover,
.search-result-item:focus-visible {
  background: var(--bg, #f4f2ec);
  border-color: var(--border, #e6e2d8);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.search-result-item__favicon-wrap {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 9px;
  overflow: hidden;
  background: var(--card, #faf9f5);
  border: 1px solid var(--border, #e6e2d8);
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-result-item__favicon {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.search-result-item__favicon-fallback {
  font-size: 14px;
  font-weight: 700;
  color: var(--muted, #7a7568);
}

.search-result-item__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.search-result-item__title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text, #2e2d2a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-result-item__snippet {
  font-size: 11px;
  color: var(--muted, #7a7568);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.4;
}

/* Highlight mark injected via v-html */
.search-result-item__snippet :deep(.search-hl) {
  background: #fff299;
  color: #5c4a00;
  border-radius: 2px;
  padding: 0 1px;
}

.search-result-item__badge {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: var(--radius-pill, 999px);
  white-space: nowrap;
}
</style>
