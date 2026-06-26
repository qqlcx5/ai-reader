<script lang="ts" setup>
import { ref, onErrorCaptured } from 'vue';
import { AlertCircle, RotateCcw } from 'lucide-vue-next';

const error = ref<Error | null>(null);

onErrorCaptured((err) => {
  error.value = err;
  console.error('[ErrorBoundary]', err);
  return false; // Prevent error from propagating
});

function reload() {
  error.value = null;
  window.location.reload();
}
</script>

<template>
  <div v-if="error" class="flex flex-col items-center justify-center h-full p-6 text-center" role="alert">
    <AlertCircle class="w-12 h-12 text-red-500 mb-4" />
    <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">出现错误</h2>
    <p class="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-md">
      {{ error.message || '组件渲染时发生未知错误' }}
    </p>
    <button
      @click="reload"
      class="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
    >
      <RotateCcw class="w-4 h-4" />
      重新加载
    </button>
  </div>
  <slot v-else />
</template>
