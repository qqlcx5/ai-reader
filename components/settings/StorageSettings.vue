<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue'
import { HardDrive, Download, Upload, Database, FileText, MessageCircle, Cpu, RefreshCw, Trash2 } from '@lucide/vue'
import RekaButton from '@/components/ui/RekaButton.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import { DocumentRepository } from '@/db/repositories/document.repository'
import { ChatRepository } from '@/db/repositories/chat.repository'
import { ModelRepository } from '@/db/repositories/model.repository'
import { initSearchIndex, searchIndex } from '@/services/search/index'
import { db } from '@/db/index'

const docCount = ref(0)
const convCount = ref(0)
const modelCount = ref(0)
const storageUsage = ref('—')
const showExportConfirm = ref(false)
const showClearConfirm = ref(false)
const showFinalClearConfirm = ref(false)
const importInput = ref<HTMLInputElement | null>(null)

async function refreshStats() {
  try {
    docCount.value = await DocumentRepository.count()
  } catch {
    docCount.value = 0
  }
  try {
    const convs = await ChatRepository.findAll()
    convCount.value = convs.length
  } catch {
    convCount.value = 0
  }
  try {
    const models = await ModelRepository.findAll()
    modelCount.value = models.length
  } catch {
    modelCount.value = 0
  }
  try {
    const estimate = await navigator.storage?.estimate()
    if (estimate?.usage != null) {
      storageUsage.value = formatBytes(estimate.usage)
    }
  } catch {
    storageUsage.value = '—'
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${(bytes / 1073741824).toFixed(2)} GB`
}

function getBackupFilename(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `auramind-backup-${y}-${m}-${d}.json`
}

async function doExport() {
  showExportConfirm.value = false
  try {
    const [documents, conversations, models, settings] = await Promise.all([
      DocumentRepository.findAll(),
      ChatRepository.findAll(),
      ModelRepository.findAll(),
      db.settings.toArray(),
    ])

    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      documents,
      conversations,
      models,
      settings,
    }

    const json = JSON.stringify(backup, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = getBackupFilename()
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('Export failed:', e)
  }
}

async function doImport(file: File) {
  try {
    const text = await file.text()
    const data = JSON.parse(text)

    // Basic structure validation
    if (!data || typeof data !== 'object') throw new Error('Invalid JSON structure')
    if (!Array.isArray(data.documents)) throw new Error('Missing documents array')
    if (!Array.isArray(data.conversations)) throw new Error('Missing conversations array')
    if (!Array.isArray(data.models)) throw new Error('Missing models array')

    await db.transaction('rw', [db.documents, db.conversations, db.models, db.settings], async () => {
      await db.documents.clear()
      await db.conversations.clear()
      await db.models.clear()
      await db.settings.clear()

      if (data.documents.length > 0) await db.documents.bulkAdd(data.documents)
      if (data.conversations.length > 0) await db.conversations.bulkAdd(data.conversations)
      if (data.models.length > 0) await db.models.bulkAdd(data.models)
      if (data.settings?.length > 0) await db.settings.bulkAdd(data.settings)
    })

    await refreshStats()
  } catch (e) {
    console.error('Import failed:', e)
    throw e
  }
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  doImport(file)
}

async function rebuildIndex() {
  searchIndex.removeAll()
  const docs = await DocumentRepository.findAll()
  for (const doc of docs) {
    searchIndex.add({
      id: doc.id,
      title: doc.title || '',
      url: doc.url || '',
      siteName: doc.siteName || '',
      markdown: doc.markdown || '',
      excerpt: doc.excerpt || '',
    })
  }
}

async function clearAll() {
  showFinalClearConfirm.value = false
  try {
    await indexedDB.deleteDatabase('AuraMind')
  } catch (e) {
    console.error('Failed to delete database:', e)
  }
  window.location.reload()
}

onMounted(refreshStats)
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <div class="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden text-[13px]">
      <div class="p-3 border-b border-zinc-100 flex justify-between items-center">
        <span class="text-zinc-700 flex items-center gap-1.5">
          <HardDrive class="w-3.5 h-3.5 text-zinc-400" />
          IndexedDB 占用
        </span>
        <span class="font-mono text-[12px] text-zinc-500">{{ storageUsage }}</span>
      </div>
      <div class="p-3 border-b border-zinc-100 flex justify-between items-center">
        <span class="text-zinc-700 flex items-center gap-1.5">
          <FileText class="w-3.5 h-3.5 text-zinc-400" />
          文档数量
        </span>
        <span class="font-mono text-[12px] text-zinc-500">{{ docCount }}</span>
      </div>
      <div class="p-3 border-b border-zinc-100 flex justify-between items-center">
        <span class="text-zinc-700 flex items-center gap-1.5">
          <MessageCircle class="w-3.5 h-3.5 text-zinc-400" />
          对话数量
        </span>
        <span class="font-mono text-[12px] text-zinc-500">{{ convCount }}</span>
      </div>
      <div class="p-3 flex justify-between items-center">
        <span class="text-zinc-700 flex items-center gap-1.5">
          <Cpu class="w-3.5 h-3.5 text-zinc-400" />
          模型数量
        </span>
        <span class="font-mono text-[12px] text-zinc-500">{{ modelCount }}</span>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <RekaButton variant="secondary" size="lg" class="w-full" @click="showExportConfirm = true">
        <Download class="w-4 h-4" />
        导出 JSON
      </RekaButton>

      <RekaButton variant="secondary" size="lg" class="w-full" @click="importInput?.click()">
        <Upload class="w-4 h-4" />
        导入 JSON
      </RekaButton>
      <input
        ref="importInput"
        type="file"
        accept=".json"
        class="hidden"
        @change="handleFileChange"
      />

      <RekaButton variant="secondary" size="lg" class="w-full" @click="rebuildIndex">
        <RefreshCw class="w-4 h-4" />
        重建搜索索引
      </RekaButton>

      <RekaButton variant="danger" size="lg" class="w-full" @click="showClearConfirm = true">
        <Trash2 class="w-4 h-4" />
        清空本地数据
      </RekaButton>
    </div>

    <!-- Export confirm -->
    <ConfirmModal
      v-if="showExportConfirm"
      title="导出备份"
      desc="备份文件将包含所有文档、对话、模型配置和设置数据。请注意：备份文件包含 API 密钥等敏感数据，请妥善保管。"
      @confirm="doExport"
      @cancel="showExportConfirm = false"
    />

    <!-- Clear first confirm -->
    <ConfirmModal
      v-if="showClearConfirm"
      title="清空本地数据"
      desc="此操作将删除所有文档、对话和设置数据。此操作不可撤销！"
      @confirm="showClearConfirm = false; showFinalClearConfirm = true"
      @cancel="showClearConfirm = false"
    />

    <!-- Clear final confirm -->
    <ConfirmModal
      v-if="showFinalClearConfirm"
      title="最终确认"
      desc="确定要永久删除所有本地数据吗？这包括全部文档、对话历史、模型配置和设置。确认后会刷新页面。"
      @confirm="clearAll"
      @cancel="showFinalClearConfirm = false"
    />
  </div>
</template>
