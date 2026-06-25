<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useModelsStore } from '@/stores/models';
import { useDocumentsStore } from '@/stores/documents';
import ModelConfigCard from './components/ModelConfigCard.vue';
import SyncSettings from './components/SyncSettings.vue';
import BackupSettings from './components/BackupSettings.vue';
import type { ModelProviderConfig } from '@/shared/types';

const modelsStore = useModelsStore();
const documentsStore = useDocumentsStore();

const editingModel = ref<ModelProviderConfig | null>(null);

onMounted(async () => {
  await modelsStore.loadModels();
  await documentsStore.loadDocuments();
});

function addNewModel(): void {
  editingModel.value = modelsStore.createBlank();
}

function editModel(model: ModelProviderConfig): void {
  editingModel.value = JSON.parse(JSON.stringify(model));
}

async function saveModel(model: ModelProviderConfig): Promise<void> {
  await modelsStore.saveModelConfig(model);
  editingModel.value = null;
}

function cancelEdit(): void {
  editingModel.value = null;
}

async function deleteModel(id: string): Promise<void> {
  if (!confirm('确定删除此模型配置？')) return;
  await modelsStore.removeModelById(id);
}
</script>

<template>
  <div class="settings">
    <header>
      <h1>⚙️ ReadChat 设置</h1>
      <p>管理模型、同步、导入导出等</p>
    </header>

    <h2>🤖 模型配置</h2>
    <div class="models-list">
      <div v-for="m in modelsStore.models" :key="m.id" class="model-row">
        <div class="model-info">
          <div class="model-name">
            {{ m.name }}
            <span v-if="modelsStore.defaultModelId === m.id" class="default-badge">默认</span>
          </div>
          <div class="model-detail">
            <span>{{ m.provider }}</span> ·
            <span>{{ m.model }}</span> ·
            <span :class="m.enabled ? 'enabled' : 'disabled'">
              {{ m.enabled ? '启用' : '禁用' }}
            </span>
          </div>
        </div>
        <div class="model-actions">
          <button @click="editModel(m)">编辑</button>
          <button
            v-if="modelsStore.defaultModelId !== m.id"
            @click="modelsStore.setDefault(m.id)"
          >
            设为默认
          </button>
          <button class="danger" @click="deleteModel(m.id)">删除</button>
        </div>
      </div>
      <button class="add-btn" @click="addNewModel">+ 添加模型</button>
    </div>

    <ModelConfigCard
      v-if="editingModel"
      :model="editingModel"
      @save="saveModel"
      @cancel="cancelEdit"
    />

    <h2>☁️ 同步 (WebDAV)</h2>
    <SyncSettings />

    <h2>💾 备份与恢复</h2>
    <BackupSettings />
  </div>
</template>

<style scoped>
.models-list {
  background: var(--color-bg-secondary);
  border-radius: 8px;
  padding: 4px;
}

.model-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
}
.model-row:last-child {
  border-bottom: none;
}

.model-info {
  flex: 1;
  min-width: 0;
}

.model-name {
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.default-badge {
  font-size: 11px;
  padding: 1px 6px;
  background: var(--color-primary);
  color: white;
  border-radius: 3px;
  font-weight: 400;
}

.model-detail {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.enabled { color: #10b981; }
.disabled { color: #6b7280; }

.model-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.model-actions button {
  padding: 4px 10px;
  background: var(--color-bg);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 12px;
}
.model-actions button:hover {
  background: var(--color-border);
}
.model-actions button.danger {
  color: var(--color-danger);
  border-color: var(--color-danger);
}

.add-btn {
  width: 100%;
  padding: 12px;
  margin-top: 8px;
  background: transparent;
  color: var(--color-text-secondary);
  border: 1px dashed var(--color-border);
  border-radius: 6px;
  font-size: 13px;
}
.add-btn:hover {
  background: var(--color-bg);
}
</style>
