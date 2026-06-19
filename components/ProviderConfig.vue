<script lang="ts" setup>
import { computed } from 'vue';
import { useSettingsStore } from '@/stores/settings';
import { Check, X } from 'lucide-vue-next';

const props = defineProps<{
  providerId: string;
  providerName: string;
}>();

const settings = useSettingsStore();

const config = computed(() => settings.getProviderConfig(props.providerId));
const isEnabled = computed(() => settings.enabledProviders.includes(props.providerId));

function updateApiKey(value: string) {
  settings.updateProvider(props.providerId, { apiKey: value });
}

function updateBaseUrl(value: string) {
  settings.updateProvider(props.providerId, { baseUrl: value });
}

function updateModel(value: string) {
  settings.updateProvider(props.providerId, { model: value });
}
</script>

<template>
  <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
    <div class="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
      <h3 class="text-lg font-semibold">{{ providerName }}</h3>
      <button
        @click="settings.toggleProvider(providerId)"
        class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors"
        :class="isEnabled ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
      >
        <Check v-if="isEnabled" class="w-4 h-4" />
        <X v-else class="w-4 h-4" />
        {{ isEnabled ? 'Enabled' : 'Disabled' }}
      </button>
    </div>

    <div class="p-4 space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">API Key</label>
        <input
          type="password"
          :value="config.apiKey"
          @input="updateApiKey(($event.target as HTMLInputElement).value)"
          placeholder="sk-..."
          class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
        <input
          type="text"
          :value="config.baseUrl"
          @input="updateBaseUrl(($event.target as HTMLInputElement).value)"
          class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Model</label>
        <input
          type="text"
          :value="config.model"
          @input="updateModel(($event.target as HTMLInputElement).value)"
          class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>
  </div>
</template>
