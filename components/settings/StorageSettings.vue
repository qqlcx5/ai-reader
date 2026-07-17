<script lang="ts" setup>
import dayjs from 'dayjs'
import { ref, onMounted, computed } from 'vue'
import { HardDrive, Download, Upload, Database, FileText, MessageCircle, Cpu, RefreshCw, Trash2, AlertTriangle } from '@lucide/vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import { DocumentRepository } from '@/db/repositories/document.repository'
import { ChatRepository } from '@/db/repositories/chat.repository'
import { ModelRepository } from '@/db/repositories/model.repository'
import { initSearchIndex, searchIndex } from '@/services/search/index'
import { refreshAfterDataChange } from '@/services/sync/refresh'
import { useAppStore } from '@/stores/app.store'
import { db } from '@/db/index'
import { MetaRepository } from '@/db/repositories/meta.repository'

const docCount = ref(0)
const convCount = ref(0)
const modelCount = ref(0)
const storageUsage = ref('—')
const exporting = ref(false)
const importing = ref(false)
const showExportConfirm = ref(false)
const showClearConfirm = ref(false)
const showFinalClearConfirm = ref(false)
const rebuilding = ref(false)
const importInput = ref<HTMLInputElement | null>(null)
const appStore = useAppStore()

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
  return `auramind-backup-${dayjs().format('YYYY-MM-DD')}.json`
}

