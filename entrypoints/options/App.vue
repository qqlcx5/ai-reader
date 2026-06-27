<template>
  <div class="options-page">
    <header class="options-header">
      <h1>SuperBrain 智能剪藏</h1>
      <p class="subtitle">LLM 模型配置</p>
    </header>

    <!-- Provider Selector -->
    <section class="section">
      <h2 class="section-title">模型供应商</h2>
      <div class="form-row">
        <select
          v-model="selectedProviderId"
          class="select"
          @change="onProviderChange"
        >
          <option
            v-for="p in providers"
            :key="p.id"
            :value="p.id"
          >
            {{ p.name }} {{ p.isBuiltin ? '(内置)' : '(自定义)' }}
          </option>
        </select>
        <button class="btn btn-secondary" @click="showAddProvider = true">
          + 添加自定义
        </button>
      </div>

      <!-- Custom Provider Form -->
      <div v-if="showAddProvider" class="card">
        <h3>添加自定义 Provider</h3>
        <div class="form-group">
          <label>Provider ID（英文标识）</label>
          <input v-model="newProvider.id" type="text" class="input" placeholder="my-provider" />
        </div>
        <div class="form-group">
          <label>显示名称</label>
          <input v-model="newProvider.name" type="text" class="input" placeholder="我的模型" />
        </div>
        <div class="form-group">
          <label>API Base URL</label>
          <input v-model="newProvider.baseUrl" type="text" class="input" placeholder="https://api.example.com/v1" />
        </div>
        <div class="form-group">
          <label>模型列表（逗号分隔）</label>
          <input v-model="newProvider.modelsStr" type="text" class="input" placeholder="model-a, model-b" />
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" @click="addCustomProvider">添加</button>
          <button class="btn btn-secondary" @click="showAddProvider = false">取消</button>
        </div>
        <p v-if="providerError" class="error-text">{{ providerError }}</p>
      </div>
    </section>

    <!-- Model Selection -->
    <section class="section">
      <h2 class="section-title">模型选择</h2>
      <select v-model="selectedModel" class="select">
        <option
          v-for="m in currentModels"
          :key="m"
          :value="m"
        >
          {{ m }}
        </option>
      </select>
    </section>

    <!-- API Endpoint -->
    <section class="section">
      <h2 class="section-title">API 端点</h2>
      <input
        v-model="baseUrl"
        type="text"
        class="input"
        placeholder="https://api.deepseek.com/v1"
        @change="onBaseUrlChange"
      />
    </section>

    <!-- API Key -->
    <section class="section">
      <h2 class="section-title">API Key</h2>
      <div class="api-key-row">
        <div class="input-with-icon">
          <input
            ref="apiKeyInputRef"
            v-model="apiKeyInput"
            :type="showApiKey ? 'text' : 'password'"
            class="input"
            placeholder="sk-..."
            autocomplete="off"
          />
          <button
            type="button"
            class="icon-btn"
            :title="showApiKey ? '隐藏' : '显示'"
            @click="toggleApiKeyVisibility"
          >
            {{ showApiKey ? '🙈' : '👁' }}
          </button>
        </div>
        <div class="encryption-badge" :class="encryptionStatusClass">
          {{ encryptionStatusText }}
        </div>
      </div>
      <button class="btn btn-primary" @click="saveApiKey">保存 API Key</button>
      <button v-if="hasStoredKey" class="btn btn-danger" @click="deleteApiKey">删除已保存的 Key</button>
    </section>

    <!-- Test Connection -->
    <section class="section">
      <h2 class="section-title">连接测试</h2>
      <button class="btn btn-primary" :disabled="testing" @click="testConnection">
        {{ testing ? '测试中...' : '测试连接' }}
      </button>
      <div v-if="connectionResult" class="connection-result" :class="connectionResult.connected ? 'success' : 'error'">
        <p>
          <strong>{{ connectionResult.connected ? '已连接' : '连接失败' }}</strong>
          <span v-if="connectionResult.latencyMs !== null"> ({{ connectionResult.latencyMs }}ms)</span>
        </p>
        <p v-if="connectionResult.error" class="error-text">{{ connectionResult.error }}</p>
      </div>
    </section>

    <!-- Current Active Model Summary -->
    <section class="section">
      <h2 class="section-title">当前活跃模型</h2>
      <div v-if="activeConfig" class="active-summary card">
        <div class="summary-row">
          <span class="label">Provider</span>
          <span class="value">{{ activeConfig.providerName }}</span>
        </div>
        <div class="summary-row">
          <span class="label">模型</span>
          <span class="value">{{ activeConfig.modelName }}</span>
        </div>
        <div class="summary-row">
          <span class="label">端点</span>
          <span class="value mono">{{ activeConfig.baseUrl }}</span>
        </div>
        <div class="summary-row">
          <span class="label">API Key</span>
          <span class="value" :class="hasStoredKey ? 'text-green' : 'text-red'">
            {{ hasStoredKey ? '已配置（加密存储）' : '未配置' }}
          </span>
        </div>
        <div class="summary-row" v-if="connectionStatus">
          <span class="label">连接状态</span>
          <span class="value" :class="connectionStatus.connected ? 'text-green' : 'text-red'">
            {{ connectionStatus.connected ? '正常' : '异常' }}
          </span>
        </div>
      </div>
      <p v-else class="muted">尚未配置模型，请先选择 Provider 并保存 API Key。</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { providerRegistry } from '../../core/models/provider-registry';
