<script lang="ts" setup>
import { onMounted, onUnmounted, ref, computed } from 'vue';
import { useContentStore } from '@/stores/content';
import { useComparisonStore } from '@/stores/comparison';
import { Loader2, FileText, AlertCircle, History, X, ChevronDown, ChevronUp } from 'lucide-vue-next';
import { browser } from 'wxt/browser';
import DOMPurify from 'dompurify';
import { renderMarkdown } from '@/utils/markdown';
import ActionBar from '@/components/ActionBar.vue';
import ComparisonGrid from '@/components/ComparisonGrid.vue';
import ExportMenu from '@/components/ExportMenu.vue';
import HistoryPanel from '@/components/HistoryPanel.vue';

const content = useContentStore();
const comparison = useComparisonStore();
const showHistory = ref(false);
const showPageContent = ref(false);

const hasSlots = computed(() => comparison.slots.length > 0);
const sanitizedContent = computed(() => renderMarkdown(content.rawContent));
const completedSummaries = computed(() =>
  comparison.slots.filter(s => s.text).map(s => ({
    providerId: s.providerId,
    modelId: s.modelId,
    text: s.text,
  }))
);

function handleShortcut(message: { action: string; command?: string }) {
  if (message.action === 'shortcut') {
    switch (message.command) {
      case 'summarize':
        content.fetchContent();
        break;
      case 'abort-all':
        comparison.abortAll();
        break;
    }
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (comparison.isRunning) {
      comparison.abortAll();
    } else if (showHistory.value) {
      showHistory.value = false;
    }
  }
}

onMounted(() => {
  content.fetchContent();
  browser.runtime.onMessage.addListener(handleShortcut);
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  browser.runtime.onMessage.removeListener(handleShortcut);
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div class="flex flex-col h-screen bg-gray-50 text-gray-900">
    <!-- Header -->
    <header class="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
      <div class="flex items-center gap-2">
        <FileText class="w-5 h-5 text-blue-600" />
        <h1 class="text-base font-semibold">AI Reader</h1>
      </div>
      <div class="flex items-center gap-2">
        <ExportMenu
          v-if="completedSummaries.length > 0"
          :title="content.title"
          :url="content.url"
          :summaries="completedSummaries"
        />
        <button
          @click="showHistory = !showHistory"
          class="p-1.5 text-gray-500 hover:text-gray-700 transition-colors"
          :class="{ 'text-blue-600 bg-blue-50': showHistory }"
          title="History"
        >
          <History class="w-4 h-4" />
        </button>
        <button
          @click="content.fetchContent()"
          class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          :disabled="content.loading"
        >
          <Loader2 v-if="content.loading" class="w-4 h-4 animate-spin inline-block" />
          <span v-else>Extract</span>
        </button>
      </div>
    </header>

    <!-- History panel overlay -->
    <div
      v-if="showHistory"
      class="absolute inset-x-0 top-[52px] bottom-0 z-20 bg-white shadow-lg border-t border-gray-200"
    >
      <div class="flex items-center justify-between px-4 py-2 border-b border-gray-200">
        <h2 class="text-sm font-semibold">History</h2>
        <button
          @click="showHistory = false"
          class="p-1 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
      <HistoryPanel />
    </div>

    <!-- Action bar -->
    <ActionBar v-if="content.rawContent" class="flex-shrink-0" />

    <!-- Main content area -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Loading -->
      <div v-if="content.loading" class="flex items-center justify-center flex-1">
        <Loader2 class="w-8 h-8 text-blue-500 animate-spin" />
      </div>

      <!-- Error -->
      <div v-else-if="content.error" class="flex flex-col items-center justify-center flex-1 text-red-500 gap-2">
        <AlertCircle class="w-8 h-8" />
        <p class="text-sm">{{ content.error }}</p>
      </div>

      <!-- Content + Comparison -->
      <div v-else-if="content.rawContent" class="flex-1 flex flex-col overflow-hidden">
        <!-- Comparison grid - takes priority -->
        <div
          v-if="hasSlots"
          class="flex-1 overflow-y-auto min-h-0"
        >
          <ComparisonGrid />
        </div>

        <!-- Page content - collapsible reference area -->
        <div
          class="flex-shrink-0 border-t border-gray-200 bg-white"
          :class="hasSlots ? '' : 'flex-1 overflow-y-auto'"
        >
          <button
            @click="showPageContent = !showPageContent"
            class="flex items-center justify-between w-full px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <span class="font-medium">Page Content</span>
            <component :is="showPageContent ? ChevronUp : ChevronDown" class="w-4 h-4" />
          </button>
          <div v-if="showPageContent || !hasSlots" class="px-4 pb-4">
            <div class="flex items-center justify-between mb-2">
              <h2 class="text-lg font-bold">{{ content.title }}</h2>
            </div>
            <p class="text-xs text-gray-400 mb-4">
              {{ content.url }} · {{ content.wordCount }} words
            </p>
            <article class="prose prose-sm max-w-none" v-html="sanitizedContent"></article>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="flex flex-col items-center justify-center flex-1 text-gray-400 gap-2">
        <FileText class="w-12 h-12" />
        <p class="text-sm">Click "Extract" to capture the current page</p>
      </div>
    </div>
  </div>
</template>
