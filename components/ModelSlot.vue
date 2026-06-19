<script lang="ts" setup>
import { computed } from 'vue';
import { Loader2, StopCircle, CheckCircle2, AlertCircle, Copy, RotateCcw, Clock, Hash } from 'lucide-vue-next';
import type { StreamSlot } from '@/stores/comparison';
import { useConversationsStore } from '@/stores/conversations';
import { renderMarkdown } from '@/utils/markdown';
import ChatInput from './ChatInput.vue';
import { ref } from 'vue';

const props = defineProps<{
  slot: StreamSlot;
  index: number;
}>();

const emit = defineEmits<{
  abort: [index: number];
  followUp: [index: number, message: string];
  retry: [index: number];
}>();

const conversations = useConversationsStore();
const copied = ref(false);

const history = computed(() => conversations.getHistory(props.slot.providerId));
const renderedText = computed(() => {
  if (!props.slot.text) return '';
  if (props.slot.status === 'streaming') return props.slot.text;
  return renderMarkdown(props.slot.text);
});

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

const statusLabel = computed(() => {
  switch (props.slot.status) {
    case 'streaming': return 'Streaming...';
    case 'done': return 'Done';
    case 'error': return 'Error';
    case 'idle': return 'Waiting...';
    default: return '';
  }
});

const elapsed = computed(() => {
  if (!props.slot.startTime) return '';
  const end = props.slot.endTime || Date.now();
  const ms = end - props.slot.startTime;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
});

function handleFollowUp(message: string) {
  emit('followUp', props.index, message);
}

function copyToClipboard() {
  if (!props.slot.text) return;
  navigator.clipboard.writeText(props.slot.text).then(() => {
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 1500);
  }).catch(() => {
    // Clipboard API not available
  });
}
</script>

<template>
  <div class="flex flex-col border border-gray-200 rounded-lg bg-white overflow-hidden h-full min-h-0">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold text-gray-800">{{ slot.providerId }}</span>
        <span class="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{{ slot.modelId }}</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="text-xs" :class="statusColor">{{ statusLabel }}</span>
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
    <div v-if="history.length > 0" class="px-3 pt-2 space-y-1.5 border-b border-gray-100">
      <div v-for="(msg, i) in history" :key="i" class="text-xs">
        <span class="font-medium" :class="msg.role === 'user' ? 'text-blue-600' : 'text-green-600'">
          {{ msg.role === 'user' ? 'You' : 'AI' }}:
        </span>
        <span class="text-gray-700 whitespace-pre-wrap">{{ msg.content }}</span>
      </div>
    </div>

    <!-- Content area -->
    <div class="flex-1 p-3 overflow-y-auto" aria-live="polite">
      <div v-if="slot.status === 'idle'" class="text-gray-400 text-sm">
        Waiting...
      </div>
      <div v-else-if="slot.status === 'error'" class="text-red-500 text-sm">
        {{ slot.error }}
      </div>
      <div
        v-else-if="slot.status === 'streaming'"
        class="prose prose-sm max-w-none whitespace-pre-wrap text-sm"
      >
        {{ slot.text || 'Thinking...' }}
      </div>
      <div
        v-else
        class="prose prose-sm max-w-none text-sm"
        v-html="renderedText"
      />
    </div>

    <!-- Stats bar -->
    <div
      v-if="slot.startTime > 0"
      class="flex items-center gap-3 px-3 py-1.5 bg-gray-50 border-t border-gray-100 text-xs text-gray-500"
    >
      <span class="flex items-center gap-1">
        <Clock class="w-3 h-3" />
        {{ elapsed }}
      </span>
      <span class="flex items-center gap-1">
        <Hash class="w-3 h-3" />
        ~{{ slot.tokenCount }} chunks
      </span>
    </div>

    <!-- Action bar -->
    <div class="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-200">
      <div class="flex items-center gap-1">
        <button
          @click="copyToClipboard"
          :disabled="!slot.text"
          class="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          :title="copied ? 'Copied!' : 'Copy'"
        >
          <Copy class="w-3 h-3" />
          {{ copied ? 'Copied!' : 'Copy' }}
        </button>
        <button
          v-if="slot.status === 'error' && slot.lastPrompt"
          @click="emit('retry', index)"
          class="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
        >
          <RotateCcw class="w-3 h-3" />
          Retry
        </button>
      </div>
    </div>

    <!-- Chat input -->
    <ChatInput
      v-if="slot.text || slot.status === 'done'"
      :disabled="slot.status === 'streaming'"
      @send="handleFollowUp"
    />
  </div>
</template>
