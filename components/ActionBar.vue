<script lang="ts" setup>
import { ref } from 'vue';
import { useContentStore } from '@/stores/content';
import { useSettingsStore } from '@/stores/settings';
import { useComparisonStore } from '@/stores/comparison';
import { useTemplatesStore } from '@/stores/templates';
import { estimateTokens, estimateCost, formatCost } from '@/utils/cost';
import CostConfirmDialog from './CostConfirmDialog.vue';
import { Play, Square } from 'lucide-vue-next';

const content = useContentStore();
const settings = useSettingsStore();
const comparison = useComparisonStore();
const templates = useTemplatesStore();

const customPrompt = ref('');
const showCostDialog = ref(false);
const pendingCost = ref(0);
const pendingModels = ref<{ name: string; cost: number }[]>([]);
const pendingTokens = ref(0);
const pendingPrompt = ref('');

function calculateCostEstimate(prompt: string) {
  const fullPrompt = `${prompt}\n\n${content.rawContent || ''}`;
  const inputTokens = estimateTokens(fullPrompt);
  const outputTokens = 500;
  const models = settings.enabledProviders.map(id => {
    const config = settings.getProviderConfig(id);
    return { name: `${id} (${config.model})`, cost: estimateCost(config.model, inputTokens, outputTokens) };
  });
  const total = models.reduce((sum, m) => sum + m.cost, 0);
  return { total, models, tokens: inputTokens + outputTokens };
}

function startWithPrompt(prompt: string) {
  if (!content.rawContent) return;

  // Check if we should skip cost confirmation
  const skipConfirm = sessionStorage.getItem('ai-reader-skip-cost-confirm');
  if (skipConfirm === 'true') {
    doStart(prompt);
    return;
  }

  const estimate = calculateCostEstimate(prompt);
  if (estimate.total > 0.01) {
    pendingCost.value = estimate.total;
    pendingModels.value = estimate.models;
    pendingTokens.value = estimate.tokens;
    pendingPrompt.value = prompt;
    showCostDialog.value = true;
    return;
  }

  doStart(prompt);
}

function doStart(prompt: string) {
  const fullPrompt = `${prompt}\n\n${content.rawContent}`;
  comparison.initSlots(settings.enabledProviders);
  comparison.startAll(fullPrompt);
}

function handleCostConfirm() {
  showCostDialog.value = false;
  doStart(pendingPrompt.value);
}

function handleCostCancel() {
  showCostDialog.value = false;
  pendingPrompt.value = '';
  pendingCost.value = 0;
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
  <div class="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
    <!-- Prompt buttons row -->
    <div class="flex items-center gap-2 px-4 py-2.5">
      <button
        v-for="dp in templates.templates"
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
        aria-label="停止全部"
      >
        <Square class="w-3 h-3" />
        停止全部
      </button>
    </div>

    <!-- Custom prompt row -->
    <div class="flex items-center gap-2 px-4 pb-2.5">
      <input
        v-model="customPrompt"
        type="text"
        placeholder="输入自定义提示词..."
        class="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        @keyup.enter="startCustom"
        aria-label="自定义提示词输入"
      />
      <button
        @click="startCustom"
        :disabled="!content.rawContent || comparison.isRunning || !customPrompt.trim()"
        class="px-3 py-1.5 text-sm bg-gray-700 dark:bg-gray-600 text-white rounded-md hover:bg-gray-800 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="发送"
      >
        发送
      </button>
    </div>

    <!-- Cost confirmation dialog -->
    <CostConfirmDialog
      v-if="showCostDialog"
      :estimated-cost="pendingCost"
      :models="pendingModels"
      :token-estimate="pendingTokens"
      @confirm="handleCostConfirm"
      @cancel="handleCostCancel"
    />
  </div>
</template>
