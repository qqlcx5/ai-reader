<script lang="ts" setup>
import { ref } from 'vue';
import { X, AlertTriangle, Send } from 'lucide-vue-next';
import { formatCost } from '@/utils/cost';

const props = defineProps<{
  estimatedCost: number;
  models: { name: string; cost: number }[];
  tokenEstimate: number;
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const dontAskAgain = ref(false);

function handleConfirm() {
  if (dontAskAgain.value) {
    // Store in session memory (not persisted)
    sessionStorage.setItem('ai-reader-skip-cost-confirm', '1');
  }
  emit('confirm');
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    role="dialog"
    aria-modal="true"
    aria-label="费用确认"
    @click.self="emit('cancel')"
  >
    <div class="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-[90vw] max-w-md overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div class="flex items-center gap-2">
          <AlertTriangle class="w-5 h-5 text-yellow-500" />
          <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200">费用确认</h3>
        </div>
        <button
          @click="emit('cancel')"
          class="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          aria-label="关闭"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Body -->
      <div class="px-4 py-3">
        <p class="text-sm text-slate-600 dark:text-slate-400 mb-3">
          预估消耗约 <strong class="text-slate-800 dark:text-slate-200">~{{ tokenEstimate }}</strong> tokens，费用明细如下：
        </p>

        <div class="space-y-2">
          <div
            v-for="m in models"
            :key="m.name"
            class="flex items-center justify-between text-sm py-1.5 px-3 bg-slate-50 dark:bg-slate-800 rounded"
          >
            <span class="text-slate-700 dark:text-slate-300">{{ m.name }}</span>
            <span class="font-medium text-slate-800 dark:text-slate-200">{{ formatCost(m.cost) }}</span>
          </div>
        </div>

        <div class="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <span class="text-sm font-medium text-slate-600 dark:text-slate-400">总计</span>
          <span class="text-lg font-bold text-slate-800 dark:text-slate-100">{{ formatCost(estimatedCost) }}</span>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <label class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
          <input
            v-model="dontAskAgain"
            type="checkbox"
            class="rounded border-slate-300 dark:border-slate-600"
          />
          本次不再提示
        </label>
        <div class="flex items-center gap-2">
          <button
            @click="emit('cancel')"
            class="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            取消
          </button>
          <button
            @click="handleConfirm"
            class="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-brand-500 text-white rounded-md hover:bg-brand-600 transition-colors"
          >
            <Send class="w-3.5 h-3.5" />
            确认发送
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
