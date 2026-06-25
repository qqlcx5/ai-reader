<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';
import dayjs from 'dayjs';
import { getAppSettings, setAppSettings, getLastSyncAt } from '@/db/dexie';
import { testWebdavConnection } from '@/core/sync/webdav.client';
import { uploadToWebdav, downloadFromWebdav } from '@/core/sync/backup.service';
import { useDocumentsStore } from '@/stores/documents';
import { useModelsStore } from '@/stores/models';

const documentsStore = useDocumentsStore();
const modelsStore = useModelsStore();

interface SyncConfig {
  webdavUrl: string;
  webdavUsername: string;
  webdavPassword: string;
  webdavRemoteDir: string;
  autoSync: boolean;
}

const config = ref<SyncConfig>({
  webdavUrl: '',
  webdavUsername: '',
  webdavPassword: '',
  webdavRemoteDir: 'readchat',
  autoSync: false,
});

const status = ref<'idle' | 'saving' | 'testing' | 'uploading' | 'downloading'>('idle');
const message = ref<{ success: boolean; text: string } | null>(null);
const lastSyncAt = ref<number | null>(null);
const passwordVisible = ref(false);

const lastSyncDisplay = computed(() => {
  if (!lastSyncAt.value) return '从未同步';
  return dayjs(lastSyncAt.value).format('YYYY-MM-DD HH:mm:ss');
});

onMounted(async () => {
  const settings = await getAppSettings();
  config.value = {
    webdavUrl: settings.webdavUrl || '',
    webdavUsername: settings.webdavUsername || '',
    webdavPassword: settings.webdavPassword || '',
    webdavRemoteDir: settings.webdavRemoteDir || 'readchat',
    autoSync: settings.autoSync || false,
  };
  lastSyncAt.value = (await getLastSyncAt()) || null;
});

function asWebdavConfig() {
  return {
    webdavUrl: config.value.webdavUrl,
    webdavUsername: config.value.webdavUsername,
    webdavPassword: config.value.webdavPassword,
    webdavRemoteDir: config.value.webdavRemoteDir,
  };
}

async function save(): Promise<void> {
  status.value = 'saving';
  message.value = null;
  try {
    await setAppSettings({
      webdavUrl: config.value.webdavUrl,
      webdavUsername: config.value.webdavUsername,
      webdavPassword: config.value.webdavPassword,
      webdavRemoteDir: config.value.webdavRemoteDir,
      autoSync: config.value.autoSync,
    });
    message.value = { success: true, text: '✅ 配置已保存' };
  } catch (err) {
    message.value = {
      success: false,
      text: `❌ 保存失败：${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    status.value = 'idle';
  }
}

async function testConnection(): Promise<void> {
  status.value = 'testing';
  message.value = null;
  try {
    const result = await testWebdavConnection(asWebdavConfig());
    message.value = { success: result.success, text: result.message };
  } catch (err) {
    message.value = {
      success: false,
      text: `❌ 错误：${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    status.value = 'idle';
  }
}

async function uploadNow(): Promise<void> {
  if (!confirm('上传将覆盖远程 readchat-latest.json，确定继续？')) return;
  status.value = 'uploading';
  message.value = null;
  try {
    await save();
    await uploadToWebdav(asWebdavConfig());
    lastSyncAt.value = Date.now();
    message.value = { success: true, text: '✅ 上传成功' };
  } catch (err) {
    message.value = {
      success: false,
      text: `❌ 上传失败：${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    status.value = 'idle';
  }
}

async function downloadNow(): Promise<void> {
  if (!confirm('下载会合并远程数据到本地，确定继续？')) return;
  status.value = 'downloading';
  message.value = null;
  try {
    const result = await downloadFromWebdav(asWebdavConfig());
    message.value = { success: result.success, text: result.message };
    if (result.success) {
      lastSyncAt.value = Date.now();
      await documentsStore.loadDocuments();
      await modelsStore.loadModels();
    }
  } catch (err) {
    message.value = {
      success: false,
      text: `❌ 下载失败：${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    status.value = 'idle';
  }
}
</script>

<template>
  <div class="sync-card">
    <p class="hint">支持坚果云、Nextcloud、自建 WebDAV。详细配置说明见 <a href="#" @click.prevent>文档</a>。</p>

    <div class="form">
      <label class="full">
        <span>WebDAV URL <em>*</em></span>
        <input v-model="config.webdavUrl" placeholder="https://dav.example.com" />
      </label>

      <label>
        <span>用户名</span>
        <input v-model="config.webdavUsername" placeholder="可选" />
      </label>

      <label>
        <span>密码 / Token</span>
        <div class="pwd-row">
          <input
            v-model="config.webdavPassword"
            :type="passwordVisible ? 'text' : 'password'"
            placeholder="应用专用密码（推荐）"
          />
          <button
            type="button"
            class="eye"
            :title="passwordVisible ? '隐藏' : '显示'"
            @click="passwordVisible = !passwordVisible"
          >
            {{ passwordVisible ? '🙈' : '👁️' }}
          </button>
        </div>
      </label>

      <label>
        <span>远程目录</span>
        <input v-model="config.webdavRemoteDir" placeholder="readchat" />
      </label>

      <label>
        <span>最后同步</span>
        <div class="last-sync">{{ lastSyncDisplay }}</div>
      </label>
    </div>

    <label class="auto-row">
      <input v-model="config.autoSync" type="checkbox" />
      <span>每次保存文档后自动同步到 WebDAV（待实现：定时任务）</span>
    </label>

    <div v-if="message" :class="['message', message.success ? 'ok' : 'err']">
      {{ message.text }}
    </div>

    <div class="actions">
      <button class="ghost" :disabled="status !== 'idle'" @click="testConnection">
        {{ status === 'testing' ? '⏳ 测试中…' : '🔌 测试连接' }}
      </button>
      <button class="ghost" :disabled="status !== 'idle'" @click="save">
        {{ status === 'saving' ? '⏳ 保存中…' : '💾 保存' }}
      </button>
      <button class="ghost" :disabled="status !== 'idle'" @click="downloadNow">
        {{ status === 'downloading' ? '⏳ 拉取中…' : '⬇️ 拉取' }}
      </button>
      <button class="primary" :disabled="status !== 'idle'" @click="uploadNow">
        {{ status === 'uploading' ? '⏳ 推送中…' : '⬆️ 推送' }}
      </button>
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
  color: var(--color-text-secondary);
}
.hint a {
  color: var(--color-primary);
  text-decoration: none;
}

.form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
}
label.full { grid-column: 1 / -1; }
label em { color: #ef4444; font-style: normal; }

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

.pwd-row {
  display: flex;
  gap: 4px;
}
.pwd-row input { flex: 1; }
.pwd-row .eye {
  padding: 0 10px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
}

.last-sync {
  padding: 8px 10px;
  font-size: 13px;
  color: var(--color-text);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-variant-numeric: tabular-nums;
}

.auto-row {
  flex-direction: row !important;
  align-items: center;
  gap: 8px !important;
  margin: 8px 0 16px;
  cursor: pointer;
  color: var(--color-text);
}
.auto-row input { width: 16px; height: 16px; }

.message {
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  margin-bottom: 12px;
}
.message.ok { background: rgba(16, 185, 129, 0.12); color: #10b981; }
.message.err { background: rgba(239, 68, 68, 0.12); color: #ef4444; }

.actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

button {
  padding: 6px 14px;
  background: var(--color-bg);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}
button:hover:not(:disabled) {
  background: var(--color-border);
}
button.primary {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}
button.primary:hover:not(:disabled) {
  filter: brightness(1.1);
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
