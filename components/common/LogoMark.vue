<script lang="ts" setup>
withDefaults(defineProps<{ size?: number }>(), { size: 24 })
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <!-- A monogram -->
    <path
      d="M12 3.5 L19.5 20 L16.2 20 L14.6 16 L9.4 16 L7.8 20 L4.5 20 Z M10.4 13 L13.6 13 L12 8.9 Z"
      fill="currentColor"
    />
    <!-- brainwave line -->
    <path
      d="M3 14.5 Q 6 12.5 8.5 14.5 T 14 14.5 T 21 14.5"
      stroke="currentColor"
      stroke-width="1.4"
      stroke-linecap="round"
      fill="none"
      opacity="0.55"
    />
  </svg>
</template>
