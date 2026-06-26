<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue?: string
  label?: string
  placeholder?: string
  type?: 'text' | 'password' | 'email' | 'number'
  error?: string
  disabled?: boolean
}>(), {
  modelValue: '',
  type: 'text',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label
      v-if="label"
      class="text-sm font-medium text-slate-700 dark:text-slate-300"
    >
      {{ label }}
    </label>
    <input
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :aria-invalid="!!error"
      :aria-describedby="error ? `${label}-error` : undefined"
      :class="[
        'w-full bg-white dark:bg-slate-800 border rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 transition-colors',
        'focus:outline-none focus:ring-1 focus:ring-brand-500/20 focus:border-brand-500',
        error
          ? 'border-red-400 dark:border-red-500'
          : 'border-slate-300 dark:border-slate-600',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ]"
      @input="onInput"
    />
    <p
      v-if="error"
      :id="`${label}-error`"
      class="text-xs text-red-500"
      role="alert"
    >
      {{ error }}
    </p>
  </div>
</template>
