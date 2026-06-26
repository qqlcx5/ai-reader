<template>
  <SelectRoot
    :model-value="modelValue"
    @update:model-value="(v: string) => $emit('update:modelValue', v)"
    :disabled="disabled"
  >
    <SelectTrigger
      class="model-selector__trigger"
      :aria-label="ariaLabel ?? '选择模型'"
    >
      <SelectValue :placeholder="placeholder">
        <span v-if="selectedModel" class="model-selector__value">
          <span class="model-selector__name">{{ selectedModel.name }}</span>
          <span class="model-selector__provider">{{ shortProvider(selectedModel) }}</span>
        </span>
        <span v-else class="model-selector__placeholder">{{ placeholder }}</span>
      </SelectValue>
      <SelectIcon class="model-selector__icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </SelectIcon>
    </SelectTrigger>

    <SelectPortal>
      <SelectContent class="model-selector__content" position="popper" :side-offset="4">
        <SelectViewport class="model-selector__viewport">
          <SelectGroup>
            <SelectLabel v-if="showHeader" class="model-selector__label">可用模型</SelectLabel>

            <template v-if="enabledModels.length === 0">
              <div class="model-selector__empty">
                暂无可用模型
                <button class="model-selector__link" @click="$emit('manage')">前往设置</button>
              </div>
            </template>

            <SelectItem
              v-for="model in enabledModels"
              :key="model.id"
              :value="model.id"
              class="model-selector__item"
            >
              <SelectItemIndicator class="model-selector__indicator">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </SelectItemIndicator>
              <div class="model-selector__item-content">
                <div class="model-selector__item-row">
                  <span class="model-selector__item-name">{{ model.name }}</span>
                  <span v-if="model.isDefault" class="model-selector__badge">默认</span>
                </div>
                <div class="model-selector__item-meta">
                  {{ shortProvider(model) }} · {{ model.model }}
                </div>
              </div>
            </SelectItem>
          </SelectGroup>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import {
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectIcon,
  SelectPortal,
  SelectContent,
  SelectViewport,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectItemIndicator,
} from 'reka-ui'
import type { ModelProviderConfig } from '@db/schema'
import { useModelStore } from '@/core/models/store'

const props = defineProps<{
  modelValue?: string
  placeholder?: string
  /** Filter to only enabled models (default true). */
  enabledOnly?: boolean
  /** Show "可用模型" header above the items. */
  showHeader?: boolean
  /** Disable the selector (e.g. while a request is in flight). */
  disabled?: boolean
  /** Optional aria-label for the trigger. */
  ariaLabel?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'manage'): void
}>()

const store = useModelStore()

onMounted(async () => {
  if (store.models.length === 0) {
    await store.loadAll()
  }
})

const enabledModels = computed<ModelProviderConfig[]>(() => {
  const list = props.enabledOnly === false ? store.models : store.enabledModels
  return list
})

const selectedModel = computed(() =>
  store.models.find((m) => m.id === props.modelValue) ?? null
)

function shortProvider(model: ModelProviderConfig): string {
  // For the seed models the `id` doubles as a friendly short
  // handle. For user-added models we fall back to the host of the
  // baseUrl so the chip still reads sensibly.
  if (model.id) {
    const known: Record<string, string> = {
      'gpt-4o': 'OpenAI',
      'claude-sonnet': 'Anthropic',
      'gemini-pro': 'Google',
      'deepseek-v3': 'DeepSeek',
    }
    if (known[model.id]) return known[model.id]
  }
  try {
    return new URL(model.baseUrl).hostname.replace(/^www\./, '').split('.')[0]
  } catch {
    return model.name
  }
}

// When the store default changes (or models load) and the parent
// has not yet committed a value, default to the persisted default
// model. We only auto-fill; the parent still owns the truth.
watch(
  () => [store.defaultModel?.id, props.modelValue] as const,
  ([defaultId, current]) => {
    if (!current && defaultId) {
      emit('update:modelValue', defaultId)
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.model-selector__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-width: 12rem;
  padding: 0.4rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid #d4d4d4;
  background: #fff;
  color: #262626;
  font-size: 0.875rem;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.dark .model-selector__trigger {
  background: #171717;
  border-color: #404040;
  color: #fafafa;
}
.model-selector__trigger:hover {
  border-color: #0ea5e9;
}
.model-selector__trigger:focus {
  outline: none;
  box-shadow: 0 0 0 2px #bae6fd;
}

.model-selector__value {
  display: inline-flex;
  align-items: baseline;
  gap: 0.5rem;
  min-width: 0;
}
.model-selector__name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 9rem;
}
.model-selector__provider {
  font-size: 0.75rem;
  color: #737373;
}
.dark .model-selector__provider {
  color: #a3a3a3;
}
.model-selector__placeholder {
  color: #a3a3a3;
}

.model-selector__icon {
  color: #737373;
  display: inline-flex;
}

.model-selector__content {
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 0.5rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  min-width: var(--reka-select-trigger-width);
  z-index: 1000;
  overflow: hidden;
}
.dark .model-selector__content {
  background: #171717;
  border-color: #404040;
}

.model-selector__viewport {
  max-height: 16rem;
  padding: 0.25rem;
}

.model-selector__label {
  padding: 0.5rem 0.625rem 0.25rem;
  font-size: 0.75rem;
  color: #737373;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.model-selector__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.625rem 0.4rem 1.5rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  cursor: pointer;
  position: relative;
  user-select: none;
}
.model-selector__item[data-highlighted] {
  background: #f0f9ff;
  outline: none;
}
.dark .model-selector__item[data-highlighted] {
  background: #0c4a6e;
}
.model-selector__item[data-state="checked"] {
  font-weight: 500;
}

.model-selector__indicator {
  position: absolute;
  left: 0.5rem;
  width: 0.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #0ea5e9;
}

.model-selector__item-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.model-selector__item-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.model-selector__item-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.model-selector__item-meta {
  font-size: 0.75rem;
  color: #737373;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dark .model-selector__item-meta {
  color: #a3a3a3;
}
.model-selector__badge {
  display: inline-block;
  font-size: 0.65rem;
  padding: 0.1rem 0.4rem;
  background: #e0f2fe;
  color: #0369a1;
  border-radius: 9999px;
}
.dark .model-selector__badge {
  background: #0c4a6e;
  color: #bae6fd;
}

.model-selector__empty {
  padding: 0.75rem;
  font-size: 0.875rem;
  color: #737373;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}
.model-selector__link {
  background: none;
  border: none;
  color: #0ea5e9;
  cursor: pointer;
  font-size: 0.75rem;
  text-decoration: underline;
}
</style>
