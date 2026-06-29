<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { Cloud, Plug, RefreshCw, UploadCloud } from '@lucide/vue'
import UButton from '@/components/ui/UButton.vue'
import UInput from '@/components/ui/UInput.vue'
import Switch from '@/components/ui/Switch.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import { useSettingsStore } from '@/stores/settings.store'
import { useAppStore } from '@/stores/app.store'
import { refreshAfterDataChange } from '@/services/sync/refresh'
import { testConnection, runSync, forceUpload, getSyncState } from '@/services/sync/sync.service'

const settingsStore = useSettingsStore()
const appStore = useAppStore()

const testing = ref(false)
const syncing = ref(false)
const uploading = ref(false)
const showForceConfirm = ref(false)
const lastResult = ref('')
const lastSyncAt = ref('')
const busy = computed(() => testing.value || syncing.value || uploading.value)

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

async function onSync() {
  if (!url.value) {
    appStore.showToast('请先填写 WebDAV 地址', 'error')
    return
  }
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

      <UButton variant="dashed" size="md" class="w-full" :disabled="busy" @click="showForceConfirm = true">
        <UploadCloud class="w-3.5 h-3.5" />
        {{ uploading ? '上传中…' : '全量上传（覆盖远端）' }}
      </UButton>

      <ConfirmModal
        v-if="showForceConfirm"
        title="全量上传"
        desc="将用本地数据完全覆盖远端，远端独有的内容会被删除。建议仅在以本机为准时使用。"
        @confirm="onForceUpload"
        @cancel="showForceConfirm = false"
      />

      <div class="flex items-center justify-between pt-1 text-[11px]">
        <span class="text-zinc-400">上次同步：{{ fmt(lastSyncAt) }}</span>
        <span v-if="lastResult" class="text-zinc-500 font-mono">{{ lastResult }}</span>
      </div>

      <p class="text-[10px] text-zinc-400 leading-relaxed">
        三方合并（本地 / 远端 / 上次同步态），按更新时间 LWW；删除通过基线检测自动传播到对端。
      </p>
    </div>
  </div>
</template>
