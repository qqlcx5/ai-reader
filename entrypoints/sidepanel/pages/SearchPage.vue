<script lang="ts" setup>
import { ref, watch } from 'vue';
import { search } from '@/core/search/index-coordinator';
import { searchFallback } from '@/core/search/index-coordinator';
import type { SearchResult, CapturedDocument } from '@/shared/types';
import { getDocument } from '@/db/document-repository';
import dayjs from 'dayjs';

const emit = defineEmits<{
  (e: 'open-doc', doc: CapturedDocument): void;
}>();

const query = ref('');
const results = ref<SearchResult[]>([]);
const loading = ref(false);
let debounceTimer: number | null = null;

watch(query, (q) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => doSearch(q), 300);
});

async function doSearch(q: string): Promise<void> {
  if (!q.trim()) {
    results.value = [];
    return;
  }
  loading.value = true;
  try {
    let r: SearchResult[];
    try {
      r = await search(q, 20);
    } catch (err) {
      console.warn('[Search] using fallback:', err);
      r = await searchFallback(q, 20);
    }
    results.value = r;
  } finally {
    loading.value = false;
  }
}

async function openResult(r: SearchResult): Promise<void> {
  const doc = await getDocument(r.id);
  if (doc) emit('open-doc', doc);
}

function urlHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
</script>

<template>
  <div class="search-page">
    <div class="search-bar">
      <input
        v-model="query"
        type="text"
        placeholder="搜索标题或内容..."
        autofocus
      />
    </div>

    <div class="results">
      <div v-if="loading" class="status">搜索中...</div>
      <div v-else-if="!query.trim()" class="status">输入关键词开始搜索</div>
      <div v-else-if="results.length === 0" class="status">无匹配结果</div>
      <div
        v-for="r in results"
        :key="r.id"
        class="result"
        @click="openResult(r)"
      >
        <div class="result-title">{{ r.title }}</div>
        <div v-if="r.snippet" class="result-snippet">{{ r.snippet }}</div>
        <div class="result-meta">
          <span class="result-url">{{ urlHostname(r.url) }}</span>
          <span class="result-date">{{ dayjs(r.createdAt).format('YYYY-MM-DD') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.search-bar {
  padding: 12px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 13px;
  background: var(--color-bg);
  color: var(--color-text);
}
input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.results {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.status {
  padding: 40px 16px;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.result {
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background 0.15s;
}
.result:hover {
  background: var(--color-bg-secondary);
}

.result-title {
  font-weight: 500;
  margin-bottom: 4px;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-snippet {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.result-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--color-text-secondary);
}
</style>
