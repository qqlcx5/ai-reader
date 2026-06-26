<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'

const props = withDefaults(defineProps<{
  modelValue?: boolean
  label?: string
  disabled?: boolean
}>(), {
  modelValue: false,
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <label
    class="inline-flex items-center gap-2.5 cursor-pointer select-none"
    :class="{ 'opacity-50 cursor-not-allowed': disabled }"
  >
    <SwitchRoot
      :checked="modelValue"
      :disabled="disabled"
      class="relative h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      :class="modelValue ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-600'"
      @update:checked="emit('update:modelValue', $event)"
    >
      <SwitchThumb
        class="block h-5 w-5 rounded-full bg-white shadow-sm transition-transform will-change-transform"
        :class="modelValue ? 'translate-x-[22px]' : 'translate-x-[2px]'"
      />
    </SwitchRoot>
    <span
      v-if="label"
      class="text-sm text-slate-700 dark:text-slate-300"
    >
      {{ label }}
    </span>
  </label>
</template>
