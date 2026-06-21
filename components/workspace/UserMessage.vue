<script lang="ts" setup>
/**
 * M4 — UserMessage
 * 用户提问气泡：白底、边框、rounded-2xl rounded-tr-sm、max-width 78%、text-xs
 */
import { computed } from 'vue';

const props = defineProps<{
  content: string;
  /** 可选时间戳 */
  timestamp?: number;
}>();

const displayTime = computed(() => {
  if (!props.timestamp) return '';
  const d = new Date(props.timestamp);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
});
</script>

<template>
  <div class="user-message">
    <div class="user-message__bubble surface">
      <p class="user-message__text">{{ content }}</p>
    </div>
    <div v-if="displayTime" class="user-message__time muted">{{ displayTime }}</div>
  </div>
</template>

<style scoped>
.user-message {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  margin: 12px 0;
}

.user-message__bubble {
  max-width: 78%;
  padding: 10px 14px;
  border-radius: var(--radius-xl);
  border-top-right-radius: 4px;
  background: var(--panel);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
}

.user-message__text {
  margin: 0;
  font-size: var(--fs-xs);
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text);
}

.user-message__time {
  font-size: var(--fs-10);
  font-family: var(--font-mono);
}
</style>
