<script lang="ts" setup>
import 'virtual:uno.css';
import '@/assets/theme.css';
import '@/assets/provider-icons.css';
import '@/assets/code-blocks.css';
import { onMounted, onUnmounted, ref, computed, defineAsyncComponent } from 'vue';
import { useContentStore } from '@/stores/content';
import { useComparisonStore } from '@/stores/comparison';
import { useSettingsStore } from '@/stores/settings';
import { useRSSStore } from '@/stores/rss';
import { useNetworkStatus } from '@/utils/network';
import { renderMarkdown } from '@/utils/markdown';
import { FileText, AlertTriangle, ChevronDown, WifiOff, RefreshCw, ListCollapse, Rss, Timer, Terminal, Sliders } from 'lucide-vue-next';
import { browser } from 'wxt/browser';
import ActionBar from '@/components/ActionBar.vue';
import ComparisonGrid from '@/components/ComparisonGrid.vue';
import ErrorBoundary from '@/components/ErrorBoundary.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';
import BaseState from '@/components/base/BaseState.vue';
import BaseButton from '@/components/base/BaseButton.vue';

const HistoryPanel = defineAsyncComponent(() => import('@/components/HistoryPanel.vue'));
const RSSDigestView = defineAsyncComponent(() => import('@/components/RSSDigestView.vue'));

const content = useContentStore();
const comparison = useComparisonStore();
const settings = useSettingsStore();
const rss = useRSSStore();
const { isOnline } = useNetworkStatus();

const showPageContent = ref(false);
const theme = ref<'light' | 'dark' | 'auto'>('auto');

// 1.html-style tab navigation: 工作站 / RSS 晨报 / 历史
type TabId = 'workspace' | 'rss' | 'history';
const activeTab = ref<TabId>('workspace');

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

// Listen for RSS digest updates
function handleRSSUpdate(message: { action: string }) {
  if (message.action === 'rss-digest-updated') {
    rss.load();
  }
}

onMounted(() => {
  content.fetchContent();
  rss.load();
  browser.runtime.onMessage.addListener(handleShortcut);
  browser.runtime.onMessage.addListener(handleRSSUpdate);
  window.addEventListener('keydown', handleKeydown);
  mediaQuery.addEventListener('change', handleThemeChange);
  loadTheme();
});

onUnmounted(() => {
  browser.runtime.onMessage.removeListener(handleShortcut);
  browser.runtime.onMessage.removeListener(handleRSSUpdate);
  window.removeEventListener('keydown', handleKeydown);
  mediaQuery.removeEventListener('change', handleThemeChange);
  comparison.abortAll();
});
</script>

