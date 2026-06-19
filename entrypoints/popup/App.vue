<script lang="ts" setup>
import { ref } from 'vue';
import { useContentStore } from '@/stores/content';
import { useSettingsStore } from '@/stores/settings';
import { useComparisonStore } from '@/stores/comparison';
import { DEFAULT_PROMPTS } from '@/utils/prompts';
import { Loader2, FileText, Settings } from 'lucide-vue-next';
import { browser } from 'wxt/browser';

const content = useContentStore();
const settings = useSettingsStore();
const comparison = useComparisonStore();
const loadingPromptId = ref<string | null>(null);

async function openSidePanel() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]?.id) {
    browser.sidePanel.open({ tabId: tabs[0].id });
  }
}

async function quickSummarize(promptId: string) {
  loadingPromptId.value = promptId;
  try {
    await content.fetchContent();
    if (!content.rawContent) return;

    const prompt = DEFAULT_PROMPTS.find(p => p.id === promptId);
    if (!prompt) return;

    const fullPrompt = `${prompt.prompt}\n\n${content.rawContent}`;
    comparison.initSlots(settings.enabledProviders);
    comparison.startAll(fullPrompt);

    // Open side panel to show results
    await openSidePanel();
  } finally {
    loadingPromptId.value = null;
  }
}
</script>

<template>
  <div class="w-[350px] bg-white">
    <header class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
      <div class="flex items-center gap-2">
        <FileText class="w-5 h-5 text-blue-600" />
        <h1 class="text-base font-semibold">AI Reader</h1>
      </div>
      <button
        @click="browser.runtime.openOptionsPage()"
        class="p-1.5 text-gray-500 hover:text-gray-700 transition-colors"
        title="Settings"
      >
        <Settings class="w-4 h-4" />
      </button>
    </header>

    <div class="p-4 space-y-3">
      <button
        @click="openSidePanel()"
        class="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        Open Side Panel
      </button>

      <div class="text-sm text-gray-500 font-medium">Quick Actions</div>

      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="prompt in DEFAULT_PROMPTS"
          :key="prompt.id"
          @click="quickSummarize(prompt.id)"
          :disabled="loadingPromptId !== null"
          class="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Loader2 v-if="loadingPromptId === prompt.id" class="w-4 h-4 animate-spin inline-block" />
          <span v-else>{{ prompt.name }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
