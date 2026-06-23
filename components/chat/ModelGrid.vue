<script lang="ts" setup>
/**
 * M4 — ModelGrid
 * grid-cols-1 默认，2 个模型时 md:grid-cols-2，3～4 时 grid-cols-2。
 * 渲染 ModelCard 列表。
 */
import { computed } from 'vue'
import ModelCard from './ModelCard.vue'
import type { ProviderSlot } from '@/stores/arena.store'

const props = defineProps<{
  slots: ProviderSlot[]
}>()

const emit = defineEmits<{
  (e: 'continue', payload: { engineId: string }): void
  (e: 'abort', payload: { engineId: string }): void
  (e: 'retry', payload: { engineId: string }): void
}>()

const gridClass = computed<string>(() => {
  const n = props.slots.length
  if (n >= 3) return 'model-grid--quad'
  if (n === 2) return 'model-grid--dual'
  return 'model-grid--single'
})
</script>

<template>
  <div class="model-grid" :class="gridClass">
    <ModelCard
      v-for="slot in slots"
      :key="slot.engineId"
      :engine-id="slot.engineId"
      :name="slot.name"
      :color="slot.color"
      :status="slot.status"
      :content="slot.text"
      :metrics="slot.metrics"
      :error="slot.error"
      :cached="slot.cached"
      @continue="(p) => emit('continue', p)"
      @abort="(p) => emit('abort', p)"
      @retry="(p) => emit('retry', p)"
    />
  </div>
</template>

<style scoped>
.model-grid {
  display: grid;
  gap: 10px;
  padding: 4px 12px 8px;
}

.model-grid--single {
  grid-template-columns: 1fr;
}

.model-grid--dual {
  grid-template-columns: 1fr;
}

.model-grid--quad {
  grid-template-columns: repeat(2, 1fr);
}

@media (min-width: 720px) {
  .model-grid--dual {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
