<script lang="ts" setup>
import { onMounted, onUnmounted, ref, computed, defineAsyncComponent } from 'vue';
import { useContentStore } from '@/stores/content';
import { useComparisonStore } from '@/stores/comparison';
import { useNetworkStatus } from '@/utils/network';
import { Loader2, FileText, AlertCircle, History, X, ChevronDown, ChevronUp, WifiOff } from 'lucide-vue-next';
import { browser } from 'wxt/browser';
import { renderMarkdown } from '@/utils/markdown';
import ActionBar from '@/components/ActionBar.vue';
import ComparisonGrid from '@/components/ComparisonGrid.vue';
import ErrorBoundary from '@/components/ErrorBoundary.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';

const ExportMenu = defineAsyncComponent(() => import('@/components/ExportMenu.vue'));
const HistoryPanel = defineAsyncComponent(() => import('@/components/HistoryPanel.vue'));

const content = useContentStore();
const comparison = useComparisonStore();
const { isOnline } = useNetworkStatus();
const showHistory = ref(false);
const showPageContent = ref(false);
const theme = ref<'light' | 'dark' | 'auto'>('auto');

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

function applyTheme(t: 'light' | 'dark' | 'auto') {
  theme.value = t;
  const isDark = t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
}

async function loadTheme() {
  try {
    const data = await browser.storage.local.get('ai-reader-theme');
    const saved = (data['ai-reader-theme'] as 'light' | 'dark' | 'auto') || 'auto';
    applyTheme(saved);
  } catch {
    applyTheme('auto');
  }
}

const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
function handleThemeChange() {
  if (theme.value === 'auto') applyTheme('auto');
}

onMounted(() => {
  content.fetchContent();
  browser.runtime.onMessage.addListener(handleShortcut);
  window.addEventListener('keydown', handleKeydown);
  mediaQuery.addEventListener('change', handleThemeChange);
  loadTheme();
});

onUnmounted(() => {
  browser.runtime.onMessage.removeListener(handleShortcut);
  window.removeEventListener('keydown', handleKeydown);
  mediaQuery.removeEventListener('change', handleThemeChange);
  comparison.abortAll();
});
</script>

<template>
  <div class="flex flex-col h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
    <!-- Offline banner -->
    <div
      v-if="!isOnline"
      class="flex items-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/30 border-b border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 text-sm"
      role="alert"
    >
      <WifiOff class="w-4 h-4 flex-shrink-0" />
      <span>网络已断开，部分功能不可用</span>
    </div>

    <!-- Header -->
    <header class="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
      <div class="flex items-center gap-2">
        <FileText class="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <h1 class="text-base font-semibold">AI Reader</h1>
        <span v-if="content.extractedAgo && !content.isStale" class="text-xs text-gray-400 dark:text-gray-500">
          {{ content.extractedAgo }}
        </span>
        <span v-else-if="content.isStale" class="text-xs text-yellow-600 dark:text-yellow-400" title="内容可能已过时，建议重新提取">
          ⚠ 过时
        </span>
      </div>
      <div class="flex items-center gap-2">
        <ThemeToggle @change="applyTheme" />
        <Suspense>
          <ExportMenu
            v-if="completedSummaries.length > 0"
            :title="content.title"
            :url="content.url"
            :summaries="completedSummaries"
          />
        </Suspense>
        <button
          @click="showHistory = !showHistory"
          class="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          :class="{ 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30': showHistory }"
          aria-label="历史记录"
        >
          <History class="w-4 h-4" />
        </button>
        <button
          @click="content.fetchContent()"
          class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="content.loading || !isOnline"
        >
          <Loader2 v-if="content.loading" class="w-4 h-4 animate-spin inline-block" />
          <span v-else>Extract</span>
        </button>
      </div>
    </header>

    <!-- History panel overlay -->
    <div
      v-if="showHistory"
      class="absolute inset-x-0 top-[52px] bottom-0 z-20 bg-white dark:bg-gray-900 shadow-lg border-t border-gray-200 dark:border-gray-800"
    >
      <div class="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-800">
        <h2 class="text-sm font-semibold">历史记录</h2>
        <button
          @click="showHistory = false"
          class="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          aria-label="关闭历史记录"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
      <Suspense>
        <HistoryPanel />
      </Suspense>
    </div>

    <!-- Action bar -->
    <ErrorBoundary>
      <ActionBar v-if="content.rawContent" class="flex-shrink-0" />
    </ErrorBoundary>

    <!-- Main content area -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Loading skeleton -->
      <div v-if="content.loading" class="flex-1 p-4 space-y-4">
        <div class="h-6 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-3/4"></div>
        <div class="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-1/2"></div>
        <div class="space-y-2 mt-6">
          <div class="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
          <div class="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-5/6"></div>
          <div class="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-4/6"></div>
          <div class="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-5/6"></div>
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="content.error" class="flex flex-col items-center justify-center flex-1 text-red-500 dark:text-red-400 gap-2" role="alert">
        <AlertCircle class="w-8 h-8" />
        <p class="text-sm">{{ content.error }}</p>
        <button
          @click="content.fetchContent()"
          class="mt-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          :disabled="!isOnline"
        >
          重试
        </button>
      </div>

      <!-- Content + Comparison -->
      <div v-else-if="content.rawContent" class="flex-1 flex flex-col overflow-hidden">
        <ErrorBoundary>
          <div
            v-if="hasSlots"
            class="flex-1 overflow-y-auto min-h-0"
          >
            <ComparisonGrid />
          </div>
        </ErrorBoundary>

        <div
          class="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
          :class="hasSlots ? '' : 'flex-1 overflow-y-auto'"
        >
          <button
            @click="showPageContent = !showPageContent"
            class="flex items-center justify-between w-full px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            :aria-expanded="showPageContent"
          >
            <span class="font-medium">页面内容</span>
            <component :is="showPageContent ? ChevronUp : ChevronDown" class="w-4 h-4" />
          </button>
          <div v-if="showPageContent || !hasSlots" class="px-4 pb-4">
            <div class="flex items-center justify-between mb-2">
              <h2 class="text-lg font-bold">{{ content.title }}</h2>
            </div>
            <p class="text-xs text-gray-400 dark:text-gray-500 mb-4">
              {{ content.url }} · {{ content.wordCount }} 字
            </p>
            <article class="prose prose-sm dark:prose-invert max-w-none" v-html="sanitizedContent"></article>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="flex flex-col items-center justify-center flex-1 text-gray-400 dark:text-gray-500 gap-2">
        <FileText class="w-12 h-12" />
        <p class="text-sm">点击 "Extract" 提取当前页面内容</p>
      </div>
    </div>
  </div>
</template>
