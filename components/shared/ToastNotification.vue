<script lang="ts" setup>
import { computed } from 'vue';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

interface Props {
  message: string;
  type?: ToastType;
  visible?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'info',
  visible: true,
});

const dotColor = computed(() => {
  switch (props.type) {
    case 'success': return '#4ec98a';
    case 'warning': return '#e2a04a';
    case 'error':   return '#e87474';
    default:        return '#7a7ef0';
  }
});
</script>

<template>
  <Transition name="toast">
    <div
      v-if="visible"
      class="toast"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <!-- Pulsing status dot -->
      <span
        class="toast__dot"
        :style="{ background: dotColor }"
        aria-hidden="true"
      ></span>

      <span class="toast__message">{{ message }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.toast {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 18px;
  background: #2d2c29;
  color: #f5f4ef;
  font-size: var(--fs-xs);
  font-weight: 600;
  border-radius: var(--radius-pill);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.15);
  white-space: nowrap;
  user-select: none;
  pointer-events: none;
}

.toast__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  animation: toast-pulse 1.5s ease-in-out infinite;
}

@keyframes toast-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.85); }
}

.toast__message {
  line-height: 1;
}

/* Transition: translate-y + opacity, per spec 150ms/100ms */
.toast-enter-active {
  transition: opacity 0.15s ease-out, transform 0.15s ease-out;
}
.toast-leave-active {
  transition: opacity 0.1s ease-in, transform 0.1s ease-in;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
.toast-enter-to,
.toast-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
