<script lang="ts" setup>
/**
 * M6 — Sync & Backup options panel.
 *
 * Surfaces the M7 `ExportConfig` (WebDAV / Obsidian / auto-backup) and
 * the manual zip-export action. Bound to the settings store so changes
 * persist via chrome.storage.local automatically.
 */
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useSettingsStore } from '@/stores/settings.store';
import IconButton from '@/components/shared/IconButton.vue';
import {
  scheduleAutoBackup,
  collectBackupSnapshot,
  exportZip,
  downloadZip,
  hasWebDAVConfig,
  toObsidianOptions,
  type WebDAVClient,
} from '@/lib/export';
import { exportJson, exportZipWithPages } from '@/lib/export/manual-export';
import { importBackup, extractBackupFromZip, type MergeStrategy } from '@/lib/export/import';

const store = useSettingsStore();
const { settings } = storeToRefs(store);

// Local editable mirror of exportConfig (saved on blur / change).
const exportConfig = computed(() => settings.value.exportConfig);

function patchExportConfig(patch: Partial<typeof exportConfig.value>) {
  store.setSettings({ exportConfig: { ...exportConfig.value, ...patch } });
}

// ─── WebDAV ──────────────────────────────────────────────────────────
const testing = ref(false);
const testStatus = ref<{ ok: boolean; message: string } | null>(null);

