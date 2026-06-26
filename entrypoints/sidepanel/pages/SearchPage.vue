<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useSearchStore } from '@/stores/search.store';
import { useDocumentStore } from '@/stores/document.store';
import { getSearchClient } from '@/core/search/search.client';
import { documentRepository } from '@/core/documents/document.repository';
import type { SearchResult } from '@/db/schema';

const searchStore = useSearchStore();
const documentStore = useDocumentStore();
const searchQuery = ref('');
const searchClient = getSearchClient();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

onMounted(() => {
  searchClient.onReady(() => {
    searchStore.setIndexReady(true);
  });
});

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
});

watch(searchQuery, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer);

  if (!val.trim()) {
    searchStore.setResults([]);
    searchStore.setQuery('');
    return;
  }

  debounceTimer = setTimeout(async () => {
    searchStore.setLoading(true);
    searchStore.setQuery(val);

    try {
      const results = await searchClient.search(val);
      searchStore.setResults(results);
    } catch (err) {
      console.error('Search failed:', err);
      // 降级：使用 Dexie 简单匹配
      const docs = await documentRepository.getAll();
      const fallbackResults: SearchResult[] = docs
        .filter((d) => d.title.toLowerCase().includes(val.toLowerCase()))
        .map((d) => ({
          id: d.id,
          title: d.title,
          url: d.url,
          score: 1,
          createdAt: d.createdAt,
        }));
      searchStore.setResults(fallbackResults);
    } finally {
      searchStore.setLoading(false);
    }
  }, 300);
});

async function handleResultClick(result: SearchResult) {
  const doc = await documentRepository.getById(result.id);
  if (doc) {
    documentStore.setCurrentDocument(doc);
  }
}

function highlightMatch(text: string, query: string): string {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark class="bg-yellow-200">$1</mark>');
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Search Input -->
    <div class="p-4 border-b border-slate-200 bg-white">
      <input
        v-model="searchQuery"
        class="input"
        type="text"
        placeholder="搜索已捕获的文档..."
      />
      <div v-if="!searchStore.indexReady" class="text-xs text-yellow-600 mt-1">
        搜索索引构建中...
      </div>
    </div>

    <!-- Results -->
    <div class="flex-1 overflow-y-auto">
      <!-- Loading -->
      <div v-if="searchStore.loading" class="flex items-center justify-center h-32 text-slate-400 text-sm">
        搜索中...
      </div>

      <!-- Empty query -->
      <div v-else-if="!searchQuery" class="flex items-center justify-center h-full text-slate-400 text-sm">
        输入关键词搜索文档
      </div>

      <!-- No results -->
      <div v-else-if="searchStore.results.length === 0" class="flex items-center justify-center h-full text-slate-400 text-sm">
        无搜索结果
      </div>

      <!-- Results list -->
      <div v-else class="divide-y divide-slate-100">
        <div
          v-for="result in searchStore.results"
          :key="result.id"
          class="px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
          @click="handleResultClick(result)"
        >
          <h3 class="text-sm font-medium text-slate-800 truncate" v-html="highlightMatch(result.title, searchQuery)" />
          <p v-if="result.url" class="text-xs text-slate-500 truncate mt-0.5">
            {{ result.url }}
          </p>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-xs text-slate-400">
              {{ new Date(result.createdAt).toLocaleDateString() }}
            </span>
            <span class="text-xs text-slate-300">·</span>
            <span class="text-xs text-slate-400">
              相关度 {{ Math.round(result.score * 100) }}%
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
