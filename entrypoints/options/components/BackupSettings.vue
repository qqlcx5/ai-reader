<script lang="ts" setup>
import { ref } from 'vue';
import { exportBackup, importBackup } from '@/core/sync/backup.service';
import { useDocumentsStore } from '@/stores/documents';
import { useModelsStore } from '@/stores/models';

const documentsStore = useDocumentsStore();
const modelsStore = useModelsStore();
const importing = ref(false);
const exporting = ref(false);
const importResult = ref<string | null>(null);

async function doExport(): Promise<void> {
  exporting.value = true;
  try {
    await exportBackup();
  } finally {
    exporting.value = false;
  }
}

async function onFileChange(e: Event): Promise<void> {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (!confirm('导入会覆盖现有数据，确定继续？')) return;
  importing.value = true;
  importResult.value = null;
  try {
    const result = await importBackup(file);
    importResult.value = result.message;
    await documentsStore.loadDocuments();
    await modelsStore.loadModels();
  } catch (err) {
    importResult.value = `❌ 失败：${err instanceof Error ? err.message : String(err)}`;
  } finally {
    importing.value = false;
    (e.target as HTMLInputElement).value = '';
  }
}
</script>

<template>
  <div class="backup-card">
    <p class="hint">导出包含所有文档、聊天历史、模型配置。导入会覆盖现有数据。</p>

    <div class="actions">
      <button class="primary" :disabled="exporting" @click="doExport">
        {{ exporting ? '导出中...' : '📥 导出备份' }}
      </button>
      <label class="import-btn">
        {{ importing ? '导入中...' : '📤 导入备份' }}
        <input
          type="file"
          accept=".json,application/json"
          :disabled="importing"
          @change="onFileChange"
        />
      </label>
    </div>

    <div v-if="importResult" class="result">{{ importResult }}</div>
  </div>
</template>

<style scoped>
.backup-card {
  background: var(--color-bg-secondary);
  border-radius: 8px;
  padding: 20px;
}
.hint {
  margin-bottom: 16px;
  font-size: 12px;
}
.actions {
  display: flex;
  gap: 8px;
}
button, .import-btn {
  padding: 8px 16px;
  background: var(--color-bg);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
button.primary, .import-btn {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}
.import-btn {
  position: relative;
}
.import-btn input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
button:disabled, .import-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.result {
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  background: var(--color-bg);
}
</style>
