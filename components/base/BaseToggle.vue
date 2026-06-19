<script lang="ts" setup>
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  modelValue: boolean;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}>(), {
  size: 'md',
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const toggle = () => emit('update:modelValue', !props.modelValue);

const dimensions = computed(() => {
  if (props.size === 'sm') {
    return {
      track: 'w-8 h-4',
      thumb: 'w-3 h-3',
      onOffset: 'translate-x-4',
    };
  }
  return {
    track: 'w-10 h-5',
    thumb: 'w-4 h-4',
    onOffset: 'translate-x-5',
  };
});
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="ariaLabel"
    :class="[
      'relative inline-block shrink-0 cursor-pointer rounded-full transition-[background-color,box-shadow] duration-150',
      'shadow-[inset_0_4px_10px_rgba(0,0,0,0.07),inset_0_0_1px_rgba(0,0,0,0.21)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--background-modifier-border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background-primary)]',
      dimensions.track,
      modelValue
        ? 'bg-[var(--interactive-accent)] shadow-[inset_0_4px_10px_rgba(0,0,0,0.14),inset_0_0_1px_rgba(0,0,0,0.28)]'
        : 'bg-[var(--background-modifier-border-hover)]',
    ]"
    @click="toggle"
  >
    <span
      :class="[
        'absolute top-1/2 -translate-y-1/2 left-0.5 bg-white rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-transform duration-150 pointer-events-none',
        dimensions.thumb,
        modelValue ? dimensions.onOffset : 'translate-x-0',
      ]"
    />
  </button>
</template>