<template>
  <div class="flex flex-col h-screen bg-[var(--background-canvas)] text-[var(--text-normal)]">
    <!-- Offline banner (full-width, above header) -->
    <div
      v-if="!isOnline"
      class="flex items-center gap-2 px-4 py-1.5 bg-[var(--text-error)] text-white text-[var(--font-ui-smaller)] font-medium shrink-0 animate-slide-down"
      role="alert"
    >
      <WifiOff class="w-3.5 h-3.5 shrink-0" />
      <span class="flex-1">网络断开：当前处于离线模式</span>
    </div>

    <!-- Header: Tab segmented control + action buttons (1.html inspired) -->
    <header class="bg-[var(--background-primary)] border-b border-[var(--background-modifier-border)] px-4 py-2.5 flex items-center justify-between shrink-0">
      <!-- Tab segmented control -->
      <div class="flex bg-[var(--background-primary-alt)] p-0.5 rounded-[var(--radius-m)] [corner-shape:var(--corner-shape)]">
        <button
          type="button"
          :class="[
            'px-3 py-1.5 rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] text-[var(--font-ui-smallest)] font-medium transition-all duration-150 flex items-center gap-1',
            activeTab === 'workspace'
              ? 'bg-[var(--background-primary)] text-[var(--text-normal)] shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-normal)]',
          ]"
          @click="activeTab = 'workspace'"
        >
          <Terminal class="w-3 h-3" />
          工作站
        </button>
        <button
          type="button"
          :class="[
            'px-3 py-1.5 rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] text-[var(--font-ui-smallest)] font-medium transition-all duration-150 flex items-center gap-1 relative',
            activeTab === 'rss'
              ? 'bg-[var(--background-primary)] text-[var(--text-normal)] shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-normal)]',
          ]"
          @click="activeTab = 'rss'"
        >
          <Rss class="w-3 h-3" />
          RSS 晨报
          <span
            v-if="rss.unreadCount > 0"
            class="absolute -top-1 -right-1 min-w-[14px] h-[14px] flex items-center justify-center text-[8px] font-bold text-white bg-[var(--text-error)] rounded-full px-0.5 border-2 border-[var(--background-primary)]"
          >
            {{ rss.unreadCount > 99 ? '99+' : rss.unreadCount }}
          </span>
        </button>
        <button
          type="button"
          :class="[
            'px-3 py-1.5 rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] text-[var(--font-ui-smallest)] font-medium transition-all duration-150 flex items-center gap-1',
            activeTab === 'history'
              ? 'bg-[var(--background-primary)] text-[var(--text-normal)] shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-normal)]',
          ]"
          @click="activeTab = 'history'"
        >
          <Timer class="w-3 h-3" />
          历史
        </button>
      </div>

      <!-- Action buttons -->
      <div class="flex items-center gap-0.5">
        <ThemeToggle @change="applyTheme" />
        <button
          type="button"
          class="text-[var(--text-muted)] hover:text-[var(--text-normal)] p-1.5 hover:bg-[var(--background-modifier-hover)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] transition-colors"
          aria-label="设置"
          title="设置"
          @click="browser.runtime.openOptionsPage()"
        >
          <Sliders class="w-4 h-4" />
        </button>
      </div>
    </header>

    <!-- Stale content banner (workspace only) — 1.html amber warning style -->
    <div
      v-if="activeTab === 'workspace' && content.rawContent && content.isStale && !content.loading && !comparison.isRunning"
      class="flex items-center justify-between gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200/80 dark:border-amber-700/40 animate-slide-down shrink-0"
      role="status"
    >
      <div class="flex items-center gap-1.5 text-[11px] text-amber-800 dark:text-amber-300 min-w-0">
        <AlertTriangle class="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <span class="truncate">
          正文缓存于 {{ content.extractedAgo || '较久' }}前，可能已陈旧
        </span>
      </div>
      <button
        type="button"
        class="text-[11px] font-semibold text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-800/40 hover:bg-amber-200 dark:hover:bg-amber-700/40 px-2 py-0.5 rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] transition-all shrink-0"
        :disabled="content.loading || !isOnline"
        aria-label="重新抓取页面内容"
        @click="content.fetchContent()"
      >
        重新抓取
      </button>
    </div>

    <!-- ═══════════ TAB: 工作站 (workspace) ═══════════ -->
    <div v-if="activeTab === 'workspace'" class="flex-1 flex flex-col overflow-hidden min-h-0 relative">

      <!-- Loading skeleton -->
      <div v-if="content.loading" class="flex-1 p-4 space-y-3 overflow-y-auto scrollbar-thin pb-[180px]">
        <div class="space-y-2">
          <div class="h-5 skeleton-loading rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] w-3/4"></div>
          <div class="h-3 skeleton-loading rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] w-1/2"></div>
        </div>
        <div class="space-y-2 mt-4">
          <div class="h-3 skeleton-loading rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)]"></div>
          <div class="h-3 skeleton-loading rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] w-5/6"></div>
          <div class="h-3 skeleton-loading rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] w-4/6"></div>
          <div class="h-3 skeleton-loading rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] w-5/6"></div>
          <div class="h-3 skeleton-loading rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] w-3/4"></div>
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

      <!-- Comparison (running or done) — scrollable area with bottom padding for floating console -->
      <div v-else-if="hasSlots" class="flex-1 flex flex-col overflow-hidden min-h-0">
        <ErrorBoundary>
          <div class="flex-1 overflow-y-auto min-h-0 pb-[180px]">
            <ComparisonGrid />
          </div>
        </ErrorBoundary>
      </div>

      <!-- Content extracted but not started — show page content preview -->
      <div v-else-if="content.rawContent" class="flex-1 flex flex-col overflow-hidden min-h-0 pb-[180px]">
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
        description="点击下方 Extract 提取当前页面内容，然后选择模板提问"
        :icon="FileText"
        size="md"
      />

      <!-- Floating Command Console (1.html inspired: bottom-anchored, glass effect) -->
      <div
        v-if="content.rawContent || !content.loading"
        class="absolute bottom-3 left-3 right-3 z-30"
      >
        <div class="console-panel card-rounded shadow-[var(--shadow-panel)] border border-[var(--background-modifier-border)]/80 p-3 flex flex-col gap-2">
          <ErrorBoundary>
            <ActionBar />
          </ErrorBoundary>
        </div>
      </div>
    </div>

    <!-- ═══════════ TAB: RSS 晨报 ═══════════ -->
    <div v-else-if="activeTab === 'rss'" class="flex-1 flex flex-col overflow-hidden min-h-0">
      <Suspense>
        <RSSDigestView />
      </Suspense>
    </div>

    <!-- ═══════════ TAB: 历史归档 ═══════════ -->
    <div v-else-if="activeTab === 'history'" class="flex-1 flex flex-col overflow-hidden min-h-0">
      <Suspense>
        <HistoryPanel @close="activeTab = 'workspace'" />
      </Suspense>
    </div>
  </div>
</template>
