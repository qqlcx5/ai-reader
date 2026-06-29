<script lang="ts" setup>
import { ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?: string
  placeholder?: string
  rows?: number | string
  autoHeight?: boolean
}>(), {
  rows: 3,
  autoHeight: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const ta = ref<HTMLTextAreaElement>()

function handleInput(e: Event) {
  const target = e.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
  if (props.autoHeight) {
    target.style.height = 'auto'
    target.style.height = target.scrollHeight + 'px'
  }
}

watch(() => props.modelValue, () => {
  if (props.autoHeight && ta.value) {
    ta.value.style.height = 'auto'
    ta.value.style.height = ta.value.scrollHeight + 'px'
  }
}, { flush: 'post' })
</script>

<template>
  <textarea
    ref="ta"
    :value="modelValue"
    :placeholder="placeholder"
    :rows="Number(rows)"
    class="outline-none resize-none transition-colors"
    @input="handleInput"
  />
</template>
