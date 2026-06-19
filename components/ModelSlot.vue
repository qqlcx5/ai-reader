<script lang="ts" setup>
import { computed, ref } from 'vue';
import { Loader2, StopCircle, CheckCircle2, AlertCircle, Copy, RotateCcw, Clock, Coins } from 'lucide-vue-next';
import type { StreamSlot } from '@/stores/comparison';
import { useConversationsStore } from '@/stores/conversations';
import { renderMarkdown } from '@/utils/markdown';
import { formatStreamError } from '@/utils/errors';
import { formatCost } from '@/utils/cost';
import ChatInput from './ChatInput.vue';

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

const errorMessage = computed(() => formatStreamError(props.slot.error));

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
    case 'error': return 'text-red-500 dark:text-red-400';
    default: return 'text-gray-400 dark:text-gray-500';
  }
});

const statusLabel = computed(() => {
  switch (props.slot.status) {
    case 'streaming': return '生成中...';
    case 'done': return '完成';
    case 'error': return '错误';
    case 'idle': return '等待中...';
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
  <div class="flex flex-col border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 overflow-hidden h-full min-h-0">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold text-gray-800 dark:text-gray-200">{{ slot.providerId }}</span>
        <span class="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{{ slot.modelId }}</span>
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
          class="p-1 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
          aria-label="停止生成"
        >
          <StopCircle class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Chat history -->
    <div v-if="history.length > 0" class="px-3 pt-2 space-y-1.5 border-b border-gray-100 dark:border-gray-800">
      <div v-for="(msg, i) in history" :key="i" class="text-xs">
        <span class="font-medium" :class="msg.role === 'user' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'">
          {{ msg.role === 'user' ? 'You' : 'AI' }}:
        </span>
        <span class="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{{ msg.content }}</span>
      </div>
    </div>

    <!-- Content area -->
    <div class="flex-1 p-3 overflow-y-auto" aria-live="polite">
      <div v-if="slot.status === 'idle'" class="text-gray-400 dark:text-gray-500 text-sm">
        等待中...
      </div>
      <div v-else-if="slot.status === 'error'" class="text-red-500 dark:text-red-400 text-sm" role="alert">
        {{ errorMessage }}
      </div>
      <div
        v-else-if="slot.status === 'streaming'"
        class="prose dark:prose-invert prose-sm max-w-none whitespace-pre-wrap text-sm"
      >
        {{ slot.text || '思考中...' }}
      </div>
      <div
        v-else
        class="prose dark:prose-invert prose-sm max-w-none text-sm"
        v-html="renderedText"
      />
    </div>

    <!-- Stats bar -->
    <div
      v-if="slot.startTime > 0"
      class="flex items-center gap-3 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400"
    >
      <span class="flex items-center gap-1">
        <Clock class="w-3 h-3" />
        {{ elapsed }}
      </span>
      <span class="flex items-center gap-1">
        <Coins class="w-3 h-3" />
        ~{{ slot.inputTokens }} in / ~{{ slot.outputTokens }} out
      </span>
      <span v-if="slot.estimatedCost > 0" class="flex items-center gap-1">
        {{ formatCost(slot.estimatedCost) }}
      </span>
    </div>

    <!-- Action bar -->
    <div class="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div class="flex items-center gap-1">
        <button
          @click="copyToClipboard"
          :disabled="!slot.text"
          class="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          :aria-label="copied ? '已复制' : '复制'"
        >
          <Copy class="w-3 h-3" />
          {{ copied ? '已复制' : '复制' }}
        </button>
        <button
          v-if="slot.status === 'error' && slot.lastPrompt"
          @click="emit('retry', index)"
          class="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
          aria-label="重试"
        >
          <RotateCcw class="w-3 h-3" />
          重试
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
