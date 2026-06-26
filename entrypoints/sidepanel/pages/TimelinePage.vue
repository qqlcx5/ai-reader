<template>
  <div class="h-full flex flex-col p-4">
    <!-- Stats -->
    <div class="grid grid-cols-3 gap-3 mb-4">
      <div class="p-3 rounded-lg bg-surface-100 dark:bg-surface-800">
        <p class="text-2xl font-semibold text-surface-800 dark:text-surface-100">{{ stats.totalDocuments }}</p>
        <p class="text-xs text-surface-500 dark:text-surface-400">文档总数</p>
      </div>
      <div class="p-3 rounded-lg bg-surface-100 dark:bg-surface-800">
        <p class="text-2xl font-semibold text-surface-800 dark:text-surface-100">{{ formatNumber(stats.totalWords) }}</p>
        <p class="text-xs text-surface-500 dark:text-surface-400">总字数</p>
      </div>
      <div class="p-3 rounded-lg bg-surface-100 dark:bg-surface-800">
        <p class="text-2xl font-semibold text-surface-800 dark:text-surface-100">{{ stats.averageReadingTime }}h</p>
        <p class="text-xs text-surface-500 dark:text-surface-400">阅读时长</p>
      </div>
    </div>

    <!-- Timeline -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="documentStore.isLoading" class="flex items-center justify-center h-32">
        <div class="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full"></div>
      </div>

      <div v-else-if="timeline.length === 0" class="text-center py-12">
        <Clock class="w-12 h-12 mx-auto text-surface-300 dark:text-surface-600 mb-3" />
        <p class="text-surface-500 dark:text-surface-400">暂无历史记录</p>
      </div>

      <div v-else class="space-y-6">
        <div v-for="entry in timeline" :key="entry.date">
          <h3 class="text-sm font-medium text-surface-500 dark:text-surface-400 mb-2 sticky top-0 bg-surface-50 dark:bg-surface-900 py-1">
            {{ formatDate(entry.date) }}
            <span class="ml-2 text-xs">{{ entry.count }} 篇</span>
          </h3>
          <div class="space-y-2">
            <div
              v-for="doc in entry.documents"
              :key="doc.id"
              @click="openDocument(doc)"
              class="p-3 rounded-lg cursor-pointer hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            >
              <div class="flex items-start gap-3">
                <img
                  v-if="doc.favicon"
                  :src="doc.favicon"
                  class="w-5 h-5 mt-0.5 rounded"
                  @error="$event.target.style.display='none'"
                />
                <div class="flex-1 min-w-0">
                  <h3 class="font-medium text-sm text-surface-800 dark:text-surface-100 truncate">
                    {{ doc.title }}
                  </h3>
                  <p class="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                    {{ doc.siteName }} · {{ doc.readingTime }} 分钟阅读
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Clock } from '@lucide/vue'
import { useDocumentStore } from '@/core/documents/store'
import type { CapturedDocument, TimelineEntry } from '@/shared/types'
import { formatDate } from '@/shared/utils'

const documentStore = useDocumentStore()

const stats = computed(() => {
  const docs = documentStore.documents
  const totalWords = docs.reduce((sum, doc) => sum + (doc.wordCount || 0), 0)
  const totalReadingTime = docs.reduce((sum, doc) => sum + (doc.readingTime || 0), 0)

  return {
    totalDocuments: docs.length,
    totalWords,
    averageReadingTime: Math.round(totalReadingTime / 60 * 10) / 10 || 0,
  }
})

const timeline = computed<TimelineEntry[]>(() => {
  const grouped = new Map<string, CapturedDocument[]>()

  documentStore.documents
    .slice()
    .sort((a, b) => b.capturedAt - a.capturedAt)
    .forEach((doc) => {
      const date = new Date(doc.capturedAt).toISOString().split('T')[0]
      if (!grouped.has(date)) {
        grouped.set(date, [])
      }
      grouped.get(date)!.push(doc)
    })

  return Array.from(grouped.entries()).map(([date, documents]) => ({
    date,
    documents,
    count: documents.length,
  }))
})

function formatNumber(num: number): string {
  if (num >= 10000) return (num / 10000).toFixed(1) + 'w'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
  return num.toString()
}

function openDocument(doc: CapturedDocument) {
  documentStore.setCurrentDocument(doc)
}

onMounted(() => {
  documentStore.loadDocuments()
})
</script>
