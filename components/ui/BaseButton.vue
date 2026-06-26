<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
}>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const variantClasses = computed(() => {
  switch (props.variant) {
    case 'primary':
      return 'bg-brand-500 text-white hover:bg-brand-600 focus:ring-brand-500/20'
    case 'secondary':
      return 'bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 focus:ring-slate-400/20'
    case 'ghost':
      return 'bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 focus:ring-slate-400/20'
    case 'danger':
      return 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500/20'
  }
})

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'px-3 py-1.5 text-xs'
    case 'md':
      return 'px-4 py-2 text-sm'
    case 'lg':
      return 'px-6 py-2.5 text-base'
  }
})
</script>

<template>
  <button
    :disabled="disabled || loading"
    :class="[
      'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2',
      variantClasses,
      sizeClasses,
      (disabled || loading) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
    ]"
    @click="emit('click', $event)"
  >
    <svg
      v-if="loading"
      class="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
    <slot />
  </button>
</template>
