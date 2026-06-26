<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useSettingsStore } from '@/stores/settings.store';

const props = defineProps<{
  modelId: string | null;
}>();

const emit = defineEmits<{
  'update:modelId': [id: string];
}>();

const settingsStore = useSettingsStore();

onMounted(async () => {
  if (settingsStore.models.length === 0) {
    await settingsStore.loadModels();
  }
});

const enabledModels = computed(() => settingsStore.enabledModels);

const selectedModel = computed(() =>
  enabledModels.value.find((m) => m.id === props.modelId),
);

function handleChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  emit('update:modelId', target.value);
}
</script>

<template>
  <select
    :value="modelId || ''"
    class="input text-sm"
    @change="handleChange"
  >
    <option value="" disabled>选择模型</option>
    <option
      v-for="model in enabledModels"
      :key="model.id"
      :value="model.id"
    >
      {{ model.name }} - {{ model.model }}
    </option>
  </select>
</template>
