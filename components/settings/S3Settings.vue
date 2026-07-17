<script lang="ts" setup>
import dayjs from 'dayjs'
import { ref, computed, onMounted } from 'vue'
import { Cloud, Plug, RefreshCw, UploadCloud, DownloadCloud, RotateCcw, ChevronDown, ChevronRight, AlertTriangle, ArrowDownCircle, ArrowUpCircle, Trash2, GitMerge } from '@lucide/vue'
import UButton from '@/components/ui/UButton.vue'
import UInput from '@/components/ui/UInput.vue'
import Switch from '@/components/ui/Switch.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import { useSettingsStore } from '@/stores/settings.store'
import { useAppStore } from '@/stores/app.store'
import { refreshAfterDataChange } from '@/services/sync/refresh'
import { testConnection, runSync, previewSync, forceUpload, forceDownload, listBackups, restoreFromSnapshot, getSyncState } from '@/services/sync/sync.service'
import { createS3Remote, normalizeBasePath } from '@/services/s3/s3.client'
import type { SyncPreview, SyncDeleteItem, SyncConflictItem, SyncChangeItem, BackupEntry, ConflictResolution } from '@/types/sync'

const settingsStore = useSettingsStore()
const appStore = useAppStore()

const testing = ref(false)
const syncing = ref(false)
const uploading = ref(false)
const downloading = ref(false)
const restoring = ref(false)
const showForceConfirm = ref(false)
const showDownloadConfirm = ref(false)
const showSyncConfirm = ref(false)
const showBackupsModal = ref(false)
const backups = ref<BackupEntry[]>([])
const selectedBackup = ref('')
const preview = ref<SyncPreview | null>(null)
const lastResult = ref('')
const lastSyncAt = ref('')
const resolution = ref<ConflictResolution>('lww')
const expandedSections = ref<Record<string, boolean>>({})
const busy = computed(() => testing.value || syncing.value || uploading.value || downloading.value || restoring.value)

const endpoint = computed({ get: () => settingsStore.s3.endpoint, set: (v) => settingsStore.updateS3Config({ endpoint: v }) })
const bucket = computed({ get: () => settingsStore.s3.bucket, set: (v) => settingsStore.updateS3Config({ bucket: v }) })
const region = computed({ get: () => settingsStore.s3.region, set: (v) => settingsStore.updateS3Config({ region: v }) })
const accessKeyId = computed({ get: () => settingsStore.s3.accessKeyId, set: (v) => settingsStore.updateS3Config({ accessKeyId: v }) })
const secretAccessKey = computed({ get: () => settingsStore.s3.secretAccessKey, set: (v) => settingsStore.updateS3Config({ secretAccessKey: v }) })
const basePath = computed({ get: () => settingsStore.s3.basePath, set: (v) => settingsStore.updateS3Config({ basePath: v }) })
const enabled = computed({ get: () => settingsStore.s3.enabled, set: (v) => settingsStore.updateS3Config({ enabled: v }) })
const forcePathStyle = computed({ get: () => settingsStore.s3.forcePathStyle, set: (v) => settingsStore.updateS3Config({ forcePathStyle: v }) })
const maxBackups = computed({
  get: () => settingsStore.s3.maxBackups ?? 10,
  set: (v: number) => settingsStore.updateS3Config({ maxBackups: v > 0 ? v : 10 }),
})

function getTransport() {
  const cfg = { ...settingsStore.s3, basePath: normalizeBasePath(settingsStore.s3.basePath) }
  return createS3Remote(cfg)
}

async function refreshStatus() {
  const st = await getSyncState()
  lastSyncAt.value = st?.lastSyncAt ?? ''
}

onMounted(refreshStatus)

async function onForceUpload() {
  showForceConfirm.value = false
  if (!endpoint.value || !bucket.value) {
    appStore.showToast('请先填写 S3 Endpoint 和 Bucket', 'error')
    return
  }
  uploading.value = true
  try {
    await forceUpload(getTransport())
    await refreshAfterDataChange()
    await refreshStatus()
    appStore.showToast('已全量上传到远端', 'success')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    appStore.showToast(`上传失败：${msg}`, 'error')
  } finally {
    uploading.value = false
  }
}

