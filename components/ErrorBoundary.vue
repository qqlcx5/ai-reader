<script lang="ts" setup>
import { ref, onErrorCaptured } from 'vue';
import { AlertCircle, RotateCcw } from 'lucide-vue-next';
import BaseState from './base/BaseState.vue';
import BaseButton from './base/BaseButton.vue';

const error = ref<Error | null>(null);

onErrorCaptured((err) => {
  error.value = err;
  console.error('[ErrorBoundary]', err);
  return false;
});

function reload() {
  error.value = null;
  window.location.reload();
}
</script>

<template>
  <BaseState
    v-if="error"
    variant="error"
    title="Something went wrong"
    :description="error.message || 'An unexpected error occurred in this section.'"
    :icon="AlertCircle"
    size="sm"
    role="alert"
  >
    <BaseButton variant="primary" size="sm" @click="reload">
      <template #icon-left><RotateCcw class="w-3 h-3" /></template>
      Reload
    </BaseButton>
  </BaseState>
  <slot v-else />
</template>
