<script lang="ts" setup>
import { useWorkflowStore } from '@/stores/workflow';
import { useComparisonStore } from '@/stores/comparison';
import type { WorkMode } from '@/utils/llm/types';

const workflow = useWorkflowStore();
const comparison = useComparisonStore();

const modes: { value: WorkMode; label: string }[] = [
  { value: 'parallel', label: '对比' },
  { value: 'roundtable', label: '角色圆桌' },
  { value: 'chain', label: '模型链' },
];

function selectMode(mode: WorkMode) {
  if (comparison.isRunning) return;
  workflow.setMode(mode);
}
</script>

<template>
  <div class="flex bg-[var(--background-primary-alt)] p-0.5 rounded-lg">
    <button
      v-for="m in modes"
      :key="m.value"
      type="button"
      :disabled="comparison.isRunning"
      :class="[
        'px-2.5 py-1 rounded-md text-[11px] font-bold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
        workflow.workMode === m.value
          ? 'bg-[var(--background-primary)] text-[var(--text-normal)] shadow-xs'
          : 'text-[var(--text-muted)] hover:text-[var(--text-normal)]',
      ]"
      @click="selectMode(m.value)"
    >
      {{ m.label }}
    </button>
  </div>
</template>
