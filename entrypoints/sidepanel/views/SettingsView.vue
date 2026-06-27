<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RotateCcw, Cpu, Circle } from '@lucide/vue'
import { useSettings } from '../composables/useSettings'
import { useToast } from '../composables/useToast'
import { modelConfigRepo } from '@/db/model-config.repository'
import { settingsRepo, type ModelSettings } from '@/db/settings.repository'
import type { StoredProviderConfig, ModelConnectionStatus } from '@/shared/domain'
import ToggleSwitch from '../components/ToggleSwitch.vue'

const { settings, loadSettings, updateSetting, resetToDefaults } = useSettings()
const toast = useToast()

const activeConfig = ref<StoredProviderConfig | null>(null)
const connectionStatus = ref<ModelConnectionStatus | null>(null)
const modelSettings = ref<ModelSettings | null>(null)

onMounted(async () => {
  await loadSettings()
  await refreshModelSummary()
})

async function refreshModelSummary() {
  activeConfig.value = await modelConfigRepo.getConfig()
  connectionStatus.value = await modelConfigRepo.getConnectionStatus()
  modelSettings.value = await settingsRepo.getModelSettings()
}

async function handleReset() {
  resetToDefaults()
  toast.showInfo('已恢复默认设置')
}

async function openOptionsPage() {
  if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
    chrome.runtime.openOptionsPage()
  }
}
</script>

<template>
  <div class="p-4 space-y-6">
    <h2 class="text-sm font-semibold text-text">设置</h2>

    <!-- Model Config Summary -->
    <div class="rounded-2xl bg-card border border-gray-100 p-3 space-y-2">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Cpu class="w-4 h-4 text-blue" />
          <span class="text-xs font-semibold text-text">LLM 模型</span>
        </div>
        <button
          class="text-10px text-blue cursor-pointer bg-transparent border-0 underline"
          @click="openOptionsPage"
        >
          配置
        </button>
      </div>
      <div v-if="activeConfig" class="space-y-1">
        <div class="flex items-center justify-between text-11px">
          <span class="text-gray-400">Provider</span>
          <span class="text-text font-medium">{{ activeConfig.providerName }}</span>
        </div>
        <div class="flex items-center justify-between text-11px">
          <span class="text-gray-400">模型</span>
          <span class="text-text font-medium">{{ activeConfig.modelName }}</span>
        </div>
        <div class="flex items-center justify-between text-11px">
          <span class="text-gray-400">连接</span>
          <span
            class="inline-flex items-center gap-1 font-medium"
            :class="connectionStatus?.connected ? 'text-green-600' : 'text-red-500'"
          >
            <Circle
              class="w-1.5 h-1.5"
              :fill="connectionStatus?.connected ? 'currentColor' : 'currentColor'"
              :class="connectionStatus?.connected ? 'text-green-600' : 'text-red-500'"
            />
            {{ connectionStatus?.connected ? '正常' : connectionStatus ? '异常' : '未检测' }}
          </span>
        </div>
      </div>
      <div v-else class="text-11px text-gray-400">
        尚未配置模型，请前往 Options 页面设置。
      </div>
    </div>

    <div class="space-y-4">
      <div class="flex items-center justify-between py-2">
        <div>
          <p class="text-sm text-text">自动保存</p>
          <p class="text-10px text-gray-400">剪藏后自动保存到本地库</p>
        </div>
        <ToggleSwitch :model-value="settings.autoSave" label="自动保存" @update:model-value="(v: boolean) => updateSetting('autoSave', v)" />
      </div>
      <div class="flex items-center justify-between py-2">
        <div>
          <p class="text-sm text-text">显示通知</p>
          <p class="text-10px text-gray-400">操作完成后显示 Toast 通知</p>
        </div>
        <ToggleSwitch :model-value="settings.showToast" label="显示通知" @update:model-value="(v: boolean) => updateSetting('showToast', v)" />
      </div>
      <div class="flex items-center justify-between py-2">
        <div>
          <p class="text-sm text-text">包含 Frontmatter</p>
          <p class="text-10px text-gray-400">Markdown 开头包含 YAML 元数据</p>
        </div>
        <ToggleSwitch :model-value="settings.includeFrontmatter" label="包含 Frontmatter" @update:model-value="(v: boolean) => updateSetting('includeFrontmatter', v)" />
      </div>
      <div class="flex items-center justify-between py-2">
        <div>
          <p class="text-sm text-text">阅读器风格</p>
          <p class="text-10px text-gray-400">当前：{{ settings.readerStyle === 'light' ? '浅色' : settings.readerStyle === 'dark' ? '深色' : '护眼' }}</p>
        </div>
        <select
          :value="settings.readerStyle"
          aria-label="阅读器风格"
          class="text-xs rounded-lg border border-gray-200 px-2 py-1 bg-white outline-none cursor-pointer"
          @change="updateSetting('readerStyle', ($event.target as HTMLSelectElement).value as 'light' | 'dark' | 'sepia')"
        >
          <option value="light">浅色</option>
          <option value="dark">深色</option>
          <option value="sepia">护眼</option>
        </select>
      </div>
    </div>

    <button
      class="flex items-center gap-2 px-4 py-2 text-xs rounded-12px bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors border-0 cursor-pointer"
      @click="handleReset"
    >
      <RotateCcw class="w-3.5 h-3.5" />
      恢复默认设置
    </button>
  </div>
</template>
