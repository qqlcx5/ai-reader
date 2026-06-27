<script setup lang="ts">
defineProps<{
  ariaLabel?: string
  disabled?: boolean
}>()

defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    :aria-label="ariaLabel"
    :disabled="disabled"
    class="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:text-text hover:bg-gray-100 transition-colors duration-150 bg-transparent border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
  >
    <slot />
  </button>
</template>
