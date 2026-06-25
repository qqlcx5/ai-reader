<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { getAppSettings, setAppSettings } from '@/db/dexie';
import { testWebdavConnection } from '@/core/sync/webdav.client';
import { exportBackup, importBackup } from '@/core/sync/backup.service';

interface SyncConfig {
  enabled: boolean;
  webdavUrl: string;
  webdavUsername: string;
  webdavPassword: string;
  webdavRemoteDir: string;
}

const config = ref<SyncConfig>({
  enabled: false,
  webdavUrl: '',
  webdavUsername: '',
  webdavPassword: '',
  webdavRemoteDir: 'readchat',
});
const testing = ref(false);
const testResult = ref<{ success: boolean; message: string } | null>(null);

onMounted(async () => {
  const settings = await getAppSettings();
  if (settings.webdavUrl) {
    config.value = {
      enabled: true,
      webdavUrl: settings.webdavUrl || '',
      webdavUsername: settings.webdavUsername || '',
      webdavPassword: settings.webdavPassword || '',
      webdavRemoteDir: settings.webdavRemoteDir || 'readchat',
    };
  }
});

async function save(): Promise<void> {
  await setAppSettings({
    webdavUrl: config.value.webdavUrl,
    webdavUsername: config.value.webdavUsername,
    webdavPassword: config.value.webdavPassword,
    webdavRemoteDir: config.value.webdavRemoteDir,
  });
  alert('同步设置已保存');
}

async function testConnection(): Promise<void> {
  testing.value = true;
  testResult.value = null;
  try {
    const result = await testWebdavConnection({
      webdavUrl: config.value.webdavUrl,
      webdavUsername: config.value.webdavUsername,
      webdavPassword: config.value.webdavPassword,
      webdavRemoteDir: config.value.webdavRemoteDir,
    });
    testResult.value = result;
  } finally {
    testing.value = false;
  }
}
</script>

<template>
  <div class="sync-card">
    <p class="hint">支持坚果云、Nextcloud、自建 WebDAV。详细配置说明见文档。</p>

    <div class="form">
      <label>
        <span>WebDAV URL *</span>
        <input v-model="config.webdavUrl" placeholder="https://dav.example.com" />
      </label>

      <label>
        <span>用户名</span>
        <input v-model="config.webdavUsername" placeholder="可选" />
      </label>

      <label>
        <span>密码 / Token</span>
        <input v-model="config.webdavPassword" type="password" />
      </label>

      <label>
        <span>远程目录</span>
        <input v-model="config.webdavRemoteDir" placeholder="readchat" />
      </label>
    </div>

    <div v-if="testResult" :class="['test-result', testResult.success ? 'ok' : 'err']">
      {{ testResult.message }}
    </div>

    <div class="actions">
      <button class="test-btn" :disabled="testing" @click="testConnection">
        {{ testing ? '测试中...' : '测试连接' }}
      </button>
      <button class="primary" @click="save">保存</button>
    </div>
  </div>
</template>

<style scoped>
.sync-card {
  background: var(--color-bg-secondary);
  border-radius: 8px;
  padding: 20px;
}
.hint {
  margin-bottom: 16px;
  font-size: 12px;
}
.form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
}
input {
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 13px;
}
input:focus {
  outline: none;
  border-color: var(--color-primary);
}
.test-result {
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  margin-bottom: 12px;
}
.test-result.ok {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}
.test-result.err {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}
.actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
button {
  padding: 6px 16px;
  background: var(--color-bg);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 4px;
}
button.primary {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
