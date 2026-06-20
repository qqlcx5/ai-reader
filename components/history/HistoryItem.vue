<script lang="ts" setup>
import { computed } from 'vue';
import type { ConversationRecord } from '@/modules/storage/types';

const props = defineProps<{
  conversation: ConversationRecord;
}>();

const emit = defineEmits<{
  (e: 'click', id: string): void;
}>();

const modeIcon = computed(() => {
  switch (props.conversation.mode) {
    case 'roundtable':
      return '🔁';
    case 'relay':
      return '⏩';
    case 'chat':
    default:
      return '💬';
  }
});

const updatedAtText = computed(() => {
  const date = new Date(props.conversation.updatedAt);
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
});

function onClick() {
  emit('click', props.conversation.id);
}
</script>

<template>
  <div class="history-item" @click="onClick">
    <div class="mode-icon">{{ modeIcon }}</div>
    <div class="content">
      <div class="title-row">
        <span class="title">{{ conversation.title }}</span>
        <span class="updated-at">{{ updatedAtText }}</span>
      </div>
      <div class="preview" :title="conversation.preview">
        {{ conversation.preview || '无预览' }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
  transition: background-color 150ms ease;
}
.history-item:hover {
  background-color: var(--hover-bg, rgba(0, 0, 0, 0.04));
}
.mode-icon {
  flex-shrink: 0;
  font-size: 18px;
}
.content {
  flex: 1;
  min-width: 0;
}
.title-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}
.title {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.updated-at {
  font-size: 11px;
  color: var(--muted-color, #888);
  flex-shrink: 0;
}
.preview {
  font-size: 12px;
  color: var(--muted-color, #666);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
