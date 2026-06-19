<script lang="ts" setup>
import { ref, watch, onMounted } from 'vue';

const props = withDefaults(defineProps<{
  modelValue?: string;
  label?: string;
  description?: string;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  ariaLabel?: string;
  autoresize?: boolean;
}>(), {
  modelValue: '',
  rows: 3,
  disabled: false,
  autoresize: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const textareaRef = ref<HTMLTextAreaElement | null>(null);

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value);
}

function autoSize() {
  if (!props.autoresize || !textareaRef.value) return;
  textareaRef.value.style.height = 'auto';
  textareaRef.value.style.height = textareaRef.value.scrollHeight + 'px';
}

watch(() => props.modelValue, () => autoSize());

onMounted(() => autoSize());
</script>

<template>
  <div class="w-full">
    <label
      v-if="label"
      :for="ariaLabel"
      class="block text-[var(--font-ui-small)] font-normal text-[var(--text-normal)] mb-1"
    >
      {{ label }}
    </label>
    <textarea
      :id="ariaLabel"
      ref="textareaRef"
      :value="modelValue"
      :placeholder="placeholder"
      :rows="rows"
      :disabled="disabled"
      :aria-label="ariaLabel || label"
      class="textarea-base disabled:opacity-60 disabled:cursor-not-allowed w-full"
      @input="onInput"
    />
    <p v-if="description" class="text-[var(--font-ui-smallest)] text-[var(--text-muted)] mt-1 leading-snug">
      {{ description }}
    </p>
  </div>
</template>
