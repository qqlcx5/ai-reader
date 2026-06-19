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
import { FileText, Sparkles, Settings as SettingsIcon, ArrowUpRight, ExternalLink } from 'lucide-vue-next';
import { browser } from 'wxt/browser';
import ThemeToggle from '@/components/ThemeToggle.vue';
import BaseState from '@/components/base/BaseState.vue';

const content = useContentStore();
const settings = useSettingsStore();
const comparison = useComparisonStore();

const selectedPromptId = ref(DEFAULT_PROMPTS[0].id);
const isLoading = ref(false);

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

onMounted(() => {
  content.clear();
});
</script>

<template>
  <div class="w-[380px] bg-[var(--background-primary)] text-[var(--text-normal)]">
    <!-- Header -->
    <header class="flex items-center justify-between px-3 h-10 border-b border-[var(--background-modifier-border)] shrink-0">
      <div class="flex items-center gap-2 min-w-0">
        <div class="w-6 h-6 rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] bg-[var(--color-accent-soft)] flex items-center justify-center">
          <FileText class="w-3.5 h-3.5 text-[var(--text-accent)]" />
        </div>
        <h1 class="text-[var(--font-ui-medium)] font-semibold truncate">AI Reader</h1>
      </div>
      <div class="flex items-center gap-0.5">
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
      <BaseState>
        <button class="btn-primary-sm" @click="openOptions">
          前往设置
          <ArrowUpRight class="w-3 h-3 ml-0.5" />
        </button>
      </BaseState>
    </BaseState>

    <template v-else>
      <!-- Model chips row -->
      <div class="px-3 pt-3 pb-2 flex items-center gap-1.5 flex-wrap">
        <span
          v-for="pid in enabledProviders"
          :key="pid"
          class="pill-neutral gap-1.5"
        >
          <span :class="['icon', `icon-${getProviderIcon(pid)}`]" style="font-size: 0.75rem" />
          {{ getProviderName(pid) }}
        </span>
        <span class="text-[var(--font-ui-smallest)] text-[var(--text-faint)] ml-auto">
          {{ enabledProviders.length }} model{{ enabledProviders.length > 1 ? 's' : '' }}
        </span>
      </div>

      <!-- Template select -->
      <div class="px-3 pb-3">
        <label class="block text-[var(--font-ui-smallest)] text-[var(--text-muted)] mb-1 font-medium">
          Action
        </label>
        <div class="relative">
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
        <p class="text-[var(--font-ui-smallest)] text-[var(--text-faint)] mt-1.5 line-clamp-2 leading-snug">
          {{ selectedPrompt.prompt }}
        </p>
      </div>

      <!-- CTA -->
      <div class="px-3 pb-3">
        <button
          type="button"
          class="btn-primary block w-full"
          :disabled="isLoading"
          aria-label="运行选中的提示词模板"
          @click="runPrompt"
        >
          <Sparkles v-if="!isLoading" class="w-3.5 h-3.5" />
          <span v-if="isLoading" class="w-3.5 h-3.5 inline-block border-2 border-current border-t-transparent rounded-full animate-spin" />
          {{ isLoading ? '提取中…' : 'Run & Open Side Panel' }}
        </button>
      </div>

      <!-- Secondary actions -->
      <div class="border-t border-[var(--background-modifier-border)] grid grid-cols-2 divide-x divide-[var(--background-modifier-border)]">
        <button
          type="button"
          class="flex items-center justify-center gap-1.5 h-9 text-[var(--font-ui-smaller)] text-[var(--text-normal)] hover:bg-[var(--background-modifier-hover)] transition-colors"
          @click="openSidePanel"
        >
          <ExternalLink class="w-3.5 h-3.5 text-[var(--text-muted)]" />
          Open Side Panel
        </button>
        <button
          type="button"
          class="flex items-center justify-center gap-1.5 h-9 text-[var(--font-ui-smaller)] text-[var(--text-normal)] hover:bg-[var(--background-modifier-hover)] transition-colors"
          @click="openOptions"
        >
          <SettingsIcon class="w-3.5 h-3.5 text-[var(--text-muted)]" />
          Settings
        </button>
      </div>
    </template>
  </div>
</template>
