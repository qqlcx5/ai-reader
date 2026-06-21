<script lang="ts" setup>
import { computed } from 'vue';

export interface NavTab {
  id: string;
  label: string;
  icon?: string;
  badge?: string | number;
}

interface Props {
  modelValue: string;
  tabs: NavTab[];
  size?: 'sm' | 'md';
}

const props = withDefaults(defineProps<Props>(), { size: 'sm' });

const emit = defineEmits<{
  (e: 'update:modelValue', id: string): void;
  (e: 'change', id: string): void;
}>();

const activeIndex = computed(() => props.tabs.findIndex((t) => t.id === props.modelValue));

function select(id: string) {
  if (id === props.modelValue) return;
  emit('update:modelValue', id);
  emit('change', id);
}
</script>

<template>
  <nav class="nav-tabs" :class="`nav-tabs--${size}`" role="tablist">
    <button
      v-for="t in tabs"
      :key="t.id"
      class="nav-tabs__item"
      :class="{ 'is-active': t.id === modelValue }"
      role="tab"
      :aria-selected="t.id === modelValue"
      :data-index="tabs.indexOf(t)"
      :data-active-index="activeIndex"
      @click="select(t.id)"
    >
      <span v-if="t.icon" class="nav-tabs__icon" aria-hidden="true">{{ t.icon }}</span>
      <span class="nav-tabs__label">{{ t.label }}</span>
      <span v-if="t.badge !== undefined" class="nav-tabs__badge">{{ t.badge }}</span>
    </button>
  </nav>
</template>

<style scoped>
.nav-tabs {
  display: flex;
  gap: 2px;
  padding: 3px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.nav-tabs__item {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 5px 8px;
  font-size: var(--fs-11);
  font-weight: 600;
  color: var(--muted);
  border-radius: var(--radius-sm);
  transition: background 0.15s, color 0.15s;
}

.nav-tabs__item:hover {
  color: var(--text);
  background: var(--panel);
}

.nav-tabs__item.is-active {
  background: var(--panel);
  color: var(--text);
  box-shadow: var(--shadow-sm);
}

.nav-tabs__icon {
  font-size: 12px;
}

.nav-tabs__badge {
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: var(--radius-pill);
  background: var(--primary);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>