async function testWebDAV() {
  if (!hasWebDAVConfig(exportConfig.value)) {
    testStatus.value = { ok: false, message: '请填写 WebDAV 地址与用户名' };
    return;
  }
  testing.value = true;
  testStatus.value = null;
  try {
    const { createWebDAVClient, ensureDir } = await import('@/lib/export/webdav');
    const { toWebDAVOptions } = await import('@/lib/export');
    const options = toWebDAVOptions(exportConfig.value);
    const client: WebDAVClient = createWebDAVClient(options);
    await ensureDir(client, options.backupPath);
    testStatus.value = { ok: true, message: '连接成功' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    testStatus.value = {
      ok: false,
      message: msg.includes('authentication') || msg.includes('401') || msg.includes('403')
        ? '认证失败，请检查用户名/密码'
        : `连接失败：${msg}`,
    };
  } finally {
    testing.value = false;
  }
}

// ─── Auto-backup ─────────────────────────────────────────────────────
async function onToggleAutoBackup(value: boolean) {
  patchExportConfig({ autoBackupEnabled: value });
  try {
    await scheduleAutoBackup(exportConfig.value);
  } catch {
    // scheduling is best-effort in non-extension contexts
  }
}

// ─── Manual zip export ───────────────────────────────────────────────
const exporting = ref(false);
const exportProgress = ref<{ processed: number; total: number } | null>(null);
const exportError = ref('');

async function onExportZip() {
  exporting.value = true;
  exportError.value = '';
  exportProgress.value = null;
  try {
    const snapshot = await collectBackupSnapshot();
    const result = await exportZip({
      conversations: snapshot.conversations,
      messages: snapshot.messages,
      settings: snapshot.settings,
      onProgress: (processed, total) => {
        exportProgress.value = { processed, total };
      },
    });
    downloadZip(result.blob, result.filename);
  } catch (err) {
    exportError.value = err instanceof Error ? err.message : String(err);
  } finally {
    exporting.value = false;
    exportProgress.value = null;
  }
}

function formatLastBackup(at?: number): string {
  if (!at) return '从未备份';
  return new Date(at).toLocaleString();
}

const obsidianReady = computed(() => Boolean(exportConfig.value.obsidianVault));

// ─── Manual JSON/ZIP export ───────────────────────────────────────────
const exportingJson = ref(false);
const exportingZip = ref(false);

async function onExportJson() {
  exportingJson.value = true;
  try {
    await exportJson();
  } finally {
    exportingJson.value = false;
  }
}

async function onExportZipFull() {
  exportingZip.value = true;
  try {
    await exportZipWithPages();
  } finally {
    exportingZip.value = false;
  }
}

// ─── Import ──────────────────────────────────────────────────────────
const importFile = ref<File | null>(null);
const mergeStrategy = ref<MergeStrategy>('skip');
const importStats = ref<ImportStats | null>(null);
const importing = ref(false);
const importError = ref('');

interface ImportStats {
  pages: { imported: number; skipped: number; errors: number };
  conversations: { imported: number; skipped: number };
  messages: { imported: number; skipped: number };
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  importFile.value = input.files?.[0] ?? null;
  importStats.value = null;
  importError.value = '';
}

async function handleImport() {
  if (!importFile.value) return;
  importing.value = true;
  importStats.value = null;
  importError.value = '';
  try {
    let json: string;
    if (importFile.value.name.endsWith('.zip')) {
      const buf = await importFile.value.arrayBuffer();
      json = await extractBackupFromZip(buf);
    } else {
      json = await importFile.value.text();
    }
    const data = JSON.parse(json) as unknown;
    importStats.value = await importBackup(data, mergeStrategy.value);
  } catch (err) {
    importError.value = err instanceof Error ? err.message : String(err);
  } finally {
    importing.value = false;
  }
}
</script>

<template>
  <div class="sync-panel">
    <!-- WebDAV -->
    <section class="block">
      <header class="block__head">
        <h3 class="block__title">WebDAV 同步</h3>
        <span class="block__hint">单条 Markdown 与全量 JSON 备份的目标地址</span>
      </header>
      <div class="field">
        <label class="field__label">服务器地址</label>
        <input
          class="field__input"
          type="url"
          placeholder="https://dav.example.com/"
          :value="exportConfig.webDAVUrl"
          @input="patchExportConfig({ webDAVUrl: ($event.target as HTMLInputElement).value })"
        />
      </div>
      <div class="field-row">
        <div class="field">
          <label class="field__label">用户名</label>
          <input
            class="field__input"
            type="text"
            autocomplete="username"
            :value="exportConfig.webDAVUsername"
            @input="patchExportConfig({ webDAVUsername: ($event.target as HTMLInputElement).value })"
          />
        </div>
        <div class="field">
          <label class="field__label">密码</label>
          <input
            class="field__input"
            type="password"
            autocomplete="current-password"
            :value="exportConfig.webDAVPassword"
            @input="patchExportConfig({ webDAVPassword: ($event.target as HTMLInputElement).value })"
          />
        </div>
      </div>
      <div class="field">
        <label class="field__label">备份路径</label>
        <input
          class="field__input"
          type="text"
          placeholder="/ai-reader"
          :value="exportConfig.webDAVBackupPath"
          @input="patchExportConfig({ webDAVBackupPath: ($event.target as HTMLInputElement).value })"
        />
      </div>
      <div class="block__actions">
        <IconButton :disabled="testing" label="测试连接" @click="testWebDAV">
          {{ testing ? '测试中…' : '测试连接' }}
        </IconButton>
        <span v-if="testStatus" class="status" :class="testStatus.ok ? 'status--ok' : 'status--err'">
          {{ testStatus.message }}
        </span>
      </div>
    </section>

    <!-- Obsidian -->
    <section class="block">
      <header class="block__head">
        <h3 class="block__title">Obsidian 直写</h3>
        <span class="block__hint">通过 obsidian:// 协议一键创建笔记</span>
      </header>
      <div class="field-row">
        <div class="field">
          <label class="field__label">Vault 名称</label>
          <input
            class="field__input"
            type="text"
            placeholder="Personal"
            :value="exportConfig.obsidianVault"
            @input="patchExportConfig({ obsidianVault: ($event.target as HTMLInputElement).value })"
          />
        </div>
        <div class="field">
          <label class="field__label">默认文件夹（可选）</label>
          <input
            class="field__input"
            type="text"
            placeholder="AI Reader"
            :value="exportConfig.obsidianFolder"
            @input="patchExportConfig({ obsidianFolder: ($event.target as HTMLInputElement).value })"
          />
        </div>
      </div>
      <p v-if="!obsidianReady" class="status status--muted">填写 Vault 名称后，即可在侧栏会话中「导出到 Obsidian」。</p>
    </section>

    <!-- Auto-backup -->
    <section class="block">
      <header class="block__head">
        <h3 class="block__title">自动备份</h3>
        <span class="block__hint">每天凌晨 02:00 自动上传全量 JSON 到 WebDAV</span>
      </header>
      <label class="toggle">
        <input
          type="checkbox"
          :checked="exportConfig.autoBackupEnabled"
          @change="onToggleAutoBackup(($event.target as HTMLInputElement).checked)"
        />
        <span class="toggle__label">启用自动备份</span>
      </label>
      <div class="field">
        <label class="field__label">备份间隔（天）</label>
        <input
          class="field__input field__input--narrow"
          type="number"
          min="1"
          max="30"
          :value="exportConfig.autoBackupIntervalDays ?? 1"
          @input="
            patchExportConfig({
              autoBackupIntervalDays: Number(($event.target as HTMLInputElement).value) || 1,
            })
          "
        />
      </div>
      <div class="status-line">
        <span class="status status--muted">上次备份：{{ formatLastBackup(exportConfig.lastBackupAt) }}</span>
        <span v-if="exportConfig.lastBackupError" class="status status--err">
          错误：{{ exportConfig.lastBackupError }}
        </span>
      </div>
    </section>

    <!-- Manual zip export -->
    <section class="block">
      <header class="block__head">
        <h3 class="block__title">手动导出</h3>
        <span class="block__hint">将全部会话打包为 zip（不含 API Key）</span>
      </header>
      <div class="block__actions">
        <IconButton :disabled="exporting" label="导出 zip" @click="onExportZip">
          {{ exporting ? '打包中…' : '导出 zip' }}
        </IconButton>
        <span v-if="exportProgress" class="status status--muted">
          {{ exportProgress.processed }} / {{ exportProgress.total }}
        </span>
        <span v-if="exportError" class="status status--err">{{ exportError }}</span>
      </div>
    </section>

    <!-- Full export (JSON + ZIP with pages) -->
    <section class="block">
      <header class="block__head">
        <h3 class="block__title">完整备份（含页面快照）</h3>
        <span class="block__hint">导出包含 pages 快照的完整备份，直接触发浏览器下载</span>
      </header>
      <div class="block__actions">
        <IconButton :disabled="exportingJson" label="导出 JSON" @click="onExportJson">
          {{ exportingJson ? '导出中…' : '导出 JSON' }}
        </IconButton>
        <IconButton :disabled="exportingZip" label="导出 ZIP" @click="onExportZipFull">
          {{ exportingZip ? '打包中…' : '导出 ZIP' }}
        </IconButton>
      </div>
    </section>

    <!-- Import / Restore -->
    <section class="block">
      <header class="block__head">
        <h3 class="block__title">导入恢复</h3>
        <span class="block__hint">选择 .json 或 .zip 备份文件进行恢复</span>
      </header>
      <div class="field">
        <label class="field__label">备份文件</label>
        <input
          class="field__input"
          type="file"
          accept=".json,.zip"
          @change="onFileChange"
        />
      </div>
      <div class="import-strategies">
        <label class="toggle">
          <input
            type="radio"
            name="mergeStrategy"
            value="skip"
            :checked="mergeStrategy === 'skip'"
            @change="mergeStrategy = 'skip'"
          />
          <span class="toggle__label">跳过重复（保留本地）</span>
        </label>
        <label class="toggle">
          <input
            type="radio"
            name="mergeStrategy"
            value="overwrite"
            :checked="mergeStrategy === 'overwrite'"
            @change="mergeStrategy = 'overwrite'"
          />
          <span class="toggle__label">覆盖本地</span>
        </label>
      </div>
      <div class="block__actions">
        <IconButton :disabled="importing || !importFile" label="开始导入" @click="handleImport">
          {{ importing ? '导入中…' : '开始导入' }}
        </IconButton>
      </div>
      <div v-if="importError" class="status status--err">{{ importError }}</div>
      <div v-if="importStats" class="import-result">
        <div class="status status--ok">导入完成</div>
        <div class="status status--muted">
          页面：导入 {{ importStats.pages.imported }} / 跳过 {{ importStats.pages.skipped }} / 错误 {{ importStats.pages.errors }}
        </div>
        <div class="status status--muted">
          会话：导入 {{ importStats.conversations.imported }} / 跳过 {{ importStats.conversations.skipped }}
        </div>
        <div class="status status--muted">
          消息：导入 {{ importStats.messages.imported }} / 跳过 {{ importStats.messages.skipped }}
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.sync-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  text-align: left;
}

.block {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}

.block__head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.block__title {
  margin: 0;
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--text);
}

.block__hint {
  font-size: var(--fs-xs);
  color: var(--muted);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex: 1;
}

.field-row {
  display: flex;
  gap: var(--space-4);
}

.field__label {
  font-size: var(--fs-xs);
  color: var(--muted);
  font-weight: 600;
}

.field__input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--panel);
  color: var(--text);
  font-size: var(--fs-xs);
}

.field__input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}

.field__input--narrow {
  max-width: 120px;
}

.block__actions {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.status {
  font-size: var(--fs-xs);
}

.status--ok {
  color: var(--green);
}

.status--err {
  color: var(--red);
}

.status--muted {
  color: var(--muted);
}

.status-line {
  display: flex;
  gap: var(--space-5);
  flex-wrap: wrap;
}

.toggle {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  cursor: pointer;
  font-size: var(--fs-xs);
  color: var(--text);
}

.toggle input {
  width: 16px;
  height: 16px;
  accent-color: var(--primary);
}

.import-strategies {
  display: flex;
  gap: var(--space-5);
  flex-wrap: wrap;
}

.import-result {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
</style>
