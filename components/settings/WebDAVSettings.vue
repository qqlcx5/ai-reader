<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { Cloud, Plug, RefreshCw, UploadCloud, DownloadCloud, RotateCcw } from '@lucide/vue'
import UButton from '@/components/ui/UButton.vue'
import UInput from '@/components/ui/UInput.vue'
import Switch from '@/components/ui/Switch.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import { useSettingsStore } from '@/stores/settings.store'
import { useAppStore } from '@/stores/app.store'
import { refreshAfterDataChange } from '@/services/sync/refresh'
import { testConnection, runSync, previewSync, forceUpload, forceDownload, restoreFromBackup, getSyncState } from '@/services/sync/sync.service'
import type { SyncPreview, SyncDeleteItem } from '@/types/sync'

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
const showRestoreConfirm = ref(false)
const preview = ref<SyncPreview | null>(null)
const lastResult = ref('')
const lastSyncAt = ref('')
const busy = computed(() => testing.value || syncing.value || uploading.value || downloading.value || restoring.value)

const url = computed({ get: () => settingsStore.webdav.url, set: (v) => settingsStore.updateWebDAVConfig({ url: v }) })
const username = computed({ get: () => settingsStore.webdav.username, set: (v) => settingsStore.updateWebDAVConfig({ username: v }) })
const password = computed({ get: () => settingsStore.webdav.password, set: (v) => settingsStore.updateWebDAVConfig({ password: v }) })
const basePath = computed({ get: () => settingsStore.webdav.basePath, set: (v) => settingsStore.updateWebDAVConfig({ basePath: v }) })
const enabled = computed({ get: () => settingsStore.webdav.enabled, set: (v) => settingsStore.updateWebDAVConfig({ enabled: v }) })

async function refreshStatus() {
  const st = await getSyncState()
  lastSyncAt.value = st?.lastSyncAt ?? ''
}

onMounted(refreshStatus)

async function onForceUpload() {
  showForceConfirm.value = false
  if (!url.value) {
    appStore.showToast('请先填写 WebDAV 地址', 'error')
    return
  }
  uploading.value = true
  try {
    await forceUpload(settingsStore.webdav)
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
  if (!url.value) {
    appStore.showToast('请先填写 WebDAV 地址', 'error')
    return
  }
  downloading.value = true
  try {
    await forceDownload(settingsStore.webdav)
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
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

async function onTest() {
  if (!url.value) {
    appStore.showToast('请先填写 WebDAV 地址', 'error')
    return
  }
  testing.value = true
  try {
    const r = await testConnection(settingsStore.webdav)
    appStore.showToast(r.ok ? '连接成功' : r.error ? `连接失败：${r.error}` : '连接失败', r.ok ? 'success' : 'error')
  } finally {
    testing.value = false
  }
}

function fmtItems(items: SyncDeleteItem[]): string {
  const labels = items.map((i) => i.label || i.id).slice(0, 5)
  const more = items.length - labels.length
  return labels.join('、') + (more > 0 ? ` 等 ${items.length} 项` : '')
}

const previewDesc = computed(() => {
  const p = preview.value
  if (!p) return ''
  const lines = [`拉取 ${p.pulled} · 推送 ${p.pushed} · 冲突 ${p.conflicts}`]
  if (p.deletedLocal) lines.push(`删除本地 ${p.deletedLocal} 条：${fmtItems(p.localDeleteItems)}`)
  if (p.deletedRemote) lines.push(`删除远端 ${p.deletedRemote} 条：${fmtItems(p.remoteDeleteItems)}`)
  if (p.abortReason) lines.push(`\n⚠️ ${p.abortReason}`)
  return lines.join('\n')
})

async function onSync() {
  if (!url.value) {
    appStore.showToast('请先填写 WebDAV 地址', 'error')
    return
  }
  syncing.value = true
  preview.value = null
  let p: SyncPreview
  try {
    p = await previewSync(settingsStore.webdav)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    appStore.showToast(`同步失败：${msg}`, 'error')
    syncing.value = false
    return
  }
  preview.value = p
  syncing.value = false
  // Nothing destructive → proceed immediately. Otherwise require confirmation.
  if (!p.abortReason && p.deletedLocal === 0 && p.deletedRemote === 0) {
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
    const r = await runSync(settingsStore.webdav)
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

async function onRestore() {
  showRestoreConfirm.value = false
  if (!url.value) {
    appStore.showToast('请先填写 WebDAV 地址', 'error')
    return
  }
  restoring.value = true
  try {
    await restoreFromBackup(settingsStore.webdav)
    await refreshAfterDataChange()
    await refreshStatus()
    appStore.showToast('已从备份恢复', 'success')
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
        WebDAV 同步
      </span>
      <Switch :model-value="enabled" @update:model-value="enabled = $event" />
    </div>

    <div class="p-3 space-y-2.5">
      <div>
        <label class="text-[11px] text-zinc-500 font-medium">服务器地址</label>
        <UInput
          v-model="url"
          placeholder="https://dav.example.com/"
          class="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3 font-mono text-[12px]"
        />
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[11px] text-zinc-500 font-medium">用户名</label>
          <UInput v-model="username" class="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3 text-[12px]" />
        </div>
        <div>
          <label class="text-[11px] text-zinc-500 font-medium">密码</label>
          <UInput
            v-model="password"
            type="password"
            class="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3 font-mono text-[12px]"
          />
        </div>
      </div>

      <div>
        <label class="text-[11px] text-zinc-500 font-medium">远程目录</label>
        <UInput
          v-model="basePath"
          placeholder="/auramind"
          class="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3 font-mono text-[12px]"
        />
      </div>

      <div class="flex items-center gap-2 pt-1">
        <UButton variant="secondary" size="md" class="flex-1" :disabled="busy" @click="onTest">
          <Plug class="w-3.5 h-3.5" />
          {{ testing ? '测试中…' : '测试连接' }}
        </UButton>
        <UButton variant="primary" size="md" class="flex-1" :disabled="busy" @click="onSync">
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': syncing }" />
          {{ syncing ? '同步中…' : '立即同步' }}
        </UButton>
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
        @click="showRestoreConfirm = true"
      >
        <RotateCcw class="w-3 h-3" />
        {{ restoring ? '恢复中…' : '从备份恢复' }}
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

      <ConfirmModal
        v-if="showSyncConfirm"
        title="确认同步"
        :desc="previewDesc"
        :confirm-text="preview?.abortReason ? '仍要同步' : '确认同步'"
        @confirm="doSync"
        @cancel="showSyncConfirm = false"
      />

      <ConfirmModal
        v-if="showRestoreConfirm"
        title="从备份恢复"
        desc="将用上一次同步前的远端备份（data.backup.json）覆盖本地与远端，仅保留最近一次备份。"
        confirm-text="恢复"
        @confirm="onRestore"
        @cancel="showRestoreConfirm = false"
      />

      <div class="flex items-center justify-between pt-1 text-[11px]">
        <span class="text-zinc-400">上次同步：{{ fmt(lastSyncAt) }}</span>
        <span v-if="lastResult" class="text-zinc-500 font-mono">{{ lastResult }}</span>
      </div>

      <p class="text-[10px] text-zinc-400 leading-relaxed">
        三方合并（本地 / 远端 / 上次同步态），按更新时间 LWW；删除通过基线检测传播。同步前若有删除会弹窗确认；单次删除超过 50% 自动中止；每次覆盖前自动备份上一次远端，可「从备份恢复」回滚。
      </p>
    </div>
  </div>
</template>
