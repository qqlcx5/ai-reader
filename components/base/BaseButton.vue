<script lang="ts" setup>
interface Props {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  block?: boolean;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  ariaLabel?: string;
}
const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  loading: false,
  block: false,
  type: 'button',
  disabled: false,
});

defineEmits<{ click: [MouseEvent] }>();

const sizeClass = {
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
}[props.size];

const variantClass = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  success: 'btn-success',
}[props.variant];
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="[sizeClass, variantClass, block && 'w-full', 'disabled:opacity-50 disabled:cursor-not-allowed']"
    :aria-label="ariaLabel"
    :aria-busy="loading"
    @click="(e: MouseEvent) => $emit('click', e)"
  >
    <span v-if="loading" class="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
    <slot v-else name="icon-left" />
    <slot />
    <slot name="icon-right" />
  </button>
</template>
