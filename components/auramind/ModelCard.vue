<script lang="ts" setup>
import { computed } from 'vue'
import { Settings, Trash2, Cpu, Bot, Box, Copy, Activity } from '@lucide/vue'
import Switch from '@/components/ui/Switch.vue'
import type { ModelConfig } from '@/types/model'

const props = defineProps<{
  model: ModelConfig
}>()

const emit = defineEmits<{
  edit: [id: string]
  delete: [id: string]
  duplicate: [id: string]
  ping: [id: string]
  toggleEnabled: [id: string, value: boolean]
}>()

const displayBaseUrl = computed(() => {
  const url = props.model.baseUrl || ''
  return url.length > 36 ? url.slice(0, 36) + '...' : url
})

const providerLabel = computed(() => {
  switch (props.model.provider) {
    case 'openai-compatible': return 'OpenAI Compatible'
    case 'anthropic': return 'Anthropic'
    case 'ollama': return 'Ollama'
    default: return props.model.provider
  }
})

const providerIcon = computed(() => {
  switch (props.model.provider) {
    case 'openai-compatible': return Bot
    case 'anthropic': return Cpu
    case 'ollama': return Box
    default: return Bot
  }
})

const iconBg = computed(() => {
  switch (props.model.provider) {
    case 'openai-compatible': return 'bg-emerald-50 border-emerald-100 text-emerald-600'
    case 'anthropic': return 'bg-orange-50 border-orange-100 text-orange-500'
    case 'ollama': return 'bg-zinc-100 border-zinc-200 text-zinc-600'
    default: return 'bg-zinc-100 border-zinc-200 text-zinc-600'
  }
})

const statusColors = computed(() => {
  switch (props.model.lastTestStatus) {
    case 'untested': return 'bg-zinc-300'
    case 'testing': return 'bg-amber-400 animate-pulse'
    case 'success': return 'bg-emerald-400'
    case 'failed': return 'bg-red-400'
    default: return 'bg-zinc-300'
  }
})

const statusLabel = computed(() => {
  switch (props.model.lastTestStatus) {
    case 'untested': return '未测试'
    case 'testing': return '测试中'
    case 'success': return `通过 ${props.model.lastTestLatency ?? ''}ms`
    case 'failed': return '失败'
    default: return '未测试'
  }
})

function onPing() {
  if (props.model.lastTestStatus === 'testing') return
  emit('ping', props.model.id)
}
</script>

<template>
  <div class="bg-white rounded-xl border border-zinc-200 p-3 shadow-sm relative overflow-hidden group">
    <div v-if="model.isDefault" class="absolute left-0 top-0 bottom-0 w-1 bg-emerald-400" />

    <div class="flex items-center justify-between" :class="{ 'pl-2': model.isDefault }">
      <div class="flex items-center gap-2">
        <div
          class="w-7 h-7 rounded-lg border flex items-center justify-center shrink-0"
          :class="iconBg"
        >
          <component :is="providerIcon" class="w-4 h-4" />
        </div>

        <div class="min-w-0">
          <div class="text-[13px] font-medium flex items-center gap-1.5">
            <span class="truncate">{{ model.name }}</span>
            <span v-if="model.isDefault" class="text-[9px] px-1 bg-emerald-100 text-emerald-600 rounded font-semibold shrink-0">默认</span>
          </div>
          <div class="text-[11px] text-zinc-400 font-mono truncate">{{ model.modelId }}</div>
          <div v-if="model.baseUrl" class="text-[10px] text-zinc-300 font-mono truncate">{{ displayBaseUrl }}</div>
          <div class="text-[9px]">{{ providerLabel }}</div>
        </div>
      </div>

      <div class="flex items-center gap-1 shrink-0">
        <div
          class="w-2 h-2 rounded-full"
          :class="statusColors"
          :title="statusLabel"
        />

        <Switch
          :model-value="model.enabled"
          @update:model-value="emit('toggleEnabled', model.id, $event)"
        />

        <button
          class="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
          title="复制模型"
          @click="emit('duplicate', model.id)"
        >
          <Copy class="w-3.5 h-3.5" />
        </button>

        <button
          class="p-1.5 rounded-md text-zinc-400 hover:text-brand hover:bg-brand/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="model.lastTestStatus === 'testing'"
          title="Ping"
          @click="onPing"
        >
          <Activity class="w-3.5 h-3.5" />
        </button>

        <button
          class="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
          title="编辑"
          @click="emit('edit', model.id)"
        >
          <Settings class="w-3.5 h-3.5" />
        </button>

        <button
          class="p-1.5 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="删除"
          @click="emit('delete', model.id)"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>