async function onForceDownload() {
  showDownloadConfirm.value = false
  if (!endpoint.value || !bucket.value) {
    appStore.showToast('请先填写 S3 Endpoint 和 Bucket', 'error')
    return
  }
  downloading.value = true
  try {
    await forceDownload(getTransport())
    await refreshAfterDataChange()
    await refreshStatus()
    appStore.showToast('已从远端全量下载', 'success')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    appStore.showToast(`下载失败：${msg}`, 'error')
  } finally {
    downloading.value = false
  }
}

function fmt(iso: string) {
  if (!iso) return '从未'
  try {
    return dayjs(iso).format('YYYY/M/D HH:mm:ss')
  } catch {
    return iso
  }
}

async function onTest() {
  if (!endpoint.value || !bucket.value) {
    appStore.showToast('请先填写 S3 Endpoint 和 Bucket', 'error')
    return
  }
  testing.value = true
  try {
    const r = await testConnection(getTransport())
    appStore.showToast(r.ok ? '连接成功' : r.error ? `连接失败：${r.error}` : '连接失败', r.ok ? 'success' : 'error')
  } finally {
    testing.value = false
  }
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    documents: '文档',
    conversations: '对话',
    models: '模型',
    collections: '收藏夹',
    collectionItems: '收藏项',
    settings: '设置',
    feeds: 'RSS源',
    promptTemplates: '提示词模板',
    webdavConfig: 'WebDAV配置',
    s3Config: 'S3配置',
  }
  return map[type] || type
}

function fmtVersion(iso: string): string {
  if (!iso) return '无'
  try {
    return dayjs(iso).format('YYYY/M/D HH:mm:ss')
  } catch {
    return iso
  }
}

function toggleSection(key: string) {
  expandedSections.value = { ...expandedSections.value, [key]: !expandedSections.value[key] }
}

function isExpanded(key: string): boolean {
  return !!expandedSections.value[key]
}

function resolutionLabel(r: ConflictResolution): string {
  return r === 'local' ? '偏向本地' : r === 'remote' ? '偏向云端' : '按时间(LWW)'
}

async function onPreview(res?: ConflictResolution) {
  if (!endpoint.value || !bucket.value) {
    appStore.showToast('请先填写 S3 Endpoint 和 Bucket', 'error')
    return
  }
  const r = res ?? resolution.value
  resolution.value = r
  syncing.value = true
  preview.value = null
  let p: SyncPreview
  try {
    p = await previewSync(getTransport(), r)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    appStore.showToast(`预览失败：${msg}`, 'error')
    syncing.value = false
    return
  }
  preview.value = p
  syncing.value = false
  showSyncConfirm.value = true
}

async function onDirectSync() {
  if (!endpoint.value || !bucket.value) {
    appStore.showToast('请先填写 S3 Endpoint 和 Bucket', 'error')
    return
  }
  syncing.value = true
  preview.value = null
  let p: SyncPreview
  try {
    p = await previewSync(getTransport(), resolution.value)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    appStore.showToast(`同步失败：${msg}`, 'error')
    syncing.value = false
    return
  }
  preview.value = p
  syncing.value = false
  if (!p.abortReason && p.deletedLocal === 0 && p.deletedRemote === 0 && p.conflicts === 0) {
    await doSync()
  } else {
    showSyncConfirm.value = true
  }
}

async function doSync() {
  showSyncConfirm.value = false
  syncing.value = true
  lastResult.value = ''
  try {
    const r = await runSync(getTransport(), settingsStore.s3.maxBackups ?? 10, resolution.value)
    await refreshAfterDataChange()
    await refreshStatus()
    lastResult.value = `↑${r.pushed} ↓${r.pulled} · 本地删${r.deletedLocal} · 远端删${r.deletedRemote}${r.conflicts ? ` · 冲突${r.conflicts}` : ''}`
    appStore.showToast('同步完成', 'success')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    appStore.showToast(`同步失败：${msg}`, 'error')
  } finally {
    syncing.value = false
  }
}

async function onShowBackups() {
  if (!endpoint.value || !bucket.value) {
    appStore.showToast('请先填写 S3 Endpoint 和 Bucket', 'error')
    return
  }
  restoring.value = true
  try {
    const list = await listBackups(getTransport())
    backups.value = list
    selectedBackup.value = list[0]?.name ?? ''
    showBackupsModal.value = true
    if (list.length === 0) appStore.showToast('没有可用的备份', 'info')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    appStore.showToast(`读取备份失败：${msg}`, 'error')
  } finally {
    restoring.value = false
  }
}

