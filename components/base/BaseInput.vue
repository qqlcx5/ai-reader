<script lang="ts" setup>
withDefaults(defineProps<{
  modelValue?: string | number;
  type?: 'text' | 'password' | 'email' | 'url' | 'number' | 'search';
  label?: string;
  description?: string;
  placeholder?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  required?: boolean;
  ariaLabel?: string;
}>(), {
  modelValue: '',
  type: 'text',
  size: 'md',
  disabled: false,
  required: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value);
}
</script>

<template>
  <div class="w-full">
    <label
      v-if="label"
      :for="ariaLabel"
      class="block text-[var(--font-ui-small)] font-normal text-[var(--text-normal)] mb-1"
    >
      {{ label }}
      <span v-if="required" class="text-[var(--text-error)]">*</span>
    </label>
    <input
      :id="ariaLabel"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      :aria-label="ariaLabel || label"
      :class="[
        'input-base',
        size === 'sm' ? 'h-6 px-1.5 text-xs' : 'h-[var(--input-height)] px-2 text-[var(--font-ui-smaller)]',
        'disabled:opacity-60 disabled:cursor-not-allowed',
      ]"
      @input="onInput"
    />
    <p v-if="description" class="text-[var(--font-ui-smallest)] text-[var(--text-muted)] mt-1 leading-snug">
      {{ description }}
    </p>
  </div>
</template>
