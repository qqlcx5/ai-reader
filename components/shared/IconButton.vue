<script lang="ts" setup>
import { computed } from 'vue';

interface Props {
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  size?: 'xs' | 'sm' | 'md';
  disabled?: boolean;
  active?: boolean;
  ariaLabel?: string;
  title?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'sm',
  disabled: false,
  active: false,
  ariaLabel: undefined,
  title: undefined,
});

defineEmits<{ (e: 'click', ev: MouseEvent): void }>();

const classes = computed(() => [
  'icon-btn',
  `icon-btn--${props.variant}`,
  `icon-btn--${props.size}`,
  { 'icon-btn--active': props.active, 'icon-btn--disabled': props.disabled },
]);
</script>

<template>
  <button
    :class="classes"
    :aria-label="ariaLabel"
    :title="title"
    :disabled="disabled"
    :aria-pressed="active"
    @click="(ev) => $emit('click', ev)"
  >
    <slot />
  </button>
</template>

<style scoped>
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  color: var(--text);
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.icon-btn--xs {
  width: 22px;
  height: 22px;
}

.icon-btn--sm {
  width: 28px;
  height: 28px;
}

.icon-btn--md {
  width: 34px;
  height: 34px;
}

.icon-btn--default {
  background: transparent;
  color: var(--muted);
}

.icon-btn--default:hover {
  background: var(--card);
  color: var(--text);
}

.icon-btn--primary {
  background: var(--primary);
  color: #fff;
}

.icon-btn--primary:hover {
  background: var(--primary-strong);
}

.icon-btn--ghost {
  background: transparent;
  color: var(--muted);
}

.icon-btn--ghost:hover {
  background: var(--primary-soft);
  color: var(--primary);
}

.icon-btn--danger {
  background: var(--red-soft);
  color: var(--red);
}

.icon-btn--danger:hover {
  background: var(--red);
  color: #fff;
}

.icon-btn--active {
  background: var(--primary-soft);
  color: var(--primary);
  border-color: var(--primary);
}

.icon-btn--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
