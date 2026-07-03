<script lang="ts" setup>
import { computed } from 'vue'
import Slider from '@/components/ui/Slider.vue'
import Switch from '@/components/ui/Switch.vue'
import { useSettingsStore } from '@/stores/settings.store'

const settingsStore = useSettingsStore()

const tokenLimit = computed({
  get: () => settingsStore.settings.context.maxContextTokens / 1000,
  set: (val: number) => {
    settingsStore.updateContextSettings({ maxContextTokens: val * 1000 })
  },
})

const includeMetadata = computed({
  get: () => settingsStore.settings.context.includeMetadataInPrompt,
  set: (val: boolean) => settingsStore.updateContextSettings({ includeMetadataInPrompt: val }),
})

const includeUrl = computed({
  get: () => settingsStore.settings.context.includeUrlInPrompt,
  set: (val: boolean) => settingsStore.updateContextSettings({ includeUrlInPrompt: val }),
})

const includeTitle = computed({
  get: () => settingsStore.settings.context.includeTitleInPrompt,
  set: (val: boolean) => settingsStore.updateContextSettings({ includeTitleInPrompt: val }),
})

const includeCapturedAt = computed({
  get: () => settingsStore.settings.context.includeCapturedAtInPrompt,
  set: (val: boolean) => settingsStore.updateContextSettings({ includeCapturedAtInPrompt: val }),
})

const includeHistory = computed({
  get: () => settingsStore.settings.context.includeConversationHistory,
  set: (val: boolean) => settingsStore.updateContextSettings({ includeConversationHistory: val }),
})

const maxHistory = computed({
  get: () => settingsStore.settings.context.maxHistoryMessages,
  set: (val: number) => settingsStore.updateContextSettings({ maxHistoryMessages: val }),
})
</script>

<template>
  <div class="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden text-[13px]">
    <!-- Token limit slider -->
    <div class="p-3 border-b border-zinc-100 flex flex-col gap-2">
      <div class="flex justify-between items-center">
        <span class="text-zinc-700">注入窗口大小限制</span>
        <span class="text-brand font-mono font-medium text-[12px]">{{ tokenLimit }}K Tokens</span>
      </div>
      <Slider v-model="tokenLimit" :min="4" :max="10500" :step="4" />
      <div class="flex justify-between text-[10px] text-zinc-400">
        <span>4K 快速</span>
        <span>1050K 深度</span>
      </div>
    </div>

    <!-- Metadata inclusion toggles -->
    <div class="p-3 border-b border-zinc-100 flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <span class="text-zinc-700">在 Prompt 中包含元数据</span>
        <Switch v-model="includeMetadata" />
      </div>
      <div class="flex items-center justify-between">
        <span class="text-zinc-600 text-[12px] ml-2">包含 URL</span>
        <Switch v-model="includeUrl" />
      </div>
      <div class="flex items-center justify-between">
        <span class="text-zinc-600 text-[12px] ml-2">包含标题</span>
        <Switch v-model="includeTitle" />
      </div>
      <div class="flex items-center justify-between">
        <span class="text-zinc-600 text-[12px] ml-2">包含捕获时间</span>
        <Switch v-model="includeCapturedAt" />
      </div>
    </div>

    <!-- Conversation history toggle -->
    <div class="p-3 flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="text-zinc-700">包含对话历史</span>
        <Switch v-model="includeHistory" />
      </div>
      <div v-if="includeHistory" class="flex items-center justify-between ml-2">
        <span class="text-zinc-600 text-[12px]">最大历史消息数</span>
        <input
          type="number"
          :value="maxHistory"
          min="1"
          max="100"
          class="w-16 h-7 text-center text-[12px] border border-zinc-200 rounded-md bg-zinc-50 px-1 focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/10 outline-none transition-all"
          @input="maxHistory = Number(($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>
  </div>
</template>
