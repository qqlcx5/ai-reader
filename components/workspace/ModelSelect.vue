<script lang="ts" setup>
import { computed } from 'vue'
import type { ModelConfig } from '@/types/model'
import Select from '@/components/ui/Select.vue'

const props = withDefaults(
  defineProps<{
    modelValue: string | string[]
    models: ModelConfig[]
    multiple?: boolean
  }>(),
  { multiple: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | string[]]
}>()

const enabledModels = computed(() =>
  props.models.filter((m) => m.enabled),
)

// ── Single-select mode ──────────────────────────────────
const singleOptions = computed(() =>
  enabledModels.value.map((m) => ({
    value: m.id,
    label: m.name,
  })),
)

const currentLabel = computed(() => {
  const model = props.models.find((m) => m.id === props.modelValue)
  return model?.name ?? 'Select model'
})

// ── Multi-select mode ───────────────────────────────────
const selectedIds = computed<string[]>(() => {
  if (Array.isArray(props.modelValue)) return props.modelValue
  return props.modelValue ? [props.modelValue] : []
})

function toggle(id: string) {
  if (!props.multiple) {
    emit('update:modelValue', id)
    return
  }
  const next = selectedIds.value.includes(id)
    ? selectedIds.value.filter((mid) => mid !== id)
    : [...selectedIds.value, id]
  emit('update:modelValue', next)
}

const selectedModelsMap = computed(() => {
  const map = new Map<string, ModelConfig>()
  for (const m of enabledModels.value) {
    map.set(m.id, m)
  }
  return map
})
</script>

<template>
  <!-- Single-select: original dropdown -->
  <template v-if="!multiple">
    <Select
      v-if="singleOptions.length > 0"
      :model-value="(modelValue as string) ?? ''"
      :options="singleOptions"
      :placeholder="currentLabel"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <span v-else class="text-[10px] text-zinc-400">No enabled models</span>
  </template>

  <!-- Multi-select: tag chips -->
  <template v-else>
    <div v-if="enabledModels.length > 0" class="flex flex-wrap gap-1">
      <button
        v-for="m in enabledModels"
        :key="m.id"
        class="text-[11px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer select-none"
        :class="
          selectedIds.includes(m.id)
            ? 'bg-brand text-white border-brand'
            : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
        "
        @click="toggle(m.id)"
      >
        {{ m.name }}
      </button>
    </div>
    <span v-else class="text-[10px] text-zinc-400">No enabled models</span>
  </template>
</template>
