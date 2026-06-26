<template>
  <div class="h-full overflow-y-auto p-4">
    <h2 class="text-lg font-semibold text-surface-800 dark:text-surface-100 mb-4">设置</h2>

    <!-- General Settings -->
    <section class="mb-6">
      <h3 class="text-sm font-medium text-surface-500 dark:text-surface-400 mb-3">通用</h3>
      <div class="space-y-3">
        <label class="flex items-center justify-between p-3 rounded-lg bg-surface-100 dark:bg-surface-800">
          <span class="text-sm text-surface-700 dark:text-surface-300">显示浮动按钮</span>
          <input
            v-model="settings.showFloatingButton"
            @change="saveSettings"
            type="checkbox"
            class="w-5 h-5 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
          />
        </label>

        <label class="flex items-center justify-between p-3 rounded-lg bg-surface-100 dark:bg-surface-800">
          <span class="text-sm text-surface-700 dark:text-surface-300">暗色模式</span>
          <select
            v-model="settings.theme"
            @change="saveSettings"
            class="px-3 py-1 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm"
          >
            <option value="auto">自动</option>
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
        </label>
      </div>
    </section>

    <!-- Storage Management -->
    <section class="mb-6">
      <h3 class="text-sm font-medium text-surface-500 dark:text-surface-400 mb-3">数据管理</h3>
      <div class="rounded-lg bg-surface-100 dark:bg-surface-800 p-3 space-y-3">
        <div class="grid grid-cols-3 gap-2 text-center">
          <div>
            <p class="text-2xl font-semibold text-surface-800 dark:text-surface-100">
              {{ storageStats.totalDocuments }}
            </p>
            <p class="text-xs text-surface-500 dark:text-surface-400">文档</p>
          </div>
          <div>
            <p class="text-2xl font-semibold text-surface-800 dark:text-surface-100">
              {{ storageStats.totalChats }}
            </p>
            <p class="text-xs text-surface-500 dark:text-surface-400">对话</p>
          </div>
          <div>
            <p class="text-2xl font-semibold text-surface-800 dark:text-surface-100">
              {{ storageStats.recentCount }}
            </p>
            <p class="text-xs text-surface-500 dark:text-surface-400">近 7 天</p>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            @click="onExport"
            :disabled="isExporting"
            class="px-3 py-1.5 text-sm rounded-lg border border-surface-300 dark:border-surface-600 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors disabled:opacity-50"
          >
            {{ isExporting ? '导出中…' : '导出 JSON' }}
          </button>
          <label
            class="px-3 py-1.5 text-sm rounded-lg border border-surface-300 dark:border-surface-600 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors cursor-pointer"
          >
            导入 JSON
            <input
              ref="importInput"
              type="file"
              accept=".json,application/json"
              class="hidden"
              @change="onImport"
            />
          </label>
        </div>

        <div
          v-if="storageMessage"
          class="text-xs"
          :class="storageError ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'"
        >
          {{ storageMessage }}
        </div>
      </div>
    </section>

    <!-- Danger zone -->
    <section class="mb-6">
      <h3 class="text-sm font-medium text-red-600 dark:text-red-400 mb-3">危险操作</h3>
      <div class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 space-y-2">
        <p class="text-xs text-surface-600 dark:text-surface-400">
          清空所有本地数据（文档 / 对话 / 设置）。操作不可撤销。
        </p>
        <button
          @click="onClearAll"
          :disabled="isClearing"
          class="px-3 py-1.5 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
        >
          {{ isClearing ? '清空中…' : '清空所有数据' }}
        </button>
      </div>
    </section>

    <!-- Model Settings -->
    <section class="mb-6">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-medium text-surface-500 dark:text-surface-400">模型配置</h3>
        <button
          @click="showAddModel = true"
          class="px-3 py-1 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          添加
        </button>
      </div>

      <div class="space-y-2">
        <div
          v-for="model in settingsStore.models"
          :key="model.id"
          class="p-3 rounded-lg bg-surface-100 dark:bg-surface-800"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium text-sm text-surface-800 dark:text-surface-100">{{ model.name }}</p>
              <p class="text-xs text-surface-500 dark:text-surface-400">{{ model.provider }} · {{ model.model }}</p>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="model.isDefault" class="px-2 py-1 text-xs rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">默认</span>
              <button
                @click="setDefault(model.id)"
                :disabled="model.isDefault"
                class="text-xs px-2 py-1 rounded border border-surface-300 dark:border-surface-600 hover:bg-surface-200 dark:hover:bg-surface-700 disabled:opacity-50"
              >
                设默认
              </button>
              <button
                @click="deleteModel(model.id)"
                class="text-xs px-2 py-1 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Add Model Modal -->
    <div v-if="showAddModel" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="w-full max-w-md bg-white dark:bg-surface-800 rounded-xl p-4 max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-semibold text-surface-800 dark:text-surface-100 mb-4">添加模型</h3>

        <div class="space-y-3">
          <div>
            <label class="block text-sm text-surface-600 dark:text-surface-400 mb-1">名称</label>
            <input v-model="newModel.name" type="text" class="input" placeholder="例如：我的 OpenAI" />
          </div>

          <div>
            <label class="block text-sm text-surface-600 dark:text-surface-400 mb-1">提供商</label>
            <select v-model="newModel.provider" class="input">
              <option v-for="provider in settingsStore.builtinProviders" :key="provider.id" :value="provider.id">
                {{ provider.name }}
              </option>
            </select>
          </div>

          <div>
            <label class="block text-sm text-surface-600 dark:text-surface-400 mb-1">模型</label>
            <input v-model="newModel.model" type="text" class="input" placeholder="例如：gpt-4o-mini" />
          </div>

          <div>
            <label class="block text-sm text-surface-600 dark:text-surface-400 mb-1">Base URL</label>
            <input v-model="newModel.baseUrl" type="text" class="input" placeholder="https://api.openai.com/v1" />
          </div>

          <div>
            <label class="block text-sm text-surface-600 dark:text-surface-400 mb-1">API Key</label>
            <input v-model="newModel.apiKey" type="password" class="input" placeholder="sk-..." />
          </div>

          <div>
            <label class="block text-sm text-surface-600 dark:text-surface-400 mb-1">Temperature</label>
            <input v-model.number="newModel.temperature" type="number" min="0" max="2" step="0.1" class="input" />
          </div>
        </div>

        <div class="flex justify-end gap-2 mt-6">
          <button @click="showAddModel = false" class="px-4 py-2 rounded-lg border border-surface-300 dark:border-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors">
            取消
          </button>
          <button @click="addModel" class="px-4 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors">
            保存
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useSettingsStore } from '@/core/models/store'
import { settingsService } from '@/core/persistence/settings.service'
import {
  downloadBackup,
  uploadBackup,
  BackupVersionError,
  BackupValidationError,
} from '@/core/persistence/backup.service'
import { getTimelineStats, type TimelineStats } from '@/core/persistence/timeline.aggregator'
import type { ModelConfig } from '@/shared/types'
import { generateId } from '@/shared/utils'
import { documentRepository } from '@core/documents/document.repository'
import { chatRepository } from '@core/chat/chat.repository'

