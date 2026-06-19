<script lang="ts" setup>
import { ref } from 'vue';
import { Send } from 'lucide-vue-next';

const props = defineProps<{
  disabled?: boolean;
}>();

const emit = defineEmits<{
  send: [message: string];
}>();

const text = ref('');

function handleSend() {
  const msg = text.value.trim();
  if (!msg || props.disabled) return;
  emit('send', msg);
  text.value = '';
}
</script>

<template>
  <div class="flex items-center gap-1 p-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
    <input
      v-model="text"
      type="text"
      placeholder="Ask a follow-up..."
      class="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
      :disabled="disabled"
      @keyup.enter="handleSend"
    />
    <button
      @click="handleSend"
      :disabled="disabled || !text.trim()"
      class="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      aria-label="发送"
    >
      <Send class="w-4 h-4" />
    </button>
  </div>
</template>
