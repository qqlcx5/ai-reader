<script lang="ts" setup>
import 'virtual:uno.css';
import '@/assets/theme.css';
import '@/assets/provider-icons.css';
import '@/assets/code-blocks.css';
import { onMounted, onUnmounted, ref, computed, defineAsyncComponent } from 'vue';
import { useContentStore } from '@/stores/content';
import { useComparisonStore } from '@/stores/comparison';
import { useSettingsStore } from '@/stores/settings';
import { useNetworkStatus } from '@/utils/network';
import { getProviderName, getProviderIcon } from '@/utils/providers';
import { renderMarkdown } from '@/utils/markdown';
import { FileText, AlertCircle, History, X, ChevronDown, WifiOff, RefreshCw, ListCollapse, Sparkles } from 'lucide-vue-next';
import { browser } from 'wxt/browser';
import ActionBar from '@/components/ActionBar.vue';
import ComparisonGrid from '@/components/ComparisonGrid.vue';
import ErrorBoundary from '@/components/ErrorBoundary.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';
import BaseState from '@/components/base/BaseState.vue';
import BaseButton from '@/components/base/BaseButton.vue';
import BaseIconButton from '@/components/base/BaseIconButton.vue';

const ExportMenu = defineAsyncComponent(() => import('@/components/ExportMenu.vue'));
const HistoryPanel = defineAsyncComponent(() => import('@/components/HistoryPanel.vue'));

const content = useContentStore();
const comparison = useComparisonStore();
const settings = useSettingsStore();
const { isOnline } = useNetworkStatus();

const showHistory = ref(false);
const showPageContent = ref(false);
const theme = ref<'light' | 'dark' | 'auto'>('auto');