const settingsStore = useSettingsStore()
const showAddModel = ref(false)

const settings = reactive({
  showFloatingButton: true,
  theme: 'auto' as 'light' | 'dark' | 'auto',
})

const newModel = reactive<Partial<ModelConfig>>({
  name: '',
  provider: 'openai',
  model: '',
  baseUrl: '',
  apiKey: '',
  temperature: 0.7,
  enabled: true,
})

const storageStats = ref<TimelineStats>({
  totalDocuments: 0,
  totalChats: 0,
  recentCount: 0,
  hottestDay: null,
  firstCapturedAt: 0,
  lastCapturedAt: 0,
})

const isExporting = ref(false)
const isClearing = ref(false)
const storageMessage = ref<string | null>(null)
const storageError = ref(false)
const importInput = ref<HTMLInputElement | null>(null)

const hasData = computed(
  () => storageStats.value.totalDocuments > 0 || storageStats.value.totalChats > 0
)

onMounted(async () => {
  await settingsStore.loadSettings()
  settings.showFloatingButton = settingsStore.settings.showFloatingButton
  settings.theme = settingsStore.settings.theme

  // Set default baseUrl based on provider
  const provider = settingsStore.builtinProviders.find(p => p.id === newModel.provider)
  if (provider) {
    newModel.baseUrl = provider.baseUrl
  }
  await refreshStats()
})