async function doExport() {
  showExportConfirm.value = false
  exporting.value = true
  try {
    const [documents, conversations, models, settings, collections, collectionItems, feeds, promptTemplates, webdavConfig, s3Config] = await Promise.all([
      DocumentRepository.findAll(),
      ChatRepository.findAll(),
      ModelRepository.findAll(),
      db.settings.toArray().then(arr => arr.filter(s => s.id === 'app-settings')),
      db.collections.toArray(),
      db.collectionItems.toArray(),
      db.feeds.toArray(),
      db.promptTemplates.toArray(),
      // WebDAV 配置存在 kvMeta 表（键 'webdav-config'）。只导出这一个键，
      // 不导出 'sync-state' —— 同步基线是设备本地的，跨设备恢复会破坏 LWW 三方合并。
      db.kvMeta.toArray().then(arr => arr.filter(e => e.id === 'webdav-config')),
      db.kvMeta.toArray().then(arr => arr.filter(e => e.id === 's3-config')),
    ])

    // 导出时脱敏：移除 raw 大字段，与 sync.service.ts 中的 stripRawFields 保持一致
    const strippedDocuments = documents.map(({ rawHtml, rawHtmlCompressed, ...rest }) => rest)

    const backup = {
      version: 1,
      exportedAt: dayjs().toISOString(),
      data: {
        documents: strippedDocuments,
        conversations,
        models,
        settings,
        collections,
        collectionItems,
        feeds,
        promptTemplates,
        webdavConfig,
        s3Config,
      },
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
    appStore.showToast('导出失败', 'error')
  } finally {
    exporting.value = false
  }
}

async function doImport(file: File) {
  importing.value = true
  try {
    const text = await file.text()
    let data = JSON.parse(text)

    // Auto-unwrap nested format (export & sync both use { version, ..., data: { ... } }).
    if (data && typeof data.data === 'object' && !Array.isArray(data.data)) {
      data = data.data
    }

    if (!data || typeof data !== 'object') throw new Error('Invalid JSON structure')
    if (!Array.isArray(data.documents)) throw new Error('Missing documents array')
    if (!Array.isArray(data.conversations)) throw new Error('Missing conversations array')
    if (!Array.isArray(data.models)) throw new Error('Missing models array')

    const collections = Array.isArray(data.collections) ? data.collections : []
    const collectionItems = Array.isArray(data.collectionItems) ? data.collectionItems : []
    const feeds = Array.isArray(data.feeds) ? data.feeds : []
    const promptTemplates = Array.isArray(data.promptTemplates) ? data.promptTemplates : []

    await db.transaction(
      'rw',
      [db.documents, db.conversations, db.models, db.settings, db.collections, db.collectionItems, db.feeds, db.promptTemplates],
      async () => {
        await Promise.all([
          db.documents.clear(),
          db.conversations.clear(),
          db.models.clear(),
          db.settings.clear(),
          db.collections.clear(),
          db.collectionItems.clear(),
          db.feeds.clear(),
          db.promptTemplates.clear(),
        ])

        if (data.documents.length > 0) await db.documents.bulkAdd(data.documents)
        if (data.conversations.length > 0) await db.conversations.bulkAdd(data.conversations)
        if (data.models.length > 0) await db.models.bulkAdd(data.models)
        if (data.settings?.length > 0) await db.settings.bulkAdd(data.settings)
        if (collections.length > 0) await db.collections.bulkAdd(collections)
        // collectionItems 采用 rebuild 策略，与 sync 侧保持一致
        await db.collectionItems.clear()
        if (collectionItems.length > 0) await db.collectionItems.bulkAdd(collectionItems)
        if (feeds.length > 0) await db.feeds.bulkAdd(feeds)
        if (promptTemplates.length > 0) await db.promptTemplates.bulkAdd(promptTemplates)
      },
    )

    // 恢复 WebDAV 配置（只覆盖这一个键，不动 sync-state）。refreshAfterDataChange
    // 会重新触发 loadSettings，让 WebDAV 设置面板的 UI 同步更新。
    // webdavConfig / s3Config are now KvMetaRow[] arrays, aligned with sync.service.ts sharedTable shape.
    for (const row of (data.webdavConfig ?? [])) {
      if (row && row.id && row.value !== undefined) {
        await MetaRepository.set(row.id, row.value)
      }
    }
    for (const row of (data.s3Config ?? [])) {
      if (row && row.id && row.value !== undefined) {
        await MetaRepository.set(row.id, row.value)
      }
    }

    await refreshStats()
    await refreshAfterDataChange()
    appStore.showToast('导入成功', 'success')
  } catch (e) {
    console.error('Import failed:', e)
    const msg = e instanceof Error ? e.message : '解析失败'
    appStore.showToast(`导入失败：${msg}`, 'error')
    throw e
  } finally {
    importing.value = false
  }
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // Reset so selecting the same file again still fires change.
  input.value = ''
  if (!file) return
  try {
    await doImport(file)
  } catch (e) {
    // toast already shown in doImport
  }
}

async function rebuildIndex() {
  rebuilding.value = true
  try {
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
    appStore.showToast(`已重建索引（${docs.length} 篇文档）`, 'success')
  } catch (e) {
    appStore.showToast('重建索引失败', 'error')
  } finally {
    rebuilding.value = false
  }
}

async function clearAll() {
  showFinalClearConfirm.value = false
  try {
    // Drop the actual Dexie database (named 'AuraMindDB'). db.delete() closes
    // the open connection first, then removes the DB; re-created empty on reload.
    await db.delete()
  } catch (e) {
    console.error('Failed to delete database:', e)
  }
  window.location.reload()
}

onMounted(refreshStats)
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- 存储概览：横向 4 格统计 -->
    <div class="grid grid-cols-2 gap-2">
      <div class="bg-white rounded-xl border border-zinc-200 shadow-sm p-3 flex flex-col gap-1">
        <div class="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <HardDrive class="w-3 h-3" />
          存储占用
        </div>
        <span class="font-mono text-[15px] font-semibold text-zinc-800">{{ storageUsage }}</span>
      </div>
      <div class="bg-white rounded-xl border border-zinc-200 shadow-sm p-3 flex flex-col gap-1">
        <div class="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <FileText class="w-3 h-3" />
          文档
        </div>
        <span class="font-mono text-[15px] font-semibold text-zinc-800">{{ docCount }}</span>
      </div>
      <div class="bg-white rounded-xl border border-zinc-200 shadow-sm p-3 flex flex-col gap-1">
        <div class="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <MessageCircle class="w-3 h-3" />
          对话
        </div>
        <span class="font-mono text-[15px] font-semibold text-zinc-800">{{ convCount }}</span>
      </div>
      <div class="bg-white rounded-xl border border-zinc-200 shadow-sm p-3 flex flex-col gap-1">
        <div class="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <Cpu class="w-3 h-3" />
          模型
        </div>
        <span class="font-mono text-[15px] font-semibold text-zinc-800">{{ modelCount }}</span>
      </div>
    </div>

    <!-- 数据备份 -->
    <div class="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
      <div class="px-3 py-2 border-b border-zinc-100 text-[11px] font-medium text-zinc-400">数据备份</div>
      <div class="p-2 flex gap-2">
        <button
          class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium transition-colors disabled:opacity-50 disabled:cursor-wait"
          :class="exporting ? 'bg-brand/20 text-brand' : 'text-brand bg-brand/10 hover:bg-brand/20'"
          :disabled="exporting || importing"
          @click="showExportConfirm = true"
        >
          <Download class="w-3.5 h-3.5" :class="{ 'animate-bounce': exporting }" />
          {{ exporting ? '导出中…' : '导出 JSON' }}
        </button>
        <button
          class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-wait"
          :disabled="exporting || importing"
          @click="importInput?.click()"
        >
          <Upload class="w-3.5 h-3.5" :class="{ 'animate-bounce': importing }" />
          {{ importing ? '导入中…' : '导入 JSON' }}
        </button>
      </div>
      <input
        ref="importInput"
        type="file"
        accept=".json"
        class="hidden"
        @change="handleFileChange"
      />
    </div>

    <!-- 维护 -->
    <div class="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
      <div class="px-3 py-2 border-b border-zinc-100 text-[11px] font-medium text-zinc-400">维护</div>
      <div class="p-2">
        <button
          class="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium transition-colors disabled:opacity-50 disabled:cursor-wait"
          :class="rebuilding ? 'bg-brand/10 text-brand' : 'text-zinc-600 bg-zinc-100 hover:bg-zinc-200'"
          :disabled="rebuilding"
          @click="rebuildIndex"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': rebuilding }" />
          {{ rebuilding ? '重建中…' : '重建搜索索引' }}
        </button>
      </div>
    </div>

    <!-- 危险操作 -->
    <div class="bg-red-50/40 rounded-xl border border-red-100">
      <div class="px-3 py-2 border-b border-red-100/60 text-[11px] font-medium text-red-400 flex items-center gap-1">
        <AlertTriangle class="w-3 h-3" />
        危险操作
      </div>
      <div class="p-2">
        <button
          class="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium text-red-500 bg-white border border-red-100 hover:bg-red-50 transition-colors"
          @click="showClearConfirm = true"
        >
          <Trash2 class="w-3.5 h-3.5" />
          清空本地数据
        </button>
      </div>
    </div>

    <!-- Export confirm -->
    <ConfirmModal
      v-if="showExportConfirm"
      title="导出备份"
      desc="备份文件将包含所有文档、对话、模型配置和设置数据。请注意：备份文件包含 API 密钥等敏感数据，请妥善保管。"
      confirm-text="导出"
      @confirm="doExport"
      @cancel="showExportConfirm = false"
    />

    <!-- Clear first confirm -->
    <ConfirmModal
      v-if="showClearConfirm"
      title="清空本地数据"
      desc="此操作将删除所有文档、对话和设置数据。此操作不可撤销！"
      confirm-text="继续"
      danger
      @confirm="showClearConfirm = false; showFinalClearConfirm = true"
      @cancel="showClearConfirm = false"
    />

    <!-- Clear final confirm -->
    <ConfirmModal
      v-if="showFinalClearConfirm"
      title="最终确认"
      desc="确定要永久删除所有本地数据吗？这包括全部文档、对话历史、模型配置和设置。确认后会刷新页面。"
      confirm-text="永久清空"
      danger
      @confirm="clearAll"
      @cancel="showFinalClearConfirm = false"
    />
  </div>
</template>
