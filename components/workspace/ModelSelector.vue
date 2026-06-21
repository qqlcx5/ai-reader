<script lang="ts" setup>
/**
 * M4 — ModelSelector
 * 1~4 Provider 多选 chips。
 */
import { computed } from 'vue';
import type { ProviderConfig } from '@/modules/provider';

const props = defineProps<{
  providers: ProviderConfig[];
  /** 已选中的 Provider ID 列表 */
  selected: string[];
  /** 最多可选数量，默认 4 */
  max?: number;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:selected', value: string[]): void;
}>();

const maxCount = computed(() => props.max ?? 4);

function isChecked(id: string): boolean {
  return props.selected.includes(id);
}

function toggle(id: string) {
  if (props.disabled) return;
  if (isChecked(id)) {
    emit('update:selected', props.selected.filter((x) => x !== id));
    return;
  }
  if (props.selected.length >= maxCount.value) return;
  emit('update:selected', [...props.selected, id]);
}

function colorForType(type: string): string {
  switch (type) {
    case 'openai':
      return '#10a37f';
    case 'anthropic':
      return '#cc785c';
    case 'gemini':
      return '#248a52';
    default:
      return '#5b60e5';
  }
}
</script>

<template>
  <div class="model-selector">
    <div class="model-selector__hint muted">
      <span>并发模型路由</span>
      <span class="mono">{{ selected.length }}/{{ maxCount }}</span>
    </div>
    <div class="model-selector__chips" v-if="providers.length > 0">
      <button
        v-for="p in providers"
        :key="p.id"
        type="button"
        class="chip"
        :class="{ 'chip--checked': isChecked(p.id) }"
        :disabled="disabled || (!isChecked(p.id) && selected.length >= maxCount)"
        @click="toggle(p.id)"
      >
        <span class="chip__dot" :style="{ background: colorForType(p.type) }"></span>
        <span class="chip__name">{{ p.name }}</span>
        <span class="chip__model mono">{{ p.model }}</span>
      </button>
    </div>
    <div v-else class="model-selector__empty muted">
      还没有配置 Provider，请到「设置 → 模型」中添加。
    </div>
  </div>
</template>

<style scoped>
.model-selector {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.model-selector__hint {
  display: flex;
  justify-content: space-between;
  font-size: var(--fs-10);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
}

.model-selector__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.model-selector__empty {
  font-size: var(--fs-11);
  font-style: italic;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text);
  border-radius: var(--radius-pill);
  font-size: var(--fs-11);
  font-weight: 600;
  cursor: pointer;
  transition: all 100ms ease-out;
}

.chip:hover:not(:disabled) {
  background: var(--card);
}

.chip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chip--checked {
  background: var(--primary-soft);
  border-color: #d2d6ff;
  color: var(--primary);
}

.chip__dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-pill);
}

.chip__name {
  font-weight: 700;
}

.chip__model {
  font-size: 9px;
  color: var(--muted);
  font-weight: 500;
}

.chip--checked .chip__model {
  color: var(--primary);
}
</style>