async function refreshStats() {
  try {
    storageStats.value = await getTimelineStats()
  } catch (err) {
    console.error('[SettingsPage] failed to load stats:', err)
  }
}

async function saveSettings() {
  await settingsStore.saveSettings({
    showFloatingButton: settings.showFloatingButton,
    theme: settings.theme,
  })
}

async function onExport() {
  isExporting.value = true
  storageError.value = false
  storageMessage.value = null
  try {
    const bundle = await downloadBackup()
    storageMessage.value = `已导出（${bundle.documents.length} 文档 / ${bundle.chatHistories.length} 对话）`
  } catch (err) {
    storageError.value = true
    storageMessage.value = err instanceof Error ? err.message : String(err)
  } finally {
    isExporting.value = false
    setTimeout(() => (storageMessage.value = null), 4000)
  }
}

async function onImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  isExporting.value = true
  storageError.value = false
  storageMessage.value = null
  try {
    const replace = window.confirm(
      '导入会覆盖当前数据。是否替换现有数据？\n（点"取消"则合并到现有数据中）'
    )
    const summary = await uploadBackup(file, { replace })
    storageMessage.value = `导入完成：${summary.documents} 文档 / ${summary.chats} 对话`
    await refreshStats()
  } catch (err) {
    storageError.value = true
    if (err instanceof BackupVersionError) {
      storageMessage.value = `版本不兼容：${err.message}`
    } else if (err instanceof BackupValidationError) {
      storageMessage.value = `备份文件无效：${err.message}`
    } else {
      storageMessage.value = err instanceof Error ? err.message : String(err)
    }
  } finally {
    isExporting.value = false
    if (importInput.value) importInput.value.value = ''
    setTimeout(() => (storageMessage.value = null), 5000)
  }
}

async function onClearAll() {
  if (!hasData.value) {
    storageMessage.value = '本地无数据'
    return
  }
  const ok = window.confirm(
    '确定要清空所有本地数据吗？此操作不可撤销。\n（建议先导出备份）'
  )
  if (!ok) return
  isClearing.value = true
  storageError.value = false
  storageMessage.value = null
  try {
    await Promise.all([
      documentRepository.clear(),
      chatRepository.clear(),
    ])
    await settingsService.reset()
    await settingsStore.loadSettings()
    await refreshStats()
    storageMessage.value = '已清空所有数据'
  } catch (err) {
    storageError.value = true
    storageMessage.value = err instanceof Error ? err.message : String(err)
  } finally {
    isClearing.value = false
    setTimeout(() => (storageMessage.value = null), 4000)
  }
}

async function addModel() {
  if (!newModel.name || !newModel.model || !newModel.baseUrl) return

  const model: ModelConfig = {
    id: generateId(),
    name: newModel.name,
    provider: newModel.provider || 'openai',
    model: newModel.model,
    baseUrl: newModel.baseUrl,
    apiKey: newModel.apiKey || '',
    enabled: true,
    temperature: newModel.temperature,
  }

  await settingsStore.addModel(model)
  showAddModel.value = false

  // Reset form
  newModel.name = ''
  newModel.model = ''
  newModel.apiKey = ''
  newModel.temperature = 0.7
}

async function setDefault(id: string) {
  await settingsStore.setDefaultModel(id)
}

async function deleteModel(id: string) {
  if (confirm('确定要删除这个模型配置吗？')) {
    await settingsStore.deleteModel(id)
  }
}
</script>
