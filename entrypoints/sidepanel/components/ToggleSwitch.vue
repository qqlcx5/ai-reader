<script setup lang="ts">
defineProps<{
  modelValue: boolean
  label?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

function toggle() {
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <label class="flex items-center gap-2 cursor-pointer select-none" :class="{ 'opacity-50 cursor-not-allowed': disabled }">
    <button
      type="button"
      role="switch"
      :aria-checked="modelValue"
      :aria-label="label"
      :disabled="disabled"
      class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 border-0 cursor-pointer"
      :class="modelValue ? 'bg-blue' : 'bg-gray-300'"
      @click="toggle"
    >
      <span
        class="inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200"
        :class="modelValue ? 'translate-x-6' : 'translate-x-1'"
      />
    </button>
    <span v-if="label" class="text-sm text-text">{{ label }}</span>
  </label>
</template>
