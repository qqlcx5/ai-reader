<template>
  <div class="h-full flex flex-col p-4">
    <!-- Search input + status -->
    <div class="mb-3">
      <div class="relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
        <input
          v-model="searchQuery"
          @input="onInput"
          @keyup.enter="performSearch"
          type="text"
          placeholder="搜索文档..."
          class="w-full pl-10 pr-10 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          v-if="searchQuery"
          @click="clearSearch"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          aria-label="Clear"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
      <div class="mt-1.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span data-testid="index-status">
          <template v-if="searchStore.indexStatus === 'indexing'">
            <Loader2 class="inline w-3 h-3 mr-1 animate-spin" />
            正在建立索引…
          </template>
          <template v-else-if="searchStore.indexStatus === 'ready'">
            {{ searchStore.indexSize }} 个文档已索引
          </template>
          <template v-else-if="searchStore.indexStatus === 'error'">
            索引异常，搜索结果可能不完整
          </template>
          <template v-else>索引未初始化</template>
        </span>
        <span v-if="searchStore.isSearching" class="text-brand-500">
          搜索中…
        </span>
      </div>
    </div>

    <!-- Search history -->
    <div v-if="searchStore.searchHistory.length > 0 && !searchQuery" class="mb-4">
      <h3 class="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">最近搜索</h3>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="query in searchStore.searchHistory"
          :key="query"
          @click="searchQuery = query; performSearch()"
          class="px-3 py-1 text-sm rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          {{ query }}
        </button>
      </div>
    </div>

    <!-- Results -->
    <div class="flex-1 overflow-y-auto" data-testid="search-results">
      <!-- Index still warming up -->
      <div
        v-if="searchStore.indexStatus === 'indexing' && !searchQuery"
        class="text-center py-12"
      >
        <Loader2 class="w-10 h-10 mx-auto text-brand-400 mb-3 animate-spin" />
        <p class="text-slate-500 dark:text-slate-400">正在建立索引…</p>
        <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">
          完成后将自动显示结果
        </p>
      </div>

      <!-- Loading a query -->
      <div v-else-if="searchStore.isSearching" class="flex items-center justify-center h-32">
        <div class="animate-spin w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full"></div>
      </div>

      <!-- Empty result for a real query -->
      <div v-else-if="searchStore.isEmpty" class="text-center py-12">
        <Search class="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
        <p class="text-slate-500 dark:text-slate-400">未找到相关文档</p>
        <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">
          试试其他关键词
        </p>
      </div>

      <!-- Initial state -->
      <div v-else-if="!searchQuery" class="text-center py-12">
        <Search class="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
        <p class="text-slate-500 dark:text-slate-400">输入关键词开始搜索</p>
        <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">
          支持模糊匹配、字段权重（标题 3×，正文 1×）
        </p>
      </div>

      <!-- Results list -->
      <div v-else class="space-y-2">
        <div
          v-for="result in searchStore.results"
          :key="result.documentId"
          @click="openDocument(result)"
          class="p-3 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
          data-testid="search-result"
        >
          <div class="flex items-start gap-3">
            <img
              v-if="result.document.favicon"
              :src="result.document.favicon"
              class="w-5 h-5 mt-0.5 rounded flex-shrink-0"
              @error="onFaviconError"
            />
            <div class="flex-1 min-w-0">
              <h3
                class="font-medium text-sm text-slate-800 dark:text-slate-100 truncate"
                v-html="highlightText(result.document.title, searchQuery)"
              ></h3>
              <p
                v-if="result.match"
                class="text-xs text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-2"
                v-html="result.match"
              ></p>
              <p class="text-xs text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1.5">
                <span v-if="result.document.siteName" class="truncate max-w-[160px]">
                  {{ result.document.siteName }}
                </span>
                <span v-if="result.document.siteName">·</span>
                <span>{{ formatDate(result.document.createdAt) }}</span>
                <span
                  class="ml-auto px-1.5 py-0.5 text-[10px] rounded bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                  :title="`Score: ${result.score}`"
                >
                  {{ Math.round(result.score * 10) / 10 }}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Search, X, Loader2 } from '@lucide/vue'
import { useSearchStore } from '@/core/search/store'
import type { SearchResult } from '@db/schema'
import { useDocumentStore } from '@/core/documents/store'
import { useCaptureEvents } from '../use-capture-events'
import { highlightTitle, escapeRegExp } from '@/core/search/highlight'

const searchStore = useSearchStore()
const documentStore = useDocumentStore()
const { setActiveTab } = useCaptureEvents({ initialTab: 'search' })

const searchQuery = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | null = null

onMounted(async () => {
  await searchStore.refreshIndexStatus()
})

function onInput() {
  if (debounceTimer) clearTimeout(debounceTimer)
  const q = searchQuery.value.trim()
  if (q.length === 0) {
    searchStore.clearSearch()
    return
  }
  // 300ms debounce as the spec requires.
  debounceTimer = setTimeout(() => {
    void performSearch()
  }, 300)
}

async function performSearch() {
  const q = searchQuery.value.trim()
  if (!q) return
  await searchStore.search(q)
}

function clearSearch() {
  searchQuery.value = ''
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  searchStore.clearSearch()
}

function openDocument(result: SearchResult) {
  // Convert the lightweight metadata back into a CapturedDocument
  // shape for the existing ChatPage consumers.
  documentStore.setCurrentDocument({
    id: result.document.id,
    url: result.document.url,
    title: result.document.title,
    description: result.document.description,
    author: result.document.author,
    publishedAt: result.document.publishedAt,
    siteName: result.document.siteName,
    favicon: result.document.favicon,
    image: result.document.image,
    wordCount: result.document.wordCount,
    // The worker / service only ships metadata across the wire.
    // If the ChatPage needs the markdown it can request it via
    // GET_CURRENT_DOCUMENT. We provide a minimal stub here so
    // the page doesn't crash on a missing field.
    markdownContent: '',
    createdAt: result.document.createdAt,
    updatedAt: result.document.updatedAt,
  } as never)
  setActiveTab('chat')
}

function onFaviconError(event: Event) {
  const target = event.target as HTMLImageElement | null
  if (target) target.style.display = 'none'
}

/**
 * Highlight a short title with the search query. We don't
 * pre-compute a snippet for titles because they're short
 * enough to highlight inline. The helper escapes HTML and
 * wraps the matched terms in `<mark>`.
 */
function highlightText(text: string, query: string): string {
  if (!query) return escapeHtml(text)
  return highlightTitle(text, query)
}

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) => {
    return (
      {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      } as Record<string, string>
    )[c] ?? c
  })
}

function formatDate(ts: number): string {
  try {
    return new Date(ts).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(ts)
  }
}
</script>
