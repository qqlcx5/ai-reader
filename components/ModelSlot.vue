<script lang="ts" setup>
import { computed, ref } from 'vue';
import { Loader2, StopCircle, CheckCircle2, AlertCircle, Copy, RotateCcw, Clock, Coins } from 'lucide-vue-next';
import type { StreamSlot } from '@/stores/comparison';
import { useConversationsStore } from '@/stores/conversations';
import { renderMarkdown } from '@/utils/markdown';
import { formatStreamError } from '@/utils/errors';
import { formatCost } from '@/utils/cost';
import { getProviderIcon, getProviderName } from '@/utils/providers';
import ChatInput from './ChatInput.vue';
import BaseIconButton from './base/BaseIconButton.vue';

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

const statusLabel = computed(() => {
  switch (props.slot.status) {
    case 'streaming': return '生成中';
    case 'done': return '完成';
    case 'error': return '错误';
    case 'idle': return '等待中';
    default: return '';
  }
});

const statusPillClass = computed(() => {
  switch (props.slot.status) {
    case 'streaming': return 'pill-accent';
    case 'done': return 'pill-success';
    case 'error': return 'pill-danger';
    default: return 'pill-neutral';
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
  }).catch(() => {});
}
</script>

<template>
  <div class="flex flex-col bg-[var(--background-primary)] border border-[var(--background-modifier-border)] rounded-[var(--radius-m)] [corner-shape:var(--corner-shape)] overflow-hidden h-full min-h-0">
    <!-- Header -->
    <div class="flex items-center gap-2 px-3 py-2 border-b border-[var(--background-modifier-border)] shrink-0">
      <span
        :class="['icon', `icon-${getProviderIcon(slot.providerId)}`]"
        style="font-size: 0.875rem; color: var(--text-muted);"
      />
      <span class="text-[var(--font-ui-smaller)] font-semibold text-[var(--text-normal)] truncate">
        {{ getProviderName(slot.providerId) }}
      </span>
      <span class="text-[10px] text-[var(--text-faint)] truncate" :title="slot.modelId">
        {{ slot.modelId }}
      </span>
      <span :class="statusPillClass" class="ml-auto shrink-0 !text-[10px]">
        <template v-if="slot.status === 'streaming'">
          <Loader2 class="w-2.5 h-2.5 animate-spin" />
        </template>
        <template v-else-if="slot.status === 'done'">
          <CheckCircle2 class="w-2.5 h-2.5" />
        </template>
        <template v-else-if="slot.status === 'error'">
          <AlertCircle class="w-2.5 h-2.5" />
        </template>
        {{ statusLabel }}
      </span>
      <BaseIconButton
        v-if="slot.status === 'streaming'"
        size="sm"
        variant="danger"
        aria-label="停止生成"
        @click="emit('abort', index)"
      >
        <StopCircle class="w-3.5 h-3.5" />
      </BaseIconButton>
    </div>

    <!-- Chat history -->
    <div
      v-if="history.length > 0"
      class="px-3 py-2 space-y-1.5 border-b border-[var(--background-modifier-border-subtle)] bg-[var(--background-secondary)] max-h-32 overflow-y-auto scrollbar-thin shrink-0"
    >
      <div v-for="(msg, i) in history" :key="i" class="text-[var(--font-ui-smallest)]">
        <span :class="msg.role === 'user' ? 'text-[var(--text-accent)] font-semibold' : 'text-[var(--text-success)] font-semibold'">
          {{ msg.role === 'user' ? 'You' : 'AI' }}:
        </span>
        <span class="text-[var(--text-normal)] whitespace-pre-wrap">{{ msg.content }}</span>
      </div>
    </div>

    <!-- Content area -->
    <div class="flex-1 p-3 overflow-y-auto scrollbar-thin min-h-0" aria-live="polite">
      <div v-if="slot.status === 'idle'" class="text-[var(--text-faint)] text-[var(--font-ui-smaller)] text-center py-6">
        等待中…
      </div>
      <div
        v-else-if="slot.status === 'error'"
        class="text-[var(--text-error)] text-[var(--font-ui-smaller)] p-3 bg-[var(--background-modifier-error)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] border border-[var(--text-error)] border-opacity-20"
        role="alert"
      >
        <div class="flex items-center gap-1.5 font-semibold mb-1">
          <AlertCircle class="w-3.5 h-3.5" />
          请求失败
        </div>
        <div class="text-[var(--font-ui-smallest)]">{{ errorMessage }}</div>
      </div>
      <div
        v-else-if="slot.status === 'streaming'"
        class="prose dark:prose-invert prose-sm max-w-none text-[var(--font-ui-smaller)] text-[var(--text-normal)]"
      >
        <template v-if="slot.text">
          <article v-html="renderMarkdown(slot.text)" />
        </template>
        <template v-else>
          <span class="text-[var(--text-faint)]">思考中…</span>
        </template>
        <span class="inline-block w-1.5 h-3 ml-0.5 bg-[var(--text-accent)] animate-pulse" />
      </div>
      <article
        v-else
        class="prose dark:prose-invert max-w-none text-[var(--font-ui-smaller)] leading-relaxed"
        v-html="renderedText"
      />
    </div>

    <!-- Stats bar -->
    <div
      v-if="slot.startTime > 0"
      class="flex items-center gap-3 px-3 py-1.5 border-t border-[var(--background-modifier-border-subtle)] bg-[var(--background-primary)] text-[10px] text-[var(--text-muted)] shrink-0"
    >
      <span class="flex items-center gap-1">
        <Clock class="w-3 h-3" />
        {{ elapsed }}
      </span>
      <span class="flex items-center gap-1">
        <Coins class="w-3 h-3" />
        ~{{ slot.inputTokens }} in / ~{{ slot.outputTokens }} out
      </span>
      <span v-if="slot.estimatedCost > 0" class="pill-success !text-[9px] !py-0">
        {{ formatCost(slot.estimatedCost) }}
      </span>
      <div class="ml-auto flex items-center gap-1">
        <button
          @click="copyToClipboard"
          :disabled="!slot.text"
          class="text-[var(--text-muted)] hover:text-[var(--text-normal)] hover:bg-[var(--background-modifier-hover)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] px-1.5 py-0.5 text-[10px] inline-flex items-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:bg-[var(--background-modifier-hover)]"
          :aria-label="copied ? '已复制' : '复制'"
        >
          <Copy class="w-3 h-3" />
          {{ copied ? '已复制' : '复制' }}
        </button>
        <BaseIconButton
          v-if="slot.status === 'error' && slot.lastPrompt"
          size="sm"
          variant="primary"
          aria-label="重试"
          @click="emit('retry', index)"
        >
          <RotateCcw class="w-3.5 h-3.5" />
        </BaseIconButton>
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
