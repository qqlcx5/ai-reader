<template>
  <div class="space-y-4">
    <!-- Enable + status header -->
    <div class="flex items-center justify-between">
      <label class="flex items-center gap-2">
        <input
          v-model="syncStore.config.enabled"
          type="checkbox"
          class="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
        />
        <span class="text-sm text-surface-700 dark:text-surface-300">启用 WebDAV 同步</span>
      </label>
      <span
        v-if="syncStore.lastSyncAt"
        class="text-xs text-surface-500 dark:text-surface-400"
      >
        上次同步：{{ syncStore.lastSyncText }}
        <span v-if="syncStore.lastDirection === 'up'" class="ml-1">↑</span>
        <span v-else-if="syncStore.lastDirection === 'down'" class="ml-1">↓</span>
      </span>
    </div>

    <!-- URL -->
    <div>
      <label class="block text-sm text-surface-600 dark:text-surface-400 mb-1">
        WebDAV URL
      </label>
      <input
        v-model="syncStore.config.url"
        type="text"
        class="input"
        placeholder="https://example.com/dav/"
        autocomplete="off"
        spellcheck="false"
      />
    </div>

    <!-- Username / Password -->
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm text-surface-600 dark:text-surface-400 mb-1">用户名</label>
        <input
          v-model="syncStore.config.username"
          type="text"
          class="input"
          autocomplete="username"
        />
      </div>
      <div>
        <label class="block text-sm text-surface-600 dark:text-surface-400 mb-1">密码</label>
        <input
          v-model="syncStore.config.password"
          type="password"
          class="input"
          autocomplete="current-password"
        />
      </div>
    </div>

    <!-- Remote dir / interval -->
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm text-surface-600 dark:text-surface-400 mb-1">远端目录</label>
        <input
          v-model="syncStore.config.remoteDir"
          type="text"
          class="input"
          placeholder="AIReader_Backup"
        />
      </div>
      <div>
        <label class="block text-sm text-surface-600 dark:text-surface-400 mb-1">同步间隔（分钟）</label>
        <input
          v-model.number="syncStore.config.syncInterval"
          type="number"
          min="0"
          step="5"
          class="input"
          placeholder="30"
        />
        <p class="text-xs text-surface-400 mt-1">0 = 仅手动</p>
      </div>
    </div>

    <!-- Sync direction buttons -->
    <div class="flex flex-wrap gap-3 pt-2">
      <button
        @click="onTestConnection"
        :disabled="isTesting"
        class="px-4 py-2 rounded-lg border border-surface-300 dark:border-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors text-sm disabled:opacity-50"
      >
        {{ isTesting ? '测试中…' : '测试连接' }}
      </button>
      <button
        @click="onSyncUp"
        :disabled="!syncStore.canSync"
        class="px-4 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors text-sm disabled:opacity-50"
      >
        立即上传
      </button>
      <button
        @click="onSyncDown"
        :disabled="!syncStore.canSync"
        class="px-4 py-2 rounded-lg border border-surface-300 dark:border-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors text-sm disabled:opacity-50"
      >
        立即下载
      </button>
    </div>

    <!-- Status / progress -->
    <div v-if="syncStore.isSyncing" class="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400">
      <div class="animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full"></div>
      <span>{{ progressLabel }}</span>
    </div>
    <div
      v-if="testResult"
      class="text-sm"
      :class="testResult.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
    >
      {{ testResult.ok ? '连接成功' : testResult.error }}
    </div>
    <div
      v-if="syncStore.lastError && !syncStore.isSyncing"
      class="text-sm text-red-600 dark:text-red-400"
    >
      {{ syncStore.lastError }}
    </div>

    <!-- Divider + backup buttons (delegated to backup.service) -->
    <div class="flex flex-wrap gap-3 pt-4 border-t border-surface-200 dark:border-surface-700">
      <button
        @click="onExport"
        :disabled="isExporting"
        class="px-4 py-2 rounded-lg border border-surface-300 dark:border-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors text-sm disabled:opacity-50"
      >
        {{ isExporting ? '导出中…' : '导出备份' }}
      </button>
      <label
        class="px-4 py-2 rounded-lg border border-surface-300 dark:border-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors text-sm cursor-pointer"
      >
        导入备份
        <input
          ref="importInput"
          type="file"
          accept=".json,application/json"
          class="hidden"
          @change="onImport"
        />
      </label>
      <span
        v-if="exportMessage"
        class="text-sm self-center"
        :class="exportError ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'"
      >
        {{ exportMessage }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSyncStore } from '@/core/sync/store'
