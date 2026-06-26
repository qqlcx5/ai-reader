<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { modelRepository } from '@/core/models/model.repository';
import { ping } from '@/core/models/openai-compat.adapter';
import { useSettingsStore } from '@/stores/settings.store';
import type { ModelProviderConfig } from '@/db/schema';

const settingsStore = useSettingsStore();

interface ModelForm {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  enabled: boolean;
}

const defaultForm: ModelForm = {
  name: '',
  baseUrl: '',
  apiKey: '',
  model: '',
  enabled: true,
};

const form = ref<ModelForm>({ ...defaultForm });
const editingId = ref<string | null>(null);
const showForm = ref(false);
const pingStatus = ref<Record<string, 'idle' | 'loading' | 'success' | 'error'>>({});
const pingResults = ref<Record<string, { latency?: number; error?: string }>>({});
const formError = ref('');
const saveSuccess = ref(false);

onMounted(async () => {
  await settingsStore.loadModels();
});

function openAddForm() {
  form.value = { ...defaultForm };
  editingId.value = null;
  showForm.value = true;
  formError.value = '';
  saveSuccess.value = false;
}

function openEditForm(model: ModelProviderConfig) {
  form.value = {
    name: model.name,
    baseUrl: model.baseUrl,
    apiKey: model.apiKey,
    model: model.model,
    enabled: model.enabled,
  };
  editingId.value = model.id;
  showForm.value = true;
  formError.value = '';
  saveSuccess.value = false;
}

async function handleSave() {
  formError.value = '';
  saveSuccess.value = false;

  // 表单验证
  if (!form.value.name.trim()) {
    formError.value = '请输入模型名称';
    return;
  }
  if (!form.value.baseUrl.trim()) {
    formError.value = '请输入 Base URL';
    return;
  }
  if (!form.value.model.trim()) {
    formError.value = '请输入模型 ID';
    return;
  }

  try {
    if (editingId.value) {
      await modelRepository.update(editingId.value, {
        name: form.value.name.trim(),
        baseUrl: form.value.baseUrl.trim(),
        apiKey: form.value.apiKey.trim(),
        model: form.value.model.trim(),
        enabled: form.value.enabled,
      });
    } else {
      await modelRepository.save({
        name: form.value.name.trim(),
        provider: 'openai-compatible',
        baseUrl: form.value.baseUrl.trim(),
        apiKey: form.value.apiKey.trim(),
        model: form.value.model.trim(),
        enabled: form.value.enabled,
      });
    }

    saveSuccess.value = true;
    showForm.value = false;
    await settingsStore.loadModels();
  } catch (err) {
    formError.value = `保存失败: ${String(err)}`;
  }
}

async function handleDelete(id: string) {
  if (!confirm('确定删除此模型配置？')) return;
  await modelRepository.delete(id);
  await settingsStore.loadModels();
}

async function handlePing(model: ModelProviderConfig) {
  pingStatus.value[model.id] = 'loading';
  const result = await ping(model.baseUrl, model.apiKey, model.model);
  pingStatus.value[model.id] = result.success ? 'success' : 'error';
  pingResults.value[model.id] = { latency: result.latency, error: result.error };
}

function cancelForm() {
  showForm.value = false;
  formError.value = '';
}
</script>

<template>
  <div class="space-y-4">
    <!-- Success Message -->
    <div v-if="saveSuccess" class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
      ✓ 模型配置已保存
    </div>

    <!-- Model List -->
    <div class="card p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-slate-800">模型配置</h2>
        <button class="btn-primary text-sm" @click="openAddForm">
          + 添加模型
        </button>
      </div>

      <div v-if="settingsStore.models.length === 0" class="text-center py-8 text-slate-400">
        <p>尚未配置任何模型</p>
        <p class="text-sm mt-1">点击"添加模型"开始配置</p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="model in settingsStore.models"
          :key="model.id"
          class="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
        >
          <!-- Status Indicator -->
          <div class="w-2 h-2 rounded-full flex-shrink-0"
            :class="model.enabled ? 'bg-green-500' : 'bg-slate-300'"
          />

          <!-- Model Info -->
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-slate-800 truncate">{{ model.name }}</div>
            <div class="text-xs text-slate-500 truncate">{{ model.baseUrl }}</div>
            <div class="text-xs text-slate-400 truncate">{{ model.model }}</div>
          </div>

          <!-- Ping Status -->
          <div v-if="pingStatus[model.id]" class="flex-shrink-0">
            <span v-if="pingStatus[model.id] === 'loading'" class="text-yellow-500 text-xs">⏳</span>
            <span v-else-if="pingStatus[model.id] === 'success'" class="text-green-500 text-xs">
              ✓ {{ pingResults[model.id]?.latency }}ms
            </span>
            <span v-else class="text-red-500 text-xs" :title="pingResults[model.id]?.error">✗</span>
          </div>

          <!-- Actions -->
          <div class="flex gap-1 flex-shrink-0">
            <button class="icon-btn text-xs" title="测试连接" @click="handlePing(model)">🔗</button>
            <button class="icon-btn text-xs" title="编辑" @click="openEditForm(model)">✏️</button>
            <button class="icon-btn text-xs" title="删除" @click="handleDelete(model.id)">🗑️</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Form -->
    <div v-if="showForm" class="card p-6">
      <h3 class="text-base font-semibold text-slate-800 mb-4">
        {{ editingId ? '编辑模型' : '添加模型' }}
      </h3>

      <!-- Error Message -->
      <div v-if="formError" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
        {{ formError }}
      </div>

      <div class="space-y-3">
        <div>
          <label class="text-sm text-slate-600 mb-1 block">模型名称 <span class="text-red-500">*</span></label>
          <input v-model="form.name" class="input" placeholder="例如: DeepSeek Chat" />
        </div>
        <div>
          <label class="text-sm text-slate-600 mb-1 block">Base URL <span class="text-red-500">*</span></label>
          <input v-model="form.baseUrl" class="input" placeholder="https://api.deepseek.com/v1" />
        </div>
        <div>
          <label class="text-sm text-slate-600 mb-1 block">API Key</label>
          <input v-model="form.apiKey" type="password" class="input" placeholder="sk-..." />
        </div>
        <div>
          <label class="text-sm text-slate-600 mb-1 block">模型 ID <span class="text-red-500">*</span></label>
          <input v-model="form.model" class="input" placeholder="deepseek-chat" />
        </div>
        <div class="flex items-center gap-2">
          <input v-model="form.enabled" type="checkbox" class="rounded" />
          <label class="text-sm text-slate-600">启用此模型</label>
        </div>
      </div>

      <div class="flex gap-2 mt-4">
        <button class="btn-primary" @click="handleSave">保存</button>
        <button class="btn-secondary" @click="cancelForm">取消</button>
      </div>
    </div>
  </div>
</template>