async function onRestore() {
  if (!selectedBackup.value) return
  const name = selectedBackup.value
  showBackupsModal.value = false
  restoring.value = true
  try {
    await restoreFromSnapshot(getTransport(), name)
    await refreshAfterDataChange()
    await refreshStatus()
    appStore.showToast(`已从备份恢复（${name}）`, 'success')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    appStore.showToast(`恢复失败：${msg}`, 'error')
  } finally {
    restoring.value = false
  }
}
</script>

<template>
  <div class="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden text-[13px]">
    <div class="p-3 border-b border-zinc-100 flex items-center justify-between">
      <span class="text-zinc-700 flex items-center gap-1.5">
        <Cloud class="w-3.5 h-3.5 text-zinc-400" />
        S3 同步
      </span>
      <Switch :model-value="enabled" @update:model-value="enabled = $event" />
    </div>

    <div class="p-3 space-y-2.5">
      <div>
        <label class="text-[11px] text-zinc-500 font-medium">Endpoint</label>
        <UInput
          v-model="endpoint"
          placeholder="https://s3.amazonaws.com"
          class="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3 font-mono text-[12px]"
        />
      </div>

      <div>
        <label class="text-[11px] text-zinc-500 font-medium">Bucket</label>
        <UInput
          v-model="bucket"
          placeholder="my-bucket"
          class="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3 font-mono text-[12px]"
        />
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[11px] text-zinc-500 font-medium">Region</label>
          <UInput v-model="region" placeholder="us-east-1" class="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3 text-[12px]" />
        </div>
        <div>
          <label class="text-[11px] text-zinc-500 font-medium">Path Style</label>
          <div class="mt-1.5">
            <Switch :model-value="forcePathStyle" @update:model-value="forcePathStyle = $event" />
            <span class="ml-1.5 text-[11px] text-zinc-400">MinIO / 非 AWS 端点</span>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[11px] text-zinc-500 font-medium">Access Key ID</label>
          <UInput v-model="accessKeyId" class="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3 font-mono text-[12px]" />
        </div>
        <div>
          <label class="text-[11px] text-zinc-500 font-medium">Secret Access Key</label>
          <UInput
            v-model="secretAccessKey"
            type="password"
            class="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3 font-mono text-[12px]"
          />
        </div>
      </div>

      <div>
        <label class="text-[11px] text-zinc-500 font-medium">远程目录 (Key 前缀)</label>
        <UInput
          v-model="basePath"
          placeholder="/auramind"
          class="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3 font-mono text-[12px]"
        />
      </div>

      <div>
        <label class="text-[11px] text-zinc-500 font-medium">备份保留份数</label>
        <UInput
          :model-value="String(maxBackups)"
          type="number"
          class="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3 font-mono text-[12px]"
          @update:model-value="(v) => (maxBackups = Number(v))"
        />
      </div>

      <div class="flex items-center gap-2 pt-1">
        <UButton variant="secondary" size="md" class="flex-1" :disabled="busy" @click="onTest">
          <Plug class="w-3.5 h-3.5" />
          {{ testing ? '测试中…' : '测试连接' }}
        </UButton>
        <UButton variant="primary" size="md" class="flex-1" :disabled="busy" @click="onDirectSync">
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': syncing }" />
          {{ syncing ? '同步中…' : '立即同步' }}
        </UButton>
      </div>

      <!-- Conflict resolution selector -->
      <div class="flex items-center gap-1.5 text-[11px]">
        <span class="text-zinc-400 shrink-0">冲突策略：</span>
        <label
          v-for="opt in [
            { value: 'lww' as ConflictResolution, label: '按时间' },
            { value: 'local' as ConflictResolution, label: '偏向本地' },
            { value: 'remote' as ConflictResolution, label: '偏向云端' },
          ]"
          :key="opt.value"
          class="px-2 py-0.5 rounded cursor-pointer border transition-colors"
          :class="resolution === opt.value ? 'bg-brand/10 border-brand/30 text-brand' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'"
          @click="resolution = opt.value"
        >
          {{ opt.label }}
        </label>
      </div>

      <div class="flex items-center gap-2">
        <UButton variant="dashed" size="md" class="flex-1" :disabled="busy" @click="showForceConfirm = true">
          <UploadCloud class="w-3.5 h-3.5" />
          {{ uploading ? '上传中…' : '全量上传' }}
        </UButton>
        <UButton variant="dashed" size="md" class="flex-1" :disabled="busy" @click="showDownloadConfirm = true">
          <DownloadCloud class="w-3.5 h-3.5" />
          {{ downloading ? '下载中…' : '全量下载' }}
        </UButton>
      </div>

      <button
        class="mx-auto text-[11px] text-zinc-400 hover:text-brand flex items-center gap-1 disabled:opacity-50"
        :disabled="busy"
        @click="onShowBackups"
      >
        <RotateCcw class="w-3 h-3" />
        {{ restoring ? '读取中…' : '从备份恢复' }}
      </button>

      <ConfirmModal
        v-if="showForceConfirm"
        title="全量上传"
        desc="将用本地数据完全覆盖远端，远端独有的内容会被删除。建议仅在以本机为准时使用。"
        confirm-text="上传"
        @confirm="onForceUpload"
        @cancel="showForceConfirm = false"
      />

      <ConfirmModal
        v-if="showDownloadConfirm"
        title="全量下载"
        desc="将用远端数据完全覆盖本地，本地独有的内容会被删除。建议仅在以远端为准时使用。"
        confirm-text="下载"
        @confirm="onForceDownload"
        @cancel="showDownloadConfirm = false"
      />

      <!-- ========== Detailed Sync Preview Modal ========== -->
      <div
        v-if="showSyncConfirm"
        class="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4"
        @click.self="showSyncConfirm = false"
      >
        <div class="bg-white rounded-xl border border-zinc-200 shadow-2xl w-full max-w-[520px] max-h-[85vh] flex flex-col text-[13px]">
          <div class="shrink-0 border-b border-zinc-100 p-4">
            <h3 class="text-[15px] font-semibold flex items-center gap-2">
              <RefreshCw class="w-4 h-4 text-brand" />
              同步预览
            </h3>
            <div class="text-[11px] text-zinc-400 mt-0.5">
              策略：<span class="text-zinc-600 font-medium">{{ resolutionLabel(resolution) }}</span>
              &nbsp;·&nbsp;本地 {{ preview?.localTotal }} 条 &nbsp;·&nbsp;远端 {{ preview?.remoteTotal }} 条
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-4 space-y-3">
            <div v-if="preview?.abortReason" class="bg-red-50 border border-red-200 rounded-lg p-3 text-[12px] text-red-700">
              <AlertTriangle class="w-3.5 h-3.5 inline mr-1" />{{ preview!.abortReason }}
            </div>

            <div class="flex flex-wrap gap-1.5 text-[12px]">
              <span v-if="preview?.pulled" class="px-2 py-0.5 rounded bg-brand/10 text-brand flex items-center gap-1">
                <ArrowDownCircle class="w-3 h-3" />拉取 {{ preview?.pulled }}
              </span>
              <span v-if="preview?.pushed" class="px-2 py-0.5 rounded bg-green-50 text-green-700 flex items-center gap-1">
                <ArrowUpCircle class="w-3 h-3" />推送 {{ preview?.pushed }}
              </span>
              <span v-if="preview?.conflicts" class="px-2 py-0.5 rounded bg-orange-50 text-orange-700 flex items-center gap-1">
                <GitMerge class="w-3 h-3" />冲突 {{ preview?.conflicts }}
              </span>
              <span v-if="preview?.deletedLocal" class="px-2 py-0.5 rounded bg-red-50 text-red-700 flex items-center gap-1">
                <Trash2 class="w-3 h-3" />删本地 {{ preview?.deletedLocal }}
              </span>
              <span v-if="preview?.deletedRemote" class="px-2 py-0.5 rounded bg-red-50 text-red-700 flex items-center gap-1">
                <Trash2 class="w-3 h-3" />删远端 {{ preview?.deletedRemote }}
              </span>
              <span v-if="!preview?.pulled && !preview?.pushed && !preview?.deletedLocal && !preview?.deletedRemote"
                class="text-zinc-400 text-[12px]">无变更，已是最新状态</span>
            </div>

            <!-- Pull items -->
            <div v-if="preview?.pullItems?.length" class="border border-brand/10 rounded-lg overflow-hidden">
              <button class="w-full flex items-center justify-between p-2.5 bg-brand/10 hover:bg-brand/20 transition-colors text-left" @click="toggleSection('pulls')">
                <span class="text-[12px] font-medium text-brand flex items-center gap-1">
                  <ArrowDownCircle class="w-3 h-3" />将拉取 {{ preview!.pullItems.length }} 项
                </span>
                <ChevronDown v-if="isExpanded('pulls')" class="w-3.5 h-3.5 text-brand" />
                <ChevronRight v-else class="w-3.5 h-3.5 text-brand" />
              </button>
              <div v-show="isExpanded('pulls')" class="divide-y divide-brand/5 max-h-48 overflow-y-auto">
                <div v-for="item in preview!.pullItems" :key="item.id" class="py-1.5 px-2.5 text-[12px] text-zinc-600">
                  <span class="text-zinc-400 font-mono text-[10px]">{{ typeLabel(item.type) }}</span>
                  <span class="ml-1.5">{{ item.label || item.id }}</span>
                </div>
              </div>
            </div>

            <!-- Push items -->
            <div v-if="preview?.pushItems?.length" class="border border-green-100 rounded-lg overflow-hidden">
              <button class="w-full flex items-center justify-between p-2.5 bg-green-50 hover:bg-green-100 transition-colors text-left" @click="toggleSection('pushes')">
                <span class="text-[12px] font-medium text-green-700 flex items-center gap-1">
                  <ArrowUpCircle class="w-3 h-3" />将推送 {{ preview!.pushItems.length }} 项
                </span>
                <ChevronDown v-if="isExpanded('pushes')" class="w-3.5 h-3.5 text-green-500" />
                <ChevronRight v-else class="w-3.5 h-3.5 text-green-500" />
              </button>
              <div v-show="isExpanded('pushes')" class="divide-y divide-green-50 max-h-48 overflow-y-auto">
                <div v-for="item in preview!.pushItems" :key="item.id" class="py-1.5 px-2.5 text-[12px] text-zinc-600">
                  <span class="text-zinc-400 font-mono text-[10px]">{{ typeLabel(item.type) }}</span>
                  <span class="ml-1.5">{{ item.label || item.id }}</span>
                </div>
              </div>
            </div>

            <!-- Conflict items -->
            <div v-if="preview?.conflictItems?.length" class="border border-orange-200 rounded-lg overflow-hidden">
              <button class="w-full flex items-center justify-between p-2.5 bg-orange-50 hover:bg-orange-100 transition-colors text-left" @click="toggleSection('conflicts')">
                <span class="text-[12px] font-medium text-orange-700 flex items-center gap-1">
                  <GitMerge class="w-3 h-3" />冲突 {{ preview!.conflictItems.length }} 项
                </span>
                <ChevronDown v-if="isExpanded('conflicts')" class="w-3.5 h-3.5 text-orange-500" />
                <ChevronRight v-else class="w-3.5 h-3.5 text-orange-500" />
              </button>
              <div v-show="isExpanded('conflicts')" class="divide-y divide-orange-100 max-h-60 overflow-y-auto">
                <div v-for="c in preview!.conflictItems" :key="c.id" class="py-2 px-2.5 text-[12px]">
                  <div class="flex items-center gap-1.5">
                    <span class="text-zinc-400 font-mono text-[10px]">{{ typeLabel(c.type) }}</span>
                    <span class="font-medium text-zinc-700">{{ c.label || c.id }}</span>
                  </div>
                  <div class="mt-0.5 text-[11px] text-zinc-400 flex items-center gap-2">
                    <span>本地：{{ fmtVersion(c.localVersion) }}</span>
                    <span>云端：{{ fmtVersion(c.remoteVersion) }}</span>
                  </div>
                  <div class="mt-0.5">
                    <span :class="c.chosen === 'local' ? 'text-green-600 bg-green-50' : 'text-brand bg-brand/10'"
                      class="text-[10px] font-medium px-1.5 py-0.5 rounded">
                      采用{{ c.chosen === 'local' ? '本地' : '云端' }}版本
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Local deletes -->
            <div v-if="preview?.localDeleteItems?.length" class="border border-red-200 rounded-lg overflow-hidden">
              <button class="w-full flex items-center justify-between p-2.5 bg-red-50 hover:bg-red-100 transition-colors text-left" @click="toggleSection('localDeletes')">
                <span class="text-[12px] font-medium text-red-700 flex items-center gap-1">
                  <Trash2 class="w-3 h-3" />删除本地 {{ preview!.localDeleteItems.length }} 条
                </span>
                <ChevronDown v-if="isExpanded('localDeletes')" class="w-3.5 h-3.5 text-red-500" />
                <ChevronRight v-else class="w-3.5 h-3.5 text-red-500" />
              </button>
              <div v-show="isExpanded('localDeletes')" class="divide-y divide-red-100 max-h-48 overflow-y-auto">
                <div v-for="item in preview!.localDeleteItems" :key="item.id" class="py-1.5 px-2.5 text-[12px] text-zinc-600">
                  <span class="text-zinc-400 font-mono text-[10px]">{{ typeLabel(item.type) }}</span>
                  <span class="ml-1.5">{{ item.label || item.id }}</span>
                </div>
              </div>
            </div>

            <!-- Remote deletes -->
            <div v-if="preview?.remoteDeleteItems?.length" class="border border-red-200 rounded-lg overflow-hidden">
              <button class="w-full flex items-center justify-between p-2.5 bg-red-50 hover:bg-red-100 transition-colors text-left" @click="toggleSection('remoteDeletes')">
                <span class="text-[12px] font-medium text-red-700 flex items-center gap-1">
                  <Trash2 class="w-3 h-3" />删除远端 {{ preview!.remoteDeleteItems.length }} 条
                </span>
                <ChevronDown v-if="isExpanded('remoteDeletes')" class="w-3.5 h-3.5 text-red-500" />
                <ChevronRight v-else class="w-3.5 h-3.5 text-red-500" />
              </button>
              <div v-show="isExpanded('remoteDeletes')" class="divide-y divide-red-100 max-h-48 overflow-y-auto">
                <div v-for="item in preview!.remoteDeleteItems" :key="item.id" class="py-1.5 px-2.5 text-[12px] text-zinc-600">
                  <span class="text-zinc-400 font-mono text-[10px]">{{ typeLabel(item.type) }}</span>
                  <span class="ml-1.5">{{ item.label || item.id }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="shrink-0 border-t border-zinc-100 p-3 flex gap-2">
            <UButton variant="secondary" size="md" class="flex-1" @click="onPreview('local')">偏向本地重算</UButton>
            <UButton variant="secondary" size="md" class="flex-1" @click="onPreview('remote')">偏向云端重算</UButton>
            <UButton variant="primary" size="md" class="flex-1" :disabled="!!preview?.abortReason" @click="doSync">确认同步</UButton>
          </div>
        </div>
      </div>

      <div
        v-if="showBackupsModal"
        class="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4"
        @click.self="showBackupsModal = false"
      >
        <div class="bg-white rounded-xl border border-zinc-200 shadow-2xl w-full max-w-[320px] p-3 text-[13px]">
          <h3 class="text-[14px] font-semibold mb-2">选择要恢复的备份</h3>
          <div v-if="backups.length === 0" class="text-zinc-400 py-4 text-center text-[12px]">
            没有可用的备份快照
          </div>
          <ul v-else class="max-h-60 overflow-y-auto -mx-1">
            <li
              v-for="b in backups"
              :key="b.name"
              class="mx-1 my-0.5 px-2.5 py-2 rounded-lg cursor-pointer flex items-center justify-between transition-colors"
              :class="selectedBackup === b.name ? 'bg-brand/10 text-brand' : 'hover:bg-zinc-100 text-zinc-700'"
              @click="selectedBackup = b.name"
            >
              <span>{{ b.ts ? dayjs(b.ts).format('YYYY/M/D HH:mm:ss') : b.name }}</span>
              <span class="text-[10px] opacity-50">{{ selectedBackup === b.name ? '✓' : '' }}</span>
            </li>
          </ul>
          <div class="flex gap-2 mt-3">
            <UButton variant="secondary" size="md" class="flex-1" @click="showBackupsModal = false">取消</UButton>
            <UButton variant="primary" size="md" class="flex-1" :disabled="!selectedBackup" @click="onRestore">恢复</UButton>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between pt-1 text-[11px]">
        <span class="text-zinc-400">上次同步：{{ fmt(lastSyncAt) }}</span>
        <span v-if="lastResult" class="text-zinc-500 font-mono">{{ lastResult }}</span>
      </div>

      <p class="text-[10px] text-zinc-400 leading-relaxed">
        三方合并（本地 / 远端 / 上次同步态），默认按更新时间 LWW；冲突时可选偏向本地或云端；删除通过基线检测传播；单次删除超 50% 自动中止；每次覆盖前自动备份。
      </p>
    </div>
  </div>
</template>
