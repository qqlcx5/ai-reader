<script lang="ts" setup>
import { computed } from 'vue'
import type { ModelConfig } from '@/types/model'
import Select from '@/components/ui/Select.vue'

const props = defineProps<{
  modelValue: string
  models: ModelConfig[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const enabledModels = computed(() =>
  props.models.filter((m) => m.enabled),
)

const options = computed(() =>
  enabledModels.value.map((m) => ({
    value: m.id,
    label: m.name,
  })),
)

const currentLabel = computed(() => {
  const model = props.models.find((m) => m.id === props.modelValue)
  return model?.name ?? 'Select model'
})
</script>

<template>
  <Select
    v-if="options.length > 0"
    :model-value="modelValue"
    :options="options"
    :placeholder="currentLabel"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <span v-else class="text-[10px] text-zinc-400">No enabled models</span>
</template>
