<script lang="ts" setup>
interface Props {
  label?: string;
  size?: 'sm' | 'md';
}

withDefaults(defineProps<Props>(), { label: undefined, size: 'sm' });
</script>

<template>
  <div class="loading-dots" :class="`loading-dots--${size}`" role="status" :aria-label="label || 'loading'">
    <span></span>
    <span></span>
    <span></span>
  </div>
</template>

<style scoped>
.loading-dots {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.loading-dots span {
  display: inline-block;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.4;
  animation: bounce 1.2s infinite ease-in-out;
}

.loading-dots span:nth-child(2) {
  animation-delay: 0.15s;
}

.loading-dots span:nth-child(3) {
  animation-delay: 0.3s;
}

.loading-dots--md span {
  width: 6px;
  height: 6px;
}

@keyframes bounce {
  0%, 80%, 100% {
    opacity: 0.3;
    transform: translateY(0);
  }
  40% {
    opacity: 1;
    transform: translateY(-2px);
  }
}
</style>
