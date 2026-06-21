<script lang="ts" setup>
import IconButton from '@/components/shared/IconButton.vue';

interface Props {
  busy?: boolean;
}

withDefaults(defineProps<Props>(), { busy: false });

const emit = defineEmits<{
  (e: 'open-side-panel'): void;
  (e: 'extract'): void;
  (e: 'open-settings'): void;
}>();
</script>

<template>
  <div class="action-bar">
    <button class="action-bar__btn action-bar__btn--primary" @click="emit('open-side-panel')">
      <span class="action-bar__icon" aria-hidden="true">⤢</span>
      <span>打开 Side Panel</span>
    </button>
    <button class="action-bar__btn" :disabled="busy" @click="emit('extract')">
      <span class="action-bar__icon" aria-hidden="true">↻</span>
      <span>{{ busy ? '提取中…' : '立即提取' }}</span>
    </button>
    <button class="action-bar__btn action-bar__btn--ghost" @click="emit('open-settings')">
      <span class="action-bar__icon" aria-hidden="true">⚙</span>
      <span>设置</span>
    </button>
  </div>
</template>

<style scoped>
.action-bar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
}

.action-bar__btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  background: var(--card);
  color: var(--text);
  font-size: var(--fs-xs);
  font-weight: 600;
  text-align: left;
  border: 1px solid var(--border);
  transition: background 0.15s, border-color 0.15s;
}

.action-bar__btn:hover {
  background: var(--primary-soft);
  border-color: var(--primary);
  color: var(--primary);
}

.action-bar__btn--primary {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}

.action-bar__btn--primary:hover {
  background: var(--primary-strong);
  color: #fff;
  border-color: var(--primary-strong);
}

.action-bar__btn--ghost {
  background: transparent;
  border-color: transparent;
  color: var(--muted);
}

.action-bar__btn--ghost:hover {
  background: var(--card);
  color: var(--text);
}

.action-bar__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-bar__icon {
  font-size: 14px;
  width: 16px;
  text-align: center;
}
</style>
