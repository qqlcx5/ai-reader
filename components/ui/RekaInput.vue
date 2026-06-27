<script lang="ts" setup>
withDefaults(defineProps<{
  modelValue?: string
  type?: string
  placeholder?: string
}>(), {
  type: 'text',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <input
    :value="modelValue"
    :type="type"
    :placeholder="placeholder"
    class="outline-none transition-colors focus:border-brand"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>
