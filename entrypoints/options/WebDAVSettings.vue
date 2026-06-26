<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSettingsStore } from '@/stores/settings.store';
import { useSyncStore } from '@/stores/sync.store';
import * as webdav from '@/core/sync/webdav-client';
import { syncUpload, syncDownload } from '@/core/sync/sync.service';
import { exportBackup, downloadBackup, importBackup } from '@/core/sync/backup-packager';
import type { WebDAVConfig } from '@/db/schema';

const settingsStore = useSettingsStore();
const syncStore = useSyncStore();

const config = ref<WebDAVConfig>({
  serverUrl: '',
  username: '',
  password: '',
  remotePath: '/ReadChat_Backup',
});
const showPassword = ref(false);
const testStatus = ref<'idle' | 'loading' | 'success' | 'error'>('idle');
const testError = ref('');

onMounted(async () => {
  await settingsStore.loadWebDAVConfig();
  if (settingsStore.webdavConfig) {
    config.value = { ...settingsStore.webdavConfig };
  }
});

async function handleSaveConfig() {
  await settingsStore.saveWebDAVConfig(config.value);
  alert('WebDAV 配置已保存');
}

async function handleTestConnection() {
  testStatus.value = 'loading';
  testError.value = '';
  try {
    const response = await webdav.propfind(
      { serverUrl: config.value.serverUrl, username: config.value.username, password: config.value.password },
      '/',
    );
    testStatus.value = response.ok ? 'success' : 'error';
    if (!response.ok) testError.value = `HTTP ${response.status}`;
  } catch (err) {
    testStatus.value = 'error';
    testError.value = String(err);
  }
}

async function handleUpload() {
  syncStore.setStatus('syncing');
  syncStore.setError(null);
  const result = await syncUpload({
    serverUrl: config.value.serverUrl,
    username: config.value.username,
    password: config.value.password,
  });
  if (result.success) {
    syncStore.setStatus('success');
    syncStore.setLastSyncAt(Date.now());
  } else {
    syncStore.setError(result.error || '上传失败');
  }
}

async function handleDownload() {
  if (!confirm('拉取将覆盖本地数据，建议先导出备份。是否继续？')) return;
  syncStore.setStatus('syncing');
  syncStore.setError(null);
  const result = await syncDownload({
    serverUrl: config.value.serverUrl,
    username: config.value.username,
    password: config.value.password,
  });
  if (result.success) {
    syncStore.setStatus('success');
    if (!result.localIsNewer) {
      syncStore.setLastSyncAt(Date.now());
      alert('拉取完成，本地数据已更新');
    } else {
      alert('本地已是最新');
    }
  } else {
    syncStore.setError(result.error || '拉取失败');
  }
}

async function handleExport() {
  const data = await exportBackup();
  downloadBackup(data);
}

async function handleImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (!confirm('导入将覆盖本地所有数据。建议先导出备份。是否继续？')) return;

    const text = await file.text();
    const result = await importBackup(text);
    if (result.success) {
      alert('导入成功');
    } else {
      alert(`导入失败: ${result.error}`);
    }
  };
  input.click();
}
</script>

<template>
  <div class="space-y-4">
    <!-- Export/Import -->
    <div class="card p-6">
      <h2 class="text-lg font-semibold text-slate-800 mb-4">本地备份</h2>
      <div class="flex gap-3">
        <button class="btn-primary" @click="handleExport">📤 导出备份</button>
        <button class="btn-secondary" @click="handleImport">📥 导入备份</button>
      </div>
    </div>

    <!-- WebDAV Config -->
    <div class="card p-6">
      <h2 class="text-lg font-semibold text-slate-800 mb-4">WebDAV 同步</h2>

      <div class="space-y-3">
        <div>
          <label class="text-sm text-slate-600 mb-1 block">服务器地址</label>
          <input v-model="config.serverUrl" class="input" placeholder="https://dav.example.com" />
        </div>
        <div>
          <label class="text-sm text-slate-600 mb-1 block">用户名</label>
          <input v-model="config.username" class="input" placeholder="user" />
        </div>
        <div>
          <label class="text-sm text-slate-600 mb-1 block">密码</label>
          <div class="relative">
            <input
              v-model="config.password"
              :type="showPassword ? 'text' : 'password'"
              class="input pr-10"
              placeholder="••••••"
            />
            <button
              class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? '🙈' : '👁️' }}
            </button>
          </div>
        </div>

        <div class="flex gap-2">
          <button class="btn-primary" @click="handleSaveConfig">保存配置</button>
          <button class="btn-secondary" @click="handleTestConnection">
            <span v-if="testStatus === 'loading'">⏳ 测试中...</span>
            <span v-else>🔗 测试连接</span>
          </button>
        </div>

        <div v-if="testStatus === 'success'" class="text-sm text-green-600">✓ 连接成功</div>
        <div v-if="testStatus === 'error'" class="text-sm text-red-600">✗ 连接失败: {{ testError }}</div>
      </div>
    </div>

    <!-- Sync Actions -->
    <div class="card p-6">
      <h2 class="text-lg font-semibold text-slate-800 mb-4">同步操作</h2>
      <div class="flex gap-3 items-center">
        <button class="btn-primary" :disabled="syncStore.status === 'syncing'" @click="handleUpload">
          ⬆️ 上传到云端
        </button>
        <button class="btn-secondary" :disabled="syncStore.status === 'syncing'" @click="handleDownload">
          ⬇️ 从云端拉取
        </button>
      </div>
      <div v-if="syncStore.status === 'syncing'" class="text-sm text-brand-600 mt-2">同步中...</div>
      <div v-if="syncStore.status === 'error'" class="text-sm text-red-600 mt-2">{{ syncStore.error }}</div>
      <div v-if="syncStore.lastSyncAt" class="text-xs text-slate-400 mt-2">
        上次同步: {{ new Date(syncStore.lastSyncAt).toLocaleString() }}
      </div>
    </div>
  </div>
</template>