import { modelConfigRepo } from '../../db/model-config.repository';
import { settingsRepo } from '../../db/settings.repository';
import type { ModelProvider, ModelConnectionStatus, StoredProviderConfig } from '../../shared/domain';

// ---- State ----

const providers = ref<ModelProvider[]>([]);
const selectedProviderId = ref('deepseek');
const selectedModel = ref('deepseek-chat');
const baseUrl = ref('https://api.deepseek.com/v1');
const apiKeyInput = ref('');
const showApiKey = ref(false);
const hasStoredKey = ref(false);
const testing = ref(false);
const connectionResult = ref<ModelConnectionStatus | null>(null);
const connectionStatus = ref<ModelConnectionStatus | null>(null);
const activeConfig = ref<StoredProviderConfig | null>(null);

const showAddProvider = ref(false);
const providerError = ref('');
const newProvider = ref({ id: '', name: '', baseUrl: '', modelsStr: '' });

const apiKeyInputRef = ref<HTMLInputElement | null>(null);

// ---- Derived ----

const currentModels = computed(() => {
  const p = providers.value.find((p) => p.id === selectedProviderId.value);
  return p?.models ?? [];
});

const encryptionStatusClass = computed(() => {
  if (hasStoredKey.value) return 'encrypted';
  if (apiKeyInput.value.trim()) return 'pending';
  return 'empty';
});

const encryptionStatusText = computed(() => {
  if (hasStoredKey.value) return 'AES-GCM 已加密';
  if (apiKeyInput.value.trim()) return '待保存';
  return '未配置';
});

// ---- Methods ----

function getDerivationPassword(): string {
  // Use a fixed derivation password for this extension instance.
  // In a real deployment, this should be per-install random token.
  // For now, derive from extension ID or fallback.
  if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
    return `superbrain-kdf-${chrome.runtime.id}`;
  }
  return 'superbrain-kdf-default';
}

async function onProviderChange() {
  const p = providers.value.find((p) => p.id === selectedProviderId.value);
  if (p) {
    baseUrl.value = p.baseUrl;
    if (p.models.length > 0) {
      selectedModel.value = p.models[0];
    }
  }
}

function onBaseUrlChange() {
  // Update the selected provider's baseUrl if it's a custom one
  const p = providers.value.find((p) => p.id === selectedProviderId.value);
  if (p && p.baseUrl !== baseUrl.value) {
    providerRegistry.update(selectedProviderId.value, { baseUrl: baseUrl.value });
  }
}

async function addCustomProvider() {
  providerError.value = '';
  const { id, name, baseUrl: url, modelsStr } = newProvider.value;

  if (!id.trim() || !name.trim() || !url.trim()) {
    providerError.value = '请填写所有必填字段';
    return;
  }

  const models = modelsStr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (models.length === 0) {
    providerError.value = '请至少输入一个模型名称';
    return;
  }

  try {
    await providerRegistry.add({ id: id.trim(), name: name.trim(), baseUrl: url.trim(), models });
    await refreshProviders();
    selectedProviderId.value = id.trim();
    baseUrl.value = url.trim();
    selectedModel.value = models[0];
    showAddProvider.value = false;
    newProvider.value = { id: '', name: '', baseUrl: '', modelsStr: '' };
  } catch (e) {
    providerError.value = `添加失败: ${e}`;
  }
}

function toggleApiKeyVisibility() {
  showApiKey.value = !showApiKey.value;
}

async function saveApiKey() {
  const key = apiKeyInput.value.trim();
  if (!key) return;

  const derivePassword = getDerivationPassword();
  await modelConfigRepo.saveApiKey(key, derivePassword);

  // Save the provider config to sync storage
  const p = providers.value.find((p) => p.id === selectedProviderId.value);
  await modelConfigRepo.saveConfig({
    providerId: selectedProviderId.value,
    providerName: p?.name ?? selectedProviderId.value,
    modelName: selectedModel.value,
    baseUrl: baseUrl.value,
    isActive: true,
    updatedAt: new Date().toISOString(),
  });

  // Save model settings
  await settingsRepo.updateModelSettings({
    activeProviderId: selectedProviderId.value,
    activeModel: selectedModel.value,
    setupComplete: true,
  });

  // Wipe API key from the input and JS memory
  apiKeyInput.value = '';
  showApiKey.value = false;

  // Also clear the DOM input value directly
  await nextTick();
  if (apiKeyInputRef.value) {
    apiKeyInputRef.value.value = '';
  }

  hasStoredKey.value = true;
  await refreshSummary();
}

async function deleteApiKey() {
  await modelConfigRepo.deleteApiKey();
  hasStoredKey.value = false;
  apiKeyInput.value = '';
  if (apiKeyInputRef.value) {
    apiKeyInputRef.value.value = '';
  }
  await refreshSummary();
}

