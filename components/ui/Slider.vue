<script lang="ts" setup>
import { computed } from 'vue'
import { SliderRoot, SliderRange, SliderTrack, SliderThumb } from 'reka-ui'

const props = defineProps<{
  modelValue: number
  min: number
  max: number
  step?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const values = computed<number[]>({
  get: () => [props.modelValue],
  set: (next) => {
    const value = next?.[0]
    if (value != null) emit('update:modelValue', value)
  },
})
</script>

<template>
  <SliderRoot
    v-model="values"
    :min="min"
    :max="max"
    :step="step || 1"
    class="relative flex items-center w-full h-6 touch-none select-none"
  >
    <SliderTrack class="relative h-1.5 w-full grow rounded-full bg-zinc-200 cursor-pointer">
      <SliderRange class="absolute h-full rounded-full bg-brand" />
    </SliderTrack>
    <SliderThumb
      class="absolute w-4 h-4 bg-white rounded-full shadow-sm border border-zinc-300 cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-brand/30 hover:border-brand z-10"
    />
  </SliderRoot>
</template>
