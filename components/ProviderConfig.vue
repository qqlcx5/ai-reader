<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useSettingsStore } from '@/stores/settings';
import BaseInput from './base/BaseInput.vue';
import BaseToggle from './base/BaseToggle.vue';
import BaseButton from './base/BaseButton.vue';
import { PROVIDER_META, getProviderIcon } from '@/utils/providers';
import { RotateCcw, ChevronDown, ChevronUp } from 'lucide-vue-next';

const props = defineProps<{
  providerId: string;
}>();

const settings = useSettingsStore();

const config = computed(() => settings.getProviderConfig(props.providerId));
const isEnabled = computed(() => settings.enabledProviders.includes(props.providerId));
const meta = computed(() => PROVIDER_META[props.providerId] || PROVIDER_META.custom);
const iconClass = computed(() => `icon icon-${getProviderIcon(props.providerId)}`);
const isExpanded = ref(false);

const hasCustomConfig = computed(() => {
  return config.value.baseUrl !== meta.value.defaultBaseUrl || config.value.model !== meta.value.defaultModel;
});

function resetToDefaults() {
  settings.updateProvider(props.providerId, {
    baseUrl: meta.value.defaultBaseUrl,
    model: meta.value.defaultModel,
  });
}
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
          <span
            v-if="isEnabled && hasCustomConfig"
            class="ml-1.5 pill-warning !text-[10px] align-middle"
          >自定义</span>
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
        :description="`默认: ${meta.defaultBaseUrl}`"
        :aria-label="`${meta.name} Base URL`"
        @update:model-value="(v) => settings.updateProvider(providerId, { baseUrl: v })"
      />
      <BaseInput
        v-model="config.model"
        type="text"
        label="Model"
        :description="`默认: ${meta.defaultModel}`"
        :aria-label="`${meta.name} Model`"
        @update:model-value="(v) => settings.updateProvider(providerId, { model: v })"
      />
    </div>
    <div v-if="hasCustomConfig" class="flex justify-end">
      <BaseButton variant="ghost" size="sm" @click="resetToDefaults">
        <RotateCcw class="w-3 h-3" />
        恢复默认
      </BaseButton>
    </div>
  </div>
</template>
