<script lang="ts" setup>
withDefaults(defineProps<{
  variant?: 'default' | 'primary' | 'danger' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  title?: string;
}>(), {
  variant: 'default',
  size: 'md',
  active: false,
  disabled: false,
});

const sizeClass: Record<string, string> = {
  sm: 'w-6 h-6 [&_svg]:w-3.5 [&_svg]:h-3.5',
  md: 'clickable-icon',
  lg: 'w-9 h-9 [&_svg]:w-5 [&_svg]:h-5',
};
</script>

<template>
  <button
    type="button"
    :disabled="disabled"
    :aria-label="ariaLabel"
    :title="title || ariaLabel"
    :class="[
      sizeClass[size],
      active && size === 'md' && 'clickable-icon-active',
      active && size !== 'md' && 'bg-[var(--color-accent-soft)] text-[var(--text-accent)]',
      variant === 'danger' && 'text-[var(--text-error)] hover:!bg-[var(--background-modifier-error)]',
      variant === 'primary' && 'text-[var(--text-accent)]',
      disabled && 'opacity-50 cursor-not-allowed hover:!bg-transparent',
    ]"
  >
    <slot />
  </button>
</template>
