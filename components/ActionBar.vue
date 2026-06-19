<script lang="ts" setup>
import { ref } from 'vue';
import { useContentStore } from '@/stores/content';
import { useSettingsStore } from '@/stores/settings';
import { useComparisonStore } from '@/stores/comparison';
import { PROVIDERS } from '@/utils/llm';
import { Play, Square } from 'lucide-vue-next';

const content = useContentStore();
const settings = useSettingsStore();
const comparison = useComparisonStore();

const customPrompt = ref('');

const defaultPrompts = [
  { label: 'Summarize', prompt: 'Please summarize the following article in Chinese, highlighting the key points:' },
  { label: 'Explain', prompt: 'Explain the following article in simple terms:' },
  { label: 'Key Takeaways', prompt: 'List the key takeaways from this article:' },
];

function startWithPrompt(prompt: string) {
  if (!content.rawContent) return;

  const fullPrompt = `${prompt}\n\n${content.rawContent}`;
  comparison.initSlots(settings.enabledProviders);
  comparison.startAll(fullPrompt);
}

function startCustom() {
  if (!customPrompt.value.trim()) return;
  startWithPrompt(customPrompt.value.trim());
}

function abortAll() {
  comparison.abortAll();
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 p-3 bg-white border-b border-gray-200">
    <button
      v-for="dp in defaultPrompts"
      :key="dp.label"
      @click="startWithPrompt(dp.prompt)"
      :disabled="!content.rawContent || comparison.isRunning"
      class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <Play class="w-3 h-3 inline-block mr-1" />
      {{ dp.label }}
    </button>

    <div class="flex items-center gap-1 flex-1 min-w-[200px]">
      <input
        v-model="customPrompt"
        type="text"
        placeholder="Custom prompt..."
        class="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
        @keyup.enter="startCustom"
      />
      <button
        @click="startCustom"
        :disabled="!content.rawContent || comparison.isRunning || !customPrompt.trim()"
        class="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Send
      </button>
    </div>

    <button
      v-if="comparison.isRunning"
      @click="abortAll"
      class="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
    >
      <Square class="w-3 h-3 inline-block mr-1" />
      Stop All
    </button>
  </div>
</template>
