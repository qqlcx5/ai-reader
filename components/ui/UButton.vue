<script lang="ts" setup>
withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'dashed' | 'link'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}>(), {
  variant: 'secondary',
  size: 'md',
  type: 'button',
})
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="inline-flex items-center justify-center gap-1.5 font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:opacity-50 disabled:cursor-not-allowed"
    :class="{
      'text-[11px] px-2 py-1 rounded-md': size === 'sm',
      'text-[12px] px-3 py-1.5 rounded-lg': size === 'md',
      'text-[13px] px-4 py-2.5 rounded-xl': size === 'lg',
      'bg-brand text-white hover:bg-brand/90': variant === 'primary',
      'bg-zinc-100 text-zinc-700 hover:bg-zinc-200': variant === 'secondary',
      'bg-transparent text-zinc-500 hover:bg-zinc-100': variant === 'ghost',
      'bg-white border border-red-100 text-red-500 hover:bg-red-50': variant === 'danger',
      'border-2 border-dashed border-zinc-200 text-zinc-500 hover:border-brand hover:text-brand hover:bg-brand/5': variant === 'dashed',
      'bg-transparent text-brand hover:underline': variant === 'link',
    }"
  >
    <slot />
  </button>
</template>
