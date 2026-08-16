<script lang="ts" setup>
import { computed } from 'vue'
import { AudioLines } from '@lucide/vue'
import UInput from '@/components/ui/UInput.vue'
import { useSettingsStore } from '@/stores/settings.store'

const settingsStore = useSettingsStore()

const baseUrl = computed({
  get: () => settingsStore.transcribe.baseUrl,
  set: (val: string) => settingsStore.updateTranscribeConfig({ baseUrl: val }),
})

const apiKey = computed({
  get: () => settingsStore.transcribe.apiKey,
  set: (val: string) => settingsStore.updateTranscribeConfig({ apiKey: val }),
})

const model = computed({
  get: () => settingsStore.transcribe.model,
  set: (val: string) => settingsStore.updateTranscribeConfig({ model: val }),
})
</script>

<template>
  <div class="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden text-[13px]">
    <div class="p-3 border-b border-zinc-100 flex items-center gap-2">
      <AudioLines class="w-4 h-4 text-zinc-400" />
      <span class="text-zinc-700">音频转写（Whisper 兼容）</span>
    </div>
    <div class="p-3 flex flex-col gap-2.5">
      <div class="flex flex-col gap-1">
        <span class="text-[11px] text-zinc-500">API 地址</span>
        <UInput v-model="baseUrl" placeholder="https://api.openai.com/v1" class="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-2 font-mono text-[12px] focus:border-brand" />
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-[11px] text-zinc-500">API Key</span>
        <UInput v-model="apiKey" type="password" placeholder="sk-..." class="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-2 font-mono text-[12px] focus:border-brand" />
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-[11px] text-zinc-500">模型</span>
        <UInput v-model="model" placeholder="whisper-1" class="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-2 font-mono text-[12px] focus:border-brand" />
      </div>
      <div class="text-[11px] text-zinc-400">
        兼容 OpenAI / Groq / SiliconFlow 等的 /audio/transcriptions 端点。入口：记忆库 →「导入音频」按钮，单文件 ≤ 25MB。
      </div>
    </div>
  </div>
</template>
