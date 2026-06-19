<script lang="ts" setup>
import { computed } from 'vue';
import ModelSlot from './ModelSlot.vue';
import { useComparisonStore } from '@/stores/comparison';
import { useConversationsStore } from '@/stores/conversations';
import { useContentStore } from '@/stores/content';

const comparison = useComparisonStore();
const conversations = useConversationsStore();
const content = useContentStore();

const gridClass = computed(() => {
  const n = comparison.slots.length;
  if (n <= 1) return 'grid-cols-1';
  if (n === 2) return 'grid-cols-2';
  if (n <= 4) return 'grid-cols-2';
  // 5+: handled by flex layout with horizontal scroll
  return '';
});

const isScrollable = computed(() => comparison.slots.length > 4);

function handleFollowUp(index: number, message: string) {
  const slot = comparison.slots[index];
  if (!slot || slot.status === 'streaming') return;

  conversations.addMessage(slot.providerId, { role: 'user', content: message });
  const prompt = conversations.buildPromptWithContext(slot.providerId, content.rawContent, message);
  comparison.followUpSlot(index, prompt);
}

function handleRetry(index: number) {
  comparison.retrySlot(index);
}
</script>

<template>
  <div
    v-if="comparison.slots.length > 0"
    :class="[
      isScrollable
        ? 'flex gap-3 p-3 overflow-x-auto'
        : 'grid gap-3 p-3 h-full',
      gridClass
    ]"
    :style="isScrollable ? { minWidth: 0, width: '100%' } : {}"
  >
    <ModelSlot
      v-for="(slot, i) in comparison.slots"
      :key="i"
      :slot="slot"
      :index="i"
      :class="isScrollable ? 'min-w-[320px] flex-shrink-0' : ''"
      @abort="(idx) => comparison.abortSlot(idx)"
      @followUp="handleFollowUp"
      @retry="handleRetry"
    />
  </div>
</template>
