<script lang="ts" setup>
import { computed } from 'vue';
import { useSettingsStore } from '@/stores/settings';
import BaseInput from './base/BaseInput.vue';
import BaseToggle from './base/BaseToggle.vue';
import { PROVIDER_META, getProviderIcon } from '@/utils/providers';

const props = defineProps<{
  providerId: string;
}>();

const settings = useSettingsStore();

const config = computed(() => settings.getProviderConfig(props.providerId));
const isEnabled = computed(() => settings.enabledProviders.includes(props.providerId));
const meta = computed(() => PROVIDER_META[props.providerId] || PROVIDER_META.custom);
const iconClass = computed(() => `icon icon-${getProviderIcon(props.providerId)}`);
</script>

<template>
  <div
    class="setting-item-mod-horizontal"
    role="listitem"
  >
    <div class="flex items-start gap-3 flex-1 min-w-0">
      <span
        :class="iconClass"
        :style="{ color: meta.color, fontSize: '1.5rem' }"
        aria-hidden="true"
      />
      <div class="setting-item-info">
        <div class="setting-item-label font-medium">
          {{ meta.name }}
          <span
            v-if="!isEnabled"
            class="ml-1.5 pill-neutral !text-[10px] align-middle"
          >未启用</span>
        </div>
        <div class="setting-item-description">
          {{ meta.description }}
        </div>
      </div>
    </div>
    <div class="setting-item-control">
      <BaseToggle
        :model-value="isEnabled"
        size="sm"
        :aria-label="`启用 ${meta.name}`"
        @update:model-value="settings.toggleProvider(providerId)"
      />
    </div>
  </div>

  <div
    v-if="isEnabled"
    class="px-4 pb-4 -mt-2 stack-3 border-b border-[var(--background-modifier-border)]"
  >
    <BaseInput
      v-model="config.apiKey"
      type="password"
      label="API Key"
      description="本地加密存储，不会发送到任何服务器"
      :aria-label="`${meta.name} API Key`"
      @update:model-value="(v) => settings.updateProvider(providerId, { apiKey: v })"
    />
    <div class="grid grid-cols-2 gap-3">
      <BaseInput
        v-model="config.baseUrl"
        type="url"
        label="Base URL"
        description="自定义 API 端点，留空使用默认"
        :aria-label="`${meta.name} Base URL`"
        @update:model-value="(v) => settings.updateProvider(providerId, { baseUrl: v })"
      />
      <BaseInput
        v-model="config.model"
        type="text"
        label="Model"
        :aria-label="`${meta.name} Model`"
        @update:model-value="(v) => settings.updateProvider(providerId, { model: v })"
      />
    </div>
  </div>
</template>
