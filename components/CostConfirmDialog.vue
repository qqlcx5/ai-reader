<script lang="ts" setup>
import { ref } from 'vue';
import { AlertTriangle, Send } from 'lucide-vue-next';
import { formatCost } from '@/utils/cost';
import BaseDialog from './base/BaseDialog.vue';
import BaseButton from './base/BaseButton.vue';

const props = defineProps<{
  estimatedCost: number;
  models: { name: string; cost: number }[];
  tokenEstimate: number;
  open?: boolean;
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const dontAskAgain = ref(false);

function handleConfirm() {
  if (dontAskAgain.value) {
    sessionStorage.setItem('ai-reader-skip-cost-confirm', '1');
  }
  emit('confirm');
}

function handleCancel() {
  emit('cancel');
}
</script>

<template>
  <BaseDialog
    :open="true"
    size="md"
    :close-on-esc="true"
    :close-on-backdrop="true"
    title="费用确认"
    aria-label="费用确认"
    @close="handleCancel"
  >
    <template #header>
      <div class="flex items-center gap-2">
        <AlertTriangle class="w-5 h-5 text-[var(--text-warning)]" />
        <span>费用确认</span>
      </div>
    </template>

    <p class="text-sm text-[var(--text-muted)] mb-3">
      预估消耗约 <strong class="text-[var(--text-normal)]">~{{ tokenEstimate }}</strong> tokens，费用明细如下：
    </p>
    <div class="space-y-2">
      <div
        v-for="m in models"
        :key="m.name"
        class="flex items-center justify-between text-sm py-1.5 px-3 bg-[var(--background-secondary)] rounded"
      >
        <span class="text-[var(--text-muted)]">{{ m.name }}</span>
        <span class="font-medium text-[var(--text-normal)]">{{ formatCost(m.cost) }}</span>
      </div>
    </div>
    <div class="mt-3 pt-3 border-t border-border flex items-center justify-between">
      <span class="text-sm font-medium text-[var(--text-muted)]">总计</span>
      <span class="text-lg font-bold text-[var(--text-normal)]">{{ formatCost(estimatedCost) }}</span>
    </div>

    <template #footer>
      <label class="flex items-center gap-2 text-xs text-[var(--text-faint)] cursor-pointer mr-auto">
        <input v-model="dontAskAgain" type="checkbox" class="checkbox-base" />
        本次不再提示
      </label>
      <BaseButton variant="ghost" size="sm" @click="handleCancel">取消</BaseButton>
      <BaseButton variant="primary" size="sm" @click="handleConfirm">
        <template #icon-left>
          <Send class="w-3 h-3" />
        </template>
        确认发送
      </BaseButton>
    </template>
  </BaseDialog>
</template>
