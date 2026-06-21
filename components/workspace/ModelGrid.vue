<script lang="ts" setup>
/**
 * M4 — ModelGrid
 * 多模型并排：默认单列，>= 2 时 md:grid-cols-2
 */
import ModelCard from './ModelCard.vue';
import type { ModelResponseStatus } from '@/lib/workspace';

interface ProviderSlot {
  id: string;
  name: string;
  color?: string;
}

const props = defineProps<{
  responses: ModelResponseStatus[];
  providers: ProviderSlot[];
}>();

const emit = defineEmits<{
  (e: 'continue', payload: { providerId: string }): void;
  (e: 'abort', payload: { providerId: string }): void;
  (e: 'retry', payload: { providerId: string }): void;
}>();

function providerFor(id: string): ProviderSlot | undefined {
  return props.providers.find((p) => p.id === id);
}

const gridClass = props.responses.length >= 2 ? 'model-grid--multi' : 'model-grid--single';
</script>

<template>
  <div class="model-grid" :class="gridClass">
    <template v-for="resp in responses" :key="resp.providerId">
      <ModelCard
        :response="resp"
        :provider-name="providerFor(resp.providerId)?.name ?? resp.providerId"
        :provider-color="providerFor(resp.providerId)?.color"
        @continue="(p) => emit('continue', p)"
        @abort="(p) => emit('abort', p)"
        @retry="(p) => emit('retry', p)"
      />
    </template>
  </div>
</template>

<style scoped>
.model-grid {
  display: grid;
  gap: 10px;
  margin: 6px 0 12px;
}

.model-grid--single {
  grid-template-columns: 1fr;
}

.model-grid--multi {
  grid-template-columns: 1fr;
}

@media (min-width: 720px) {
  .model-grid--multi {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
