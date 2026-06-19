<script lang="ts" setup>
import { AlertCircle, FileText, Info, RotateCcw, type Component } from 'lucide-vue-next';

withDefaults(defineProps<{
  variant?: 'empty' | 'error' | 'info';
  title?: string;
  description?: string;
  icon?: Component;
  retryText?: string;
  size?: 'sm' | 'md' | 'lg';
  role?: string;
}>(), {
  variant: 'empty',
  size: 'md',
  role: 'status',
});

const emit = defineEmits<{
  retry: [];
}>();

const defaultIcon: Record<string, Component> = {
  empty: FileText,
  error: AlertCircle,
  info: Info,
};

const sizeIconClass: Record<string, string> = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
};

const sizeTitleClass: Record<string, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};
</script>

<template>
  <div class="state-center" :role="role" :aria-label="title">
    <component
      :is="icon || defaultIcon[variant]"
      :class="[
        sizeIconClass[size],
        variant === 'error' ? 'text-[var(--text-error)]' : variant === 'info' ? 'text-[var(--text-accent)]' : 'text-[var(--text-faint)]',
      ]"
    />
    <h2 v-if="title" :class="['font-semibold text-[var(--text-normal)]', sizeTitleClass[size]]">
      {{ title }}
    </h2>
    <p v-if="description" class="text-[var(--font-ui-small)] text-[var(--text-muted)] max-w-sm leading-snug">
      {{ description }}
    </p>
    <slot />
    <button
      v-if="retryText"
      type="button"
      class="btn-secondary-sm mt-2"
      @click="emit('retry')"
    >
      <RotateCcw class="w-3 h-3" />
      {{ retryText }}
    </button>
  </div>
</template>
