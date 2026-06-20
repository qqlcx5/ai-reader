<script lang="ts" setup>
import 'virtual:uno.css';
import '@/assets/theme.css';
import '@/assets/provider-icons.css';
import { ref, computed, onMounted } from 'vue';
import { useContentStore } from '@/stores/content';
import { useSettingsStore } from '@/stores/settings';
import { useComparisonStore } from '@/stores/comparison';
import { DEFAULT_PROMPTS } from '@/utils/prompts';
import { getProviderName, getProviderIcon } from '@/utils/providers';
import { FileText, Sparkles, Settings as SettingsIcon, ArrowUpRight, ExternalLink, BookOpen } from 'lucide-vue-next';
import { browser } from 'wxt/browser';
import ThemeToggle from '@/components/ThemeToggle.vue';
import BaseState from '@/components/base/BaseState.vue';

const content = useContentStore();
const settings = useSettingsStore();
const comparison = useComparisonStore();

const selectedPromptId = ref(DEFAULT_PROMPTS[0].id);
const isLoading = ref(false);
const tabTitle = ref('');
const tabUrl = ref('');
const wordCount = ref(0);

const enabledProviders = computed(() => settings.enabledProviders);
const hasNoProviders = computed(() => enabledProviders.value.length === 0);
const selectedPrompt = computed(() =>
  DEFAULT_PROMPTS.find((p) => p.id === selectedPromptId.value) || DEFAULT_PROMPTS[0]
);

async function openSidePanel() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]?.id) {
    await browser.sidePanel.open({ tabId: tabs[0].id });
  }
}

async function runPrompt() {
  if (hasNoProviders.value) return;
  isLoading.value = true;
  try {
    await content.fetchContent();
    if (!content.rawContent) return;

    const fullPrompt = `${selectedPrompt.value.prompt}\n\n${content.rawContent}`;
    comparison.initSlots(settings.enabledProviders);
    comparison.startAll(fullPrompt);

    await openSidePanel();
  } finally {
    isLoading.value = false;
  }
}

function openOptions() {
  browser.runtime.openOptionsPage();
}

onMounted(async () => {
  content.clear();
  // Capture current tab info for the page card (1.html style)
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      tabTitle.value = tabs[0].title || '';
      tabUrl.value = tabs[0].url || '';
    }
  } catch {}
});
</script>

<template>
  <div class="w-[380px] bg-[var(--background-canvas)] text-[var(--text-normal)]">
    <!-- Header (1.html style: logo + connection status) -->
    <header class="flex items-center justify-between px-4 h-11 border-b border-[var(--background-modifier-border)] bg-[var(--background-primary)] shrink-0">
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-[var(--font-monospace-default)] text-[var(--font-ui-small)] font-bold tracking-tight text-[var(--text-normal)]">AI Reader</span>
        <span class="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
          <span class="w-1.5 h-1.5 rounded-full bg-[var(--text-success)] animate-pulse"></span>
          Local
        </span>
      </div>
      <div class="flex items-center gap-0.5 shrink-0">
        <ThemeToggle />
        <button class="clickable-icon" aria-label="Open settings" @click="openOptions">
          <SettingsIcon class="w-4 h-4" />
        </button>
      </div>
    </header>

    <!-- Empty / disabled state -->
    <BaseState
      v-if="hasNoProviders"
      variant="info"
      title="未启用任何 Provider"
      description="请在设置中至少启用一个 AI 模型"
      size="sm"
      class="py-8"
    >
      <button class="btn-primary-sm" @click="openOptions">
        前往设置
        <ArrowUpRight class="w-3 h-3 ml-0.5" />
      </button>
    </BaseState>

    <template v-else>
      <!-- Current Page Capture Card (1.html style: surface card with icon) -->
      <div class="mx-3 mt-3 p-3.5 border border-[var(--background-modifier-border)]/80 rounded-xl bg-[var(--background-primary)] shadow-[var(--shadow-card)]">
        <div class="flex items-start gap-2.5">
          <div class="w-9 h-9 rounded-lg bg-[var(--background-secondary)] flex items-center justify-center shrink-0">
            <FileText class="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <div class="flex-1 min-w-0">
            <h2 class="text-[var(--font-ui-smaller)] font-bold text-[var(--text-normal)] line-clamp-2 leading-snug">
              {{ tabTitle || '当前页面' }}
            </h2>
            <p class="text-[10px] text-[var(--text-faint)] mt-0.5 truncate">
              {{ tabUrl }}
            </p>
          </div>
        </div>
      </div>

      <!-- Template select -->
      <div class="px-3 pt-3">
        <label class="block text-[var(--font-ui-smallest)] text-[var(--text-muted)] mb-1.5 font-medium">
          提示词模板
        </label>
        <select
          v-model="selectedPromptId"
          class="select-base select-chevron"
          aria-label="选择提示词模板"
        >
          <option v-for="p in DEFAULT_PROMPTS" :key="p.id" :value="p.id">
            {{ p.name }}
          </option>
        </select>
      </div>

      <!-- Active providers chips -->
      <div class="px-3 pt-2 pb-1 flex items-center gap-1.5 flex-wrap">
        <span
          v-for="pid in enabledProviders"
          :key="pid"
          class="pill-neutral !text-[10px] gap-1"
        >
          <span :class="['icon', `icon-${getProviderIcon(pid)}`]" style="font-size: 0.75rem" />
          {{ getProviderName(pid) }}
        </span>
        <span class="text-[10px] text-[var(--text-faint)] ml-auto font-mono">
          {{ enabledProviders.length }} 模型
        </span>
      </div>

      <!-- CTA (1.html style: large solid indigo button with shadow) -->
      <div class="px-3 pt-3 pb-3">
        <button
          type="button"
          class="w-full h-10 rounded-lg bg-[var(--interactive-accent)] hover:bg-[var(--interactive-accent-hover)] text-white font-semibold text-[var(--font-ui-smaller)] flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-200 dark:shadow-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          :disabled="isLoading"
          aria-label="运行选中的提示词模板"
          @click="runPrompt"
        >
          <Sparkles v-if="!isLoading" class="w-4 h-4" />
          <span v-if="isLoading" class="w-4 h-4 inline-block border-2 border-current border-t-transparent rounded-full animate-spin" />
          {{ isLoading ? '提取中…' : '总结当前页面' }}
        </button>
      </div>

      <!-- Secondary actions (1.html style: divided bottom bar) -->
      <div class="border-t border-[var(--background-modifier-border)] grid grid-cols-2 divide-x divide-[var(--background-modifier-border)] bg-[var(--background-primary)]">
        <button
          type="button"
          class="flex items-center justify-center gap-1.5 h-9 text-[11px] font-bold text-[var(--text-muted)] hover:text-[var(--text-normal)] hover:bg-[var(--background-canvas)] transition-colors"
          @click="openSidePanel"
        >
          <ExternalLink class="w-3.5 h-3.5" />
          工作站
        </button>
        <button
          type="button"
          class="flex items-center justify-center gap-1.5 h-9 text-[11px] font-bold text-[var(--text-muted)] hover:text-[var(--text-normal)] hover:bg-[var(--background-canvas)] transition-colors"
          @click="openOptions"
        >
          <SettingsIcon class="w-3.5 h-3.5" />
          设置
        </button>
      </div>
    </template>
  </div>
</template>