async function testConnection() {
  testing.value = true;
  connectionResult.value = null;

  const derivePassword = getDerivationPassword();
  const config = await modelConfigRepo.getFullConfig(derivePassword);

  if (!config) {
    connectionResult.value = {
      providerId: selectedProviderId.value,
      providerName: providers.value.find((p) => p.id === selectedProviderId.value)?.name ?? '',
      modelName: selectedModel.value,
      connected: false,
      latencyMs: null,
      error: '请先保存 API Key',
      checkedAt: new Date().toISOString(),
    };
    testing.value = false;
    return;
  }

  const start = performance.now();
  try {
    const response = await fetch(`${config.baseUrl}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    const latencyMs = Math.round(performance.now() - start);

    if (response.ok) {
      connectionResult.value = {
        providerId: config.providerId,
        providerName: config.providerName,
        modelName: config.modelName,
        connected: true,
        latencyMs,
        checkedAt: new Date().toISOString(),
      };
    } else {
      connectionResult.value = {
        providerId: config.providerId,
        providerName: config.providerName,
        modelName: config.modelName,
        connected: false,
        latencyMs,
        error: `HTTP ${response.status}: ${response.statusText}`,
        checkedAt: new Date().toISOString(),
      };
    }
  } catch (e) {
    const latencyMs = Math.round(performance.now() - start);
    connectionResult.value = {
      providerId: config.providerId,
      providerName: config.providerName,
      modelName: config.modelName,
      connected: false,
      latencyMs,
      error: e instanceof Error ? e.message : String(e),
      checkedAt: new Date().toISOString(),
    };
  }

  testing.value = false;

  // Persist connection status
  if (connectionResult.value) {
    await modelConfigRepo.saveConnectionStatus(connectionResult.value);
    connectionStatus.value = connectionResult.value;
  }
}

async function refreshProviders() {
  providers.value = await providerRegistry.load();

  // Ensure selected provider exists
  if (!providers.value.find((p) => p.id === selectedProviderId.value)) {
    selectedProviderId.value = providers.value[0]?.id ?? 'deepseek';
  }

  const p = providers.value.find((p) => p.id === selectedProviderId.value);
  if (p) baseUrl.value = p.baseUrl;

  // Ensure selected model is valid
  const models = p?.models ?? [];
  if (!models.includes(selectedModel.value) && models.length > 0) {
    selectedModel.value = models[0];
  }
}

async function refreshSummary() {
  activeConfig.value = await modelConfigRepo.getConfig();
  hasStoredKey.value = await modelConfigRepo.hasApiKey();
  connectionStatus.value = await modelConfigRepo.getConnectionStatus();
}

onMounted(async () => {
  await refreshProviders();
  await refreshSummary();
});
</script>

<style scoped>
.options-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 40px 24px 80px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #1d1d1f;
}

.options-header h1 {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 4px;
}

.subtitle {
  font-size: 14px;
  color: #86868b;
  margin: 0;
}

.section {
  margin-top: 28px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #6e6e73;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 12px;
}

.form-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #6e6e73;
  margin-bottom: 4px;
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.input,
.select {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #d2d2d7;
  border-radius: 12px;
  font-size: 14px;
  background: #fff;
  color: #1d1d1f;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s;
}

.input:focus,
.select:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.select {
  flex: 1;
  cursor: pointer;
}

.api-key-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-with-icon {
  position: relative;
}

.input-with-icon .input {
  padding-right: 48px;
}

.icon-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
}

.encryption-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: 20px;
  width: fit-content;
}

.encryption-badge.encrypted {
  background: #d1fae5;
  color: #065f46;
}

.encryption-badge.pending {
  background: #fef3c7;
  color: #92400e;
}

.encryption-badge.empty {
  background: #f3f4f6;
  color: #6b7280;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary {
  background: #2563eb;
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-danger {
  background: #fef2f2;
  color: #dc2626;
  margin-left: 8px;
}

.btn-danger:hover {
  background: #fee2e2;
}

.card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 16px;
  margin-top: 12px;
}

.card h3 {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px;
}

.connection-result {
  margin-top: 12px;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 13px;
}

.connection-result.success {
  background: #d1fae5;
  color: #065f46;
}

.connection-result.error {
  background: #fee2e2;
  color: #991b1b;
}

.connection-result p {
  margin: 0;
}

.connection-result p + p {
  margin-top: 4px;
}

.active-summary {
  margin-top: 4px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f3f4f6;
  font-size: 13px;
}

.summary-row:last-child {
  border-bottom: none;
}

.summary-row .label {
  color: #6e6e73;
  font-weight: 500;
}

.summary-row .value {
  font-weight: 500;
}

.mono {
  font-family: 'SF Mono', 'Menlo', 'Monaco', monospace;
  font-size: 12px;
}

.text-green {
  color: #059669;
}

.text-red {
  color: #dc2626;
}

.muted {
  color: #9ca3af;
  font-size: 13px;
}

.error-text {
  color: #dc2626;
  font-size: 12px;
  margin-top: 8px;
}
</style>
