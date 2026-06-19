<script lang="ts" setup>
import { ref } from 'vue';
import { useContentStore } from '@/stores/content';
import { useSettingsStore } from '@/stores/settings';
import { useComparisonStore } from '@/stores/comparison';
import { DEFAULT_PROMPTS } from '@/utils/prompts';
import { Play, Square } from 'lucide-vue-next';

const content = useContentStore();
const settings = useSettingsStore();
const comparison = useComparisonStore();

const customPrompt = ref('');

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
  <div class="border-b border-gray-200 bg-white">
    <!-- Prompt buttons row -->
    <div class="flex items-center gap-2 px-4 py-2.5">
      <button
        v-for="dp in DEFAULT_PROMPTS"
        :key="dp.id"
        @click="startWithPrompt(dp.prompt)"
        :disabled="!content.rawContent || comparison.isRunning"
        class="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Play class="w-3 h-3" />
        {{ dp.name }}
      </button>

      <button
        v-if="comparison.isRunning"
        @click="abortAll"
        class="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
      >
        <Square class="w-3 h-3" />
        Stop All
      </button>
    </div>

    <!-- Custom prompt row -->
    <div class="flex items-center gap-2 px-4 pb-2.5">
      <input
        v-model="customPrompt"
        type="text"
        placeholder="Enter a custom prompt..."
        class="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        @keyup.enter="startCustom"
      />
      <button
        @click="startCustom"
        :disabled="!content.rawContent || comparison.isRunning || !customPrompt.trim()"
        class="px-3 py-1.5 text-sm bg-gray-700 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Send
      </button>
    </div>
  </div>
</template>