const hasSlots = computed(() => comparison.slots.length > 0);
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
  <div class="flex flex-col h-screen bg-[var(--background-primary)] text-[var(--text-normal)]">
    <!-- Offline banner -->
    <div
      v-if="!isOnline"
      class="flex items-center gap-2 px-4 py-1.5 bg-[var(--background-modifier-warning)] border-b border-[var(--background-modifier-border)] text-[var(--text-warning)] text-[var(--font-ui-smaller)]"
      role="alert"
    >
      <WifiOff class="w-3.5 h-3.5 shrink-0" />
      <span>网络已断开，部分功能不可用</span>
    </div>

    <!-- Header -->
    <header class="flex items-center gap-2 px-3 h-11 border-b border-[var(--background-modifier-border)] bg-[var(--background-primary)] shrink-0">
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <div class="w-6 h-6 rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] bg-[var(--color-accent-soft)] flex items-center justify-center shrink-0">
          <FileText class="w-3.5 h-3.5 text-[var(--text-accent)]" />
        </div>
        <div class="min-w-0">
          <h1 class="text-[var(--font-ui-medium)] font-semibold truncate leading-tight">
            {{ content.title || 'AI Reader' }}
          </h1>
        </div>
        <span
          v-if="comparison.isRunning"
          class="pill-accent !text-[10px] !py-0 shrink-0"
          aria-live="polite"
        >
          <Sparkles class="w-2.5 h-2.5 animate-pulse" />
          {{ comparison.slots.filter(s => s.status === 'streaming').length }} /
          {{ comparison.slots.length }}
        </span>
      </div>
      <div class="flex items-center gap-0.5 shrink-0">
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
          type="button"
          :class="['clickable-icon', showHistory && 'clickable-icon-active']"
          aria-label="历史记录"
          title="历史记录"
          @click="showHistory = !showHistory"
        >
          <History class="w-4 h-4" />
        </button>
        <button
          type="button"
          class="btn-primary-sm"
          :class="content.loading && 'opacity-70 cursor-wait'"
          :disabled="content.loading || !isOnline"
          aria-label="提取页面内容"
          @click="content.fetchContent()"
        >
          <RefreshCw v-if="!content.loading" class="w-3 h-3" />
          <span v-else class="w-3 h-3 inline-block border-2 border-current border-t-transparent rounded-full animate-spin" />
          Extract
        </button>
      </div>
    </header>

    <!-- History panel overlay -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div
        v-if="showHistory"
        class="absolute inset-x-0 top-11 bottom-0 z-20 bg-[var(--background-primary)] shadow-[var(--shadow-l)] border-t border-[var(--background-modifier-border)] flex flex-col"
      >
        <div class="flex items-center justify-between px-4 h-10 border-b border-[var(--background-modifier-border)] shrink-0">
          <h2 class="text-[var(--font-ui-medium)] font-semibold">历史记录</h2>
          <button
            type="button"
            class="clickable-icon !w-7 !h-7"
            aria-label="关闭历史记录"
            @click="showHistory = false"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
        <div class="flex-1 overflow-hidden">
          <Suspense>
            <HistoryPanel @close="showHistory = false" />
          </Suspense>
        </div>
      </div>
    </Transition>

    <!-- Action bar -->
    <ErrorBoundary>
      <ActionBar v-if="content.rawContent && !hasSlots" class="shrink-0" />
    </ErrorBoundary>

    <!-- Main content area -->
    <div class="flex-1 flex flex-col overflow-hidden min-h-0">
      <!-- Loading skeleton -->
      <div v-if="content.loading" class="flex-1 p-4 space-y-3 overflow-y-auto scrollbar-thin">
        <div class="space-y-2">
          <div class="h-5 bg-[var(--background-secondary)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] animate-pulse w-3/4"></div>
          <div class="h-3 bg-[var(--background-secondary)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] animate-pulse w-1/2"></div>
        </div>
        <div class="space-y-2 mt-4">
          <div class="h-3 bg-[var(--background-secondary)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] animate-pulse"></div>
          <div class="h-3 bg-[var(--background-secondary)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] animate-pulse w-5/6"></div>
          <div class="h-3 bg-[var(--background-secondary)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] animate-pulse w-4/6"></div>
          <div class="h-3 bg-[var(--background-secondary)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] animate-pulse w-5/6"></div>
          <div class="h-3 bg-[var(--background-secondary)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] animate-pulse w-3/4"></div>
        </div>
      </div>

      <!-- Error -->
      <BaseState
        v-else-if="content.error"
        variant="error"
        title="提取失败"
        :description="content.error"
        size="md"
        role="alert"
      >
        <BaseButton variant="primary" size="md" :disabled="!isOnline" @click="content.fetchContent()">
          重试
        </BaseButton>
      </BaseState>

      <!-- Empty (no providers) -->
      <BaseState
        v-else-if="settings.enabledProviders.length === 0"
        variant="info"
        title="未启用任何 AI 模型"
        description="请在设置中至少启用一个 Provider"
        size="md"
      >
        <BaseButton variant="primary" size="md" @click="browser.runtime.openOptionsPage()">
          打开设置
        </BaseButton>
      </BaseState>

      <!-- Comparison (running or done) -->
      <div v-else-if="hasSlots" class="flex-1 flex flex-col overflow-hidden min-h-0">
        <ErrorBoundary>
          <div class="flex-1 overflow-y-auto min-h-0">
            <ComparisonGrid />
          </div>
        </ErrorBoundary>

        <!-- Inline action bar (always visible while comparison exists) -->
        <ActionBar class="shrink-0" />
      </div>

      <!-- Content only (extracted but not started) -->
      <div v-else-if="content.rawContent" class="flex-1 flex flex-col overflow-hidden min-h-0">
        <button
          type="button"
          class="flex items-center justify-between w-full px-4 h-9 text-[var(--font-ui-smaller)] text-[var(--text-muted)] hover:bg-[var(--background-modifier-hover)] border-b border-[var(--background-modifier-border)] transition-colors focus-visible:outline-none focus-visible:bg-[var(--background-modifier-hover)]"
          :aria-expanded="showPageContent"
          @click="showPageContent = !showPageContent"
        >
          <span class="font-medium inline-flex items-center gap-1.5">
            <ListCollapse class="w-3.5 h-3.5" />
            页面内容
          </span>
          <ChevronDown
            class="w-3.5 h-3.5 transition-transform"
            :class="showPageContent ? 'rotate-180' : ''"
          />
        </button>
        <div class="flex-1 overflow-y-auto scrollbar-thin px-4 py-4">
          <p class="text-[10px] text-[var(--text-faint)] mb-3">
            {{ content.url }} · {{ content.wordCount.toLocaleString() }} 字
          </p>
          <article
            class="prose dark:prose-invert max-w-none text-[var(--font-ui-smaller)] leading-relaxed"
            v-html="renderMarkdown(content.rawContent)"
          />
        </div>
      </div>

      <!-- Empty state (no extraction yet) -->
      <BaseState
        v-else
        variant="empty"
        title="AI Reader"
        description="点击右上角 Extract 提取当前页面内容，然后选择模板提问"
        :icon="FileText"
        size="md"
      >
        <BaseButton variant="primary" size="md" :disabled="!isOnline" @click="content.fetchContent()">
          <RefreshCw class="w-3.5 h-3.5" />
          Extract
        </BaseButton>
      </BaseState>
    </div>
  </div>
</template>
