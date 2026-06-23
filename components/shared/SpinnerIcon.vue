<script lang="ts" setup>
withDefaults(
  defineProps<{
    size?: 'xs' | 'sm' | 'md' | 'lg';
    color?: string;
  }>(),
  { size: 'sm', color: 'currentColor' },
);
</script>

<template>
  <span
    class="spinner"
    :class="`spinner--${size}`"
    role="status"
    aria-label="加载中"
  >
    <svg viewBox="0 0 24 24" fill="none" :style="{ color }">
      <circle
        cx="12" cy="12" r="10"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-dasharray="31.4 31.4"
        stroke-dashoffset="10"
      />
    </svg>
  </span>
</template>

<style scoped>
.spinner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

.spinner--xs { width: 12px; height: 12px; }
.spinner--sm { width: 16px; height: 16px; }
.spinner--md { width: 20px; height: 20px; }
.spinner--lg { width: 28px; height: 28px; }

.spinner svg {
  width: 100%;
  height: 100%;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
