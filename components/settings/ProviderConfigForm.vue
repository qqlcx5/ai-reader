<script lang="ts" setup>
import { ref, computed } from 'vue';
import { useSettingsStore } from '@/stores/settings.store';
import type { ProviderConfig } from '@/modules/storage/types';

const store = useSettingsStore();

const editingId = ref<string | null>(null);
const showForm = ref(false);

const form = ref<ProviderConfig>({
  id: '',
  name: '',
  type: 'openai',
  apiKey: '',
  baseUrl: '',
  defaultModel: '',
  enabled: true,
  storage: 'plaintext',
});

const providerTypes: { value: ProviderConfig['type']; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'custom', label: 'Custom' },
];

const defaultModels: Record<string, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
  gemini: 'gemini-2.5-flash',
};

const defaultUrls: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
};

function openNew() {
  form.value = {
    id: crypto.randomUUID(),
    name: '',
    type: 'openai',
    apiKey: '',
    baseUrl: defaultUrls.openai,
    defaultModel: defaultModels.openai,
    enabled: true,
    storage: 'plaintext',
  };
  editingId.value = null;
  showForm.value = true;
}

function openEdit(p: ProviderConfig) {
  form.value = { ...p };
  editingId.value = p.id;
  showForm.value = true;
}

function onTypeChange() {
  const t = form.value.type;
  if (!form.value.baseUrl || form.value.baseUrl === defaultUrls[editingId.value ? store.settings.providers.find(p => p.id === editingId.value)?.type || '' : ''] || !editingId.value) {
    form.value.baseUrl = defaultUrls[t] || '';
  }
  if (!form.value.defaultModel) {
    form.value.defaultModel = defaultModels[t] || '';
  }
}

function save() {
  if (!form.value.name.trim() || !form.value.apiKey.trim()) return;
  if (editingId.value) {
    store.updateProvider(editingId.value, form.value);
  } else {
    store.addProvider({ ...form.value });
  }
  showForm.value = false;
}

function remove(id: string) {
  store.removeProvider(id);
}

function cancel() {
  showForm.value = false;
}
</script>

<template>
  <div class="provider-config">
    <div class="pcf-head">
      <h3 class="pcf-title">Provider 配置</h3>
      <button class="pcf-add" @click="openNew">+ 添加 Provider</button>
    </div>

    <div v-if="store.apiKeyWarning" class="pcf-warning">{{ store.apiKeyWarning }}</div>

    <div v-if="store.settings.providers.length === 0" class="pcf-empty muted">
      还没有配置 Provider。点击上方按钮添加。
    </div>

    <div v-for="p in store.settings.providers" :key="p.id" class="pcf-card">
      <div class="pcf-card-head">
        <span class="pcf-card-name">{{ p.name }}</span>
        <span class="pcf-card-type">{{ providerTypes.find(t => t.value === p.type)?.label || p.type }}</span>
        <span v-if="!p.enabled" class="pcf-badge muted">已禁用</span>
      </div>
      <div class="pcf-card-meta muted mono" v-if="p.defaultModel">模型: {{ p.defaultModel }}</div>
      <div class="pcf-card-meta muted mono" v-if="p.baseUrl">{{ p.baseUrl }}</div>
      <div class="pcf-card-actions">
        <button class="pcf-btn" @click="openEdit(p)">编辑</button>
        <button class="pcf-btn pcf-btn--danger" @click="remove(p.id)">删除</button>
      </div>
    </div>

    <div v-if="showForm" class="pcf-overlay" @click.self="cancel">
      <div class="pcf-form surface">
        <h4 class="pcf-form-title">{{ editingId ? '编辑 Provider' : '添加 Provider' }}</h4>

        <label class="pcf-field">
          <span>名称</span>
          <input v-model="form.name" placeholder="如：我的 OpenAI" />
        </label>

        <label class="pcf-field">
          <span>类型</span>
          <select v-model="form.type" @change="onTypeChange">
            <option v-for="t in providerTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
        </label>

        <label class="pcf-field">
          <span>API Key</span>
          <input v-model="form.apiKey" type="password" placeholder="sk-..." />
        </label>

        <label class="pcf-field">
          <span>Base URL</span>
          <input v-model="form.baseUrl" placeholder="https://api.openai.com/v1" />
        </label>

        <label class="pcf-field">
          <span>默认模型</span>
          <input v-model="form.defaultModel" placeholder="gpt-4o" />
        </label>

        <label class="pcf-field pcf-field--row">
          <span>启用</span>
          <input v-model="form.enabled" type="checkbox" />
        </label>

        <div class="pcf-form-actions">
          <button class="pcf-btn" @click="cancel">取消</button>
          <button class="pcf-btn pcf-btn--primary" @click="save" :disabled="!form.name.trim() || !form.apiKey.trim()">
            保存
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.provider-config {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pcf-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.pcf-title {
  margin: 0;
  font-size: var(--fs-sm);
  font-weight: 700;
}
.pcf-add {
  font-size: var(--fs-xs);
  padding: 4px 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--primary);
  background: var(--primary);
  color: #fff;
  cursor: pointer;
}
.pcf-add:hover {
  opacity: 0.9;
}
.pcf-warning {
  font-size: var(--fs-xs);
  color: var(--orange);
  background: var(--orange-soft);
  padding: 8px 12px;
  border-radius: var(--radius-md);
}
.pcf-empty {
  text-align: center;
  padding: var(--space-6);
  font-size: var(--fs-xs);
}
.pcf-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pcf-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pcf-card-name {
  font-weight: 700;
  font-size: var(--fs-xs);
}
.pcf-card-type {
  font-size: 10px;
  padding: 1px 6px;
  background: var(--primary-soft);
  color: var(--primary);
  border-radius: var(--radius-pill);
}
.pcf-badge {
  font-size: 10px;
}
.pcf-card-meta {
  font-size: 10px;
}
.pcf-card-actions {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}
.pcf-btn {
  font-size: var(--fs-xs);
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  cursor: pointer;
}
.pcf-btn:hover {
  background: var(--primary-soft);
  border-color: var(--primary);
}
.pcf-btn--primary {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}
.pcf-btn--danger {
  color: var(--red);
  border-color: var(--red);
}
.pcf-btn--danger:hover {
  background: var(--red-soft);
}
.pcf-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.pcf-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.35);
  z-index: 100;
  backdrop-filter: blur(2px);
}
.pcf-form {
  width: 420px;
  max-width: 90vw;
  padding: 20px;
  border-radius: var(--radius-xl);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pcf-form-title {
  margin: 0;
  font-size: var(--fs-sm);
  font-weight: 700;
}
.pcf-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: var(--fs-xs);
}
.pcf-field--row {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}
.pcf-field input,
.pcf-field select {
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--panel);
  color: var(--text);
  font-size: var(--fs-xs);
}
.pcf-field input:focus,
.pcf-field select:focus {
  outline: none;
  border-color: var(--primary);
}
.pcf-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}
</style>
