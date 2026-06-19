<script lang="ts" setup>
import { onMounted, onUnmounted } from 'vue';
import { useContentStore } from '@/stores/content';
import { useComparisonStore } from '@/stores/comparison';
import { Loader2, FileText, AlertCircle, History } from 'lucide-vue-next';
import { browser } from 'wxt/browser';
import ActionBar from '@/components/ActionBar.vue';
import ComparisonGrid from '@/components/ComparisonGrid.vue';
import ExportMenu from '@/components/ExportMenu.vue';
import HistoryPanel from '@/components/HistoryPanel.vue';
import { ref } from 'vue';

const content = useContentStore();
const comparison = useComparisonStore();
const showHistory = ref(false);

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

onMounted(() => {
  content.fetchContent();
  browser.runtime.onMessage.addListener(handleShortcut);
});

onUnmounted(() => {
  browser.runtime.onMessage.removeListener(handleShortcut);
});
</script>

<template>
  <div class="flex flex-col h-screen bg-gray-50 text-gray-900">
    <!-- Header -->
    <header class="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
      <div class="flex items-center gap-2">
        <FileText class="w-5 h-5 text-blue-600" />
        <h1 class="text-base font-semibold">AI Reader</h1>
      </div>
      <div class="flex items-center gap-2">
        <ExportMenu
          v-if="comparison.slots.some(s => s.text)"
          :title="content.title"
          :content="comparison.slots.find(s => s.text)?.text || ''"
          :url="content.url"
        />
        <button
          @click="showHistory = !showHistory"
          class="p-1.5 text-gray-500 hover:text-gray-700 transition-colors"
          :class="{ 'text-blue-600': showHistory }"
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

    <!-- History panel (overlay) -->
    <div
      v-if="showHistory"
      class="absolute inset-0 z-20 bg-white"
    >
      <HistoryPanel />
    </div>

    <!-- Action bar -->
    <ActionBar v-if="content.rawContent" />

    <!-- Comparison grid (when running) -->
    <ComparisonGrid />

    <!-- Content area -->
    <main class="flex-1 overflow-y-auto p-4">
      <!-- Loading -->
      <div v-if="content.loading" class="flex items-center justify-center h-full">
        <Loader2 class="w-8 h-8 text-blue-500 animate-spin" />
      </div>

      <!-- Error -->
      <div v-else-if="content.error" class="flex flex-col items-center justify-center h-full text-red-500 gap-2">
        <AlertCircle class="w-8 h-8" />
        <p class="text-sm">{{ content.error }}</p>
      </div>

      <!-- Content (hidden when comparison is running) -->
      <div v-else-if="content.rawContent">
        <h2 class="text-lg font-bold mb-1">{{ content.title }}</h2>
        <p class="text-xs text-gray-400 mb-4">
          {{ content.url }} · {{ content.wordCount }} words
        </p>
        <article class="prose prose-sm max-w-none" v-html="content.rawContent"></article>
      </div>

      <!-- Empty state -->
      <div v-else class="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
        <FileText class="w-12 h-12" />
        <p class="text-sm">Click "Extract" to capture the current page</p>
      </div>
    </main>
  </div>
</template>