import {
  downloadBackup,
  uploadBackup,
  BackupVersionError,
  BackupValidationError,
} from '@/core/persistence/backup.service'
import { useSettingsStore } from '@/core/models/store'

const syncStore = useSyncStore()
const settingsStore = useSettingsStore()

const isTesting = ref(false)
const testResult = ref<{ ok: boolean; error?: string } | null>(null)

const isExporting = ref(false)
const importInput = ref<HTMLInputElement | null>(null)
const exportMessage = ref<string | null>(null)
const exportError = ref(false)

onMounted(async () => {
  await Promise.all([syncStore.loadConfig(), settingsStore.loadSettings()])
})

const progressLabel = computed(() => {
  const p = syncStore.progress
  if (!p) return syncStore.lastDirection === 'up' ? '上传中…' : '下载中…'
  switch (p.stage) {
    case 'reading':
      return '正在读取本地数据…'
    case 'packing':
      return '正在打包…'
    case 'uploading':
      return `上传中…${typeof p.percent === 'number' ? ` ${p.percent}%` : ''}`
    case 'downloading':
      return `下载中…${typeof p.percent === 'number' ? ` ${p.percent}%` : ''}`
    case 'done':
      return '完成'
    case 'error':
      return p.error ?? '出错'
    default:
      return ''
  }
})

async function onTestConnection() {
  isTesting.value = true
  testResult.value = null
  try {
    const result = await syncStore.testConnection()
    testResult.value = { ok: result.ok, error: result.error }
  } finally {
    isTesting.value = false
  }
}

async function onSyncUp() {
  testResult.value = null
  const res = await syncStore.syncUp()
  if (!res.ok) testResult.value = { ok: false, error: res.error }
  else testResult.value = { ok: true }
}

async function onSyncDown() {
  testResult.value = null
  const res = await syncStore.syncDown({
    confirmReplace: async () => {
      return window.confirm(
        '远端数据比本地新。继续下载将覆盖本地数据，是否先导出本地备份？\n（下载时会自动保留一份本地快照）'
      )
    },
  })
  if (!res.ok) testResult.value = { ok: false, error: res.error }
  else testResult.value = { ok: true }
}

async function onExport() {
  isExporting.value = true
  exportError.value = false
  exportMessage.value = null
  try {
    const bundle = await downloadBackup()
    exportMessage.value = `已导出（${bundle.documents.length} 文档 / ${bundle.chatHistories.length} 对话）`
  } catch (err) {
    exportError.value = true
    exportMessage.value = `导出失败：${err instanceof Error ? err.message : String(err)}`
  } finally {
    isExporting.value = false
    setTimeout(() => (exportMessage.value = null), 4000)
  }
}

async function onImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  isExporting.value = true
  exportError.value = false
  exportMessage.value = null
  try {
    const replace = window.confirm(
      '导入会覆盖当前数据。是否替换现有数据？\n（点"取消"则合并到现有数据中）'
    )
    const summary = await uploadBackup(file, { replace })
    exportMessage.value = `导入完成：${summary.documents} 文档 / ${summary.chats} 对话`
    await syncStore.loadConfig()
  } catch (err) {
    exportError.value = true
    if (err instanceof BackupVersionError) {
      exportMessage.value = `版本不兼容：${err.message}`
    } else if (err instanceof BackupValidationError) {
      exportMessage.value = `备份文件无效：${err.message}`
    } else {
      exportMessage.value = `导入失败：${err instanceof Error ? err.message : String(err)}`
    }
  } finally {
    isExporting.value = false
    if (importInput.value) importInput.value.value = ''
    setTimeout(() => (exportMessage.value = null), 5000)
  }
}
</script>
