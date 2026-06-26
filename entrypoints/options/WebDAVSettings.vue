<template>
  <div class="space-y-4">
    <!-- Enable + status header -->
    <div class="flex items-center justify-between">
      <BaseSwitch
        v-model="syncStore.config.enabled"
        label="启用 WebDAV 同步"
      />
      <span
        v-if="syncStore.lastSyncAt"
        class="text-xs text-slate-500 dark:text-slate-400"
      >
        上次同步：{{ syncStore.lastSyncText }}
        <span v-if="syncStore.lastDirection === 'up'" class="ml-1">↑</span>
        <span v-else-if="syncStore.lastDirection === 'down'" class="ml-1">↓</span>
      </span>
    </div>

    <!-- URL -->
    <BaseInput
      v-model="syncStore.config.url"
      label="WebDAV URL"
      placeholder="https://example.com/dav/"
    />

    <!-- Username / Password -->
    <div class="grid grid-cols-2 gap-4">
      <BaseInput
        v-model="syncStore.config.username"
        label="用户名"
      />
      <BaseInput
        v-model="syncStore.config.password"
        label="密码"
        type="password"
      />
    </div>

    <!-- Remote dir / interval -->
    <div class="grid grid-cols-2 gap-4">
      <BaseInput
        v-model="syncStore.config.remoteDir"
        label="远端目录"
        placeholder="AIReader_Backup"
      />
      <div>
        <BaseInput
          v-model="syncIntervalStr"
          label="同步间隔（分钟）"
          type="number"
        />
        <p class="text-xs text-slate-400 mt-1">0 = 仅手动</p>
      </div>
    </div>

    <!-- Sync direction buttons -->
    <div class="flex flex-wrap gap-3 pt-2">
      <BaseButton
        variant="secondary"
        :loading="isTesting"
        :disabled="isTesting"
        @click="onTestConnection"
      >
        {{ isTesting ? '测试中…' : '测试连接' }}
      </BaseButton>
      <BaseButton
        variant="primary"
        :disabled="!syncStore.canSync"
        @click="onSyncUp"
      >
        立即上传
      </BaseButton>
      <BaseButton
        variant="secondary"
        :disabled="!syncStore.canSync"
        @click="onSyncDown"
      >
        立即下载
      </BaseButton>
    </div>

    <!-- Status / progress -->
    <div v-if="syncStore.isSyncing" class="flex items-center gap-2 text-sm text-brand-600 dark:text-brand-400">
      <div class="animate-spin w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full"></div>
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
    <div class="flex flex-wrap gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
      <BaseButton
        variant="secondary"
        :loading="isExporting"
        :disabled="isExporting"
        @click="onExport"
      >
        {{ isExporting ? '导出中…' : '导出备份' }}
      </BaseButton>
      <BaseButton
        variant="secondary"
        @click="importInput?.click()"
      >
        导入备份
      </BaseButton>
      <input
        ref="importInput"
        type="file"
        accept=".json,application/json"
        class="hidden"
        @change="onImport"
      />
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
import { BaseButton, BaseInput, BaseSwitch } from '@/components/ui'

const syncStore = useSyncStore()
const settingsStore = useSettingsStore()

const isTesting = ref(false)
const testResult = ref<{ ok: boolean; error?: string } | null>(null)

const isExporting = ref(false)
const importInput = ref<HTMLInputElement | null>(null)
const exportMessage = ref<string | null>(null)
const exportError = ref(false)

const syncIntervalStr = computed({
  get: () => String(syncStore.config.syncInterval ?? 30),
  set: (val: string) => {
    syncStore.config.syncInterval = parseInt(val) || 0
  },
})

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
