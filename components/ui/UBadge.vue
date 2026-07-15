<script lang="ts" setup>
import { computed } from 'vue'

/*
 * Lightweight badge for status, tags, and counters.
 */

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<{
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'ghost'
    size?: 'sm' | 'md'
  }>(),
  {
    variant: 'default',
    size: 'md',
  },
)

const classes = computed(() => {
  const base = 'inline-flex items-center justify-center rounded-full font-medium'
  const size = props.size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
  const variantMap: Record<string, string> = {
    default: 'bg-zinc-100 text-zinc-600',
    primary: 'bg-brand/10 text-brand',
    success: 'bg-emerald-50 text-emerald-600',
    warning: 'bg-amber-50 text-amber-600',
    danger: 'bg-red-50 text-red-500',
    ghost: 'bg-transparent text-zinc-500 border border-zinc-200',
  }
  return [base, size, variantMap[props.variant]].join(' ')
})
</script>

<template>
  <span
    v-bind="$attrs"
    :class="classes"
  >
    <slot />
  </span>
</template>
