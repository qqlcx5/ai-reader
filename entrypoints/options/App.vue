<script lang="ts" setup>
import { useSettingsStore } from '@/stores/settings';
import ProviderConfig from '@/components/ProviderConfig.vue';
import { PROVIDERS } from '@/utils/llm';
import { Settings } from 'lucide-vue-next';

const settings = useSettingsStore();

const providerList = Object.entries(PROVIDERS).map(([id, p]) => ({
  id,
  name: p.name,
}));
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8">
    <div class="max-w-3xl mx-auto px-4">
      <div class="flex items-center gap-3 mb-8">
        <Settings class="w-8 h-8 text-blue-600" />
        <h1 class="text-2xl font-bold">AI Reader Settings</h1>
      </div>

      <div class="space-y-6">
        <div v-for="provider in providerList" :key="provider.id">
          <ProviderConfig
            :provider-id="provider.id"
            :provider-name="provider.name"
          />
        </div>
      </div>
    </div>
  </div>
</template>
