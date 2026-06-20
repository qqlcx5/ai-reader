<script lang="ts" setup>
import { ref } from 'vue';
import { Send } from 'lucide-vue-next';

const props = defineProps<{
  disabled?: boolean;
  placeholder?: string;
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
  <div class="flex items-center gap-1.5 p-2 border-t border-[var(--background-modifier-border)] bg-[var(--background-primary)] rounded-b-[var(--radius-l)] [corner-shape:var(--corner-shape)] shrink-0">
    <input
      v-model="text"
      type="text"
      :placeholder="placeholder || '继续提问…'"
      class="input-md flex-1"
      :disabled="disabled"
      aria-label="继续提问输入"
      @keyup.enter="handleSend"
    />
    <button
      type="button"
      class="clickable-icon !w-7 !h-7"
      :class="(disabled || !text.trim()) ? 'opacity-40 cursor-not-allowed' : 'text-[var(--text-accent)] hover:!bg-[var(--color-accent-soft)]'"
      :disabled="disabled || !text.trim()"
      aria-label="发送"
      @click="handleSend"
    >
      <Send class="w-3.5 h-3.5" />
    </button>
  </div>
</template>
