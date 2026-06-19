<script lang="ts" setup>
import { computed } from 'vue';
import { Loader2, StopCircle, CheckCircle2, AlertCircle } from 'lucide-vue-next';
import type { StreamSlot } from '@/stores/comparison';
import { useConversationsStore } from '@/stores/conversations';
import ChatInput from './ChatInput.vue';

const props = defineProps<{
  slot: StreamSlot;
  index: number;
}>();

const emit = defineEmits<{
  abort: [index: number];
  followUp: [index: number, message: string];
}>();

const conversations = useConversationsStore();

const history = computed(() => conversations.getHistory(props.slot.providerId));

const statusIcon = computed(() => {
  switch (props.slot.status) {
    case 'streaming': return Loader2;
    case 'done': return CheckCircle2;
    case 'error': return AlertCircle;
    default: return null;
  }
});

const statusColor = computed(() => {
  switch (props.slot.status) {
    case 'streaming': return 'text-blue-500';
    case 'done': return 'text-green-500';
    case 'error': return 'text-red-500';
    default: return 'text-gray-400';
  }
});

function handleFollowUp(message: string) {
  emit('followUp', props.index, message);
}
</script>

<template>
  <div class="flex flex-col border border-gray-200 rounded-lg bg-white overflow-hidden min-w-[320px]">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium">{{ slot.providerId }}</span>
        <span class="text-xs text-gray-400">{{ slot.modelId }}</span>
      </div>
      <div class="flex items-center gap-1">
        <component
          v-if="statusIcon"
          :is="statusIcon"
          class="w-4 h-4"
          :class="[statusColor, slot.status === 'streaming' && 'animate-spin']"
        />
        <button
          v-if="slot.status === 'streaming'"
          @click="emit('abort', index)"
          class="p-1 text-red-500 hover:text-red-700 transition-colors"
          title="Stop"
        >
          <StopCircle class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Chat history -->
    <div v-if="history.length > 0" class="px-3 pt-2 space-y-2">
      <div v-for="(msg, i) in history" :key="i" class="text-sm">
        <span class="font-medium" :class="msg.role === 'user' ? 'text-blue-600' : 'text-green-600'">
          {{ msg.role === 'user' ? 'You' : 'AI' }}:
        </span>
        <span class="whitespace-pre-wrap">{{ msg.content }}</span>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 p-3 overflow-y-auto max-h-[400px]">
      <div v-if="slot.status === 'idle'" class="text-gray-400 text-sm">
        Waiting...
      </div>
      <div v-else-if="slot.status === 'error'" class="text-red-500 text-sm">
        {{ slot.error }}
      </div>
      <div v-else class="prose prose-sm max-w-none whitespace-pre-wrap text-sm">
        {{ slot.text || 'Thinking...' }}
      </div>
    </div>

    <!-- Chat input -->
    <ChatInput
      :disabled="slot.status === 'streaming'"
      @send="handleFollowUp"
    />
  </div>
</template>
