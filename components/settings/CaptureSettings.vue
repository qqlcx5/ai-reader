<script lang="ts" setup>
import { computed } from 'vue'
import Switch from '@/components/ui/Switch.vue'
import { useSettingsStore } from '@/stores/settings.store'

const settingsStore = useSettingsStore()

const autoExtractOnOpen = computed({
  get: () => settingsStore.settings.capture.autoExtractOnOpen,
  set: (val: boolean) => settingsStore.updateCaptureSettings({ autoExtractOnOpen: val }),
})

const autoExtractOnTabChange = computed({
  get: () => settingsStore.settings.capture.autoExtractOnTabChange,
  set: (val: boolean) => settingsStore.updateCaptureSettings({ autoExtractOnTabChange: val }),
})

const preferCache = computed({
  get: () => settingsStore.settings.capture.preferCache,
  set: (val: boolean) => settingsStore.updateCaptureSettings({ preferCache: val }),
})
</script>

<template>
  <div class="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden text-[13px]">
    <div class="p-3 border-b border-zinc-100 flex items-center justify-between">
      <div class="flex flex-col gap-0.5">
        <span class="text-zinc-700">打开面板时自动抓取</span>
        <span class="text-[11px] text-zinc-400">Side Panel 打开时自动提取当前页面内容</span>
      </div>
      <Switch v-model="autoExtractOnOpen" />
    </div>
    <div class="p-3 border-b border-zinc-100 flex items-center justify-between">
      <div class="flex flex-col gap-0.5">
        <span class="text-zinc-700">切换标签时自动抓取</span>
        <span class="text-[11px] text-zinc-400">浏览器标签页切换时自动提取新页面</span>
      </div>
      <Switch v-model="autoExtractOnTabChange" />
    </div>
    <div class="p-3 flex items-center justify-between">
      <div class="flex flex-col gap-0.5">
        <span class="text-zinc-700">优先使用缓存</span>
        <span class="text-[11px] text-zinc-400">相同 URL 优先返回已缓存的抓取结果</span>
      </div>
      <Switch v-model="preferCache" />
    </div>
  </div>
</template>
