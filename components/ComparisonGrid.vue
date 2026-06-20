<script lang="ts" setup>
import { computed } from 'vue';
import ModelSlot from './ModelSlot.vue';
import SkeletonCard from './SkeletonCard.vue';
import { useComparisonStore } from '@/stores/comparison';
import { useConversationsStore } from '@/stores/conversations';
import { useContentStore } from '@/stores/content';
import { useWorkflowStore } from '@/stores/workflow';

const comparison = useComparisonStore();
const conversations = useConversationsStore();
const content = useContentStore();
const workflow = useWorkflowStore();

const gridClass = computed(() => {
  const n = comparison.slots.length;
  if (n <= 1) return 'grid-cols-1';
  if (n === 2) return 'grid-cols-2';
  if (n <= 4) return 'grid-cols-2';
  return '';
});

const isScrollable = computed(() => comparison.slots.length > 4);
const isChainMode = computed(() => workflow.workMode === 'chain');

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
  <!-- Chain mode: vertical with flow wire (1.html style) -->
  <div
    v-if="comparison.slots.length > 0 && isChainMode"
    class="flex flex-col gap-1 p-4 h-full overflow-y-auto scrollbar-thin"
  >
    <template v-for="(slot, i) in comparison.slots" :key="i">
      <div class="min-h-[200px] flex-1">
        <SkeletonCard
          v-if="slot.status === 'idle' && !slot.text"
          class="h-full"
        />
        <ModelSlot
          v-else
          :slot="slot"
          :index="i"
          @abort="(idx) => comparison.abortSlot(idx)"
          @followUp="handleFollowUp"
          @retry="handleRetry"
        />
      </div>
      <!-- Flow wire between chain steps (1.html animated conduit) -->
      <div v-if="i < comparison.slots.length - 1" class="flex justify-center py-1">
        <div class="flow-wire h-8"></div>
      </div>
    </template>
  </div>

  <!-- Normal / Roundtable mode: grid layout (1.html card grid with rounded-2xl cards) -->
  <div
    v-else-if="comparison.slots.length > 0"
    :class="[
      isScrollable
        ? 'flex gap-4 p-4 overflow-x-auto scrollbar-thin h-full'
        : 'grid gap-4 p-4 h-full',
      gridClass,
    ]"
  >
    <template v-for="(slot, i) in comparison.slots" :key="i">
      <SkeletonCard
        v-if="slot.status === 'idle' && !slot.text"
        :class="isScrollable ? 'min-w-[320px] flex-shrink-0 h-full' : ''"
      />
      <ModelSlot
        v-else
        :slot="slot"
        :index="i"
        :class="isScrollable ? 'min-w-[320px] flex-shrink-0 h-full' : ''"
        @abort="(idx) => comparison.abortSlot(idx)"
        @followUp="handleFollowUp"
        @retry="handleRetry"
      />
    </template>
  </div>
</template>
