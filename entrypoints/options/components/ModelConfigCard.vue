<script lang="ts" setup>
import { ref } from 'vue';
import { useModelsStore } from '@/stores/models';
import type { ModelProviderConfig } from '@/shared/types';

const props = defineProps<{ model: ModelProviderConfig }>();
const emit = defineEmits<{
  (e: 'save', m: ModelProviderConfig): void;
  (e: 'cancel'): void;
}>();

const modelsStore = useModelsStore();
const local = ref({ ...props.model });
const pingResult = ref<{ success: boolean; message?: string } | null>(null);
const pinging = ref(false);

async function ping(): Promise<void> {
  pinging.value = true;
  pingResult.value = null;
  try {
    pingResult.value = await modelsStore.ping(local.value.id);
  } finally {
    pinging.value = false;
  }
}

function save(): void {
  if (!local.value.name) {
    alert('请填写模型名称');
    return;
  }
  if (!local.value.apiKey) {
    alert('请填写 API Key');
    return;
  }
  emit('save', { ...local.value, updatedAt: Date.now() });
}
</script>

<template>
  <div class="card">
    <h3>{{ model.name ? `编辑：${model.name}` : '添加模型' }}</h3>

    <div class="form">
      <label>
        <span>名称 *</span>
        <input v-model="local.name" placeholder="如：GPT-4 生产环境" />
      </label>

      <label>
        <span>Provider</span>
        <select v-model="local.provider">
          <option value="openai-compatible">OpenAI Compatible</option>
        </select>
      </label>

      <label>
        <span>Base URL *</span>
        <input
          v-model="local.baseUrl"
          placeholder="https://api.openai.com/v1"
        />
      </label>

      <label>
        <span>Model *</span>
        <input v-model="local.model" placeholder="gpt-3.5-turbo" />
      </label>

      <label>
        <span>API Key *</span>
        <input v-model="local.apiKey" type="password" placeholder="sk-..." />
      </label>

      <label class="full">
        <span>系统提示词（可选）</span>
        <textarea
          v-model="local.systemPrompt"
          rows="4"
          placeholder="留空将使用全局默认"
        />
      </label>

      <label class="checkbox">
        <input v-model="local.enabled" type="checkbox" />
        <span>启用此模型</span>
      </label>

      <div v-if="pingResult" :class="['ping-result', pingResult.success ? 'ok' : 'err']">
        {{ pingResult.success ? '✅ 连接成功' : `❌ ${pingResult.message}` }}
      </div>

      <div class="actions">
        <button class="ping-btn" :disabled="pinging" @click="ping">
          {{ pinging ? '测试中...' : '测试连接' }}
        </button>
        <div class="action-right">
          <button @click="emit('cancel')">取消</button>
          <button class="primary" @click="save">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 20px;
  margin-top: 16px;
}

h3 {
  margin: 0 0 16px;
  font-size: 16px;
}

.form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
}
label.full {
  grid-column: 1 / -1;
}
label.checkbox {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  grid-column: 1 / -1;
}
label.checkbox span {
  font-size: 13px;
  color: var(--color-text);
}

input, select, textarea {
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 13px;
}
input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}

textarea {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  resize: vertical;
}

.ping-result {
  grid-column: 1 / -1;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
}
.ping-result.ok {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}
.ping-result.err {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}
.action-right {
  display: flex;
  gap: 8px;
}

button {
  padding: 6px 14px;
  background: var(--color-bg);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 4px;
}
button:hover {
  background: var(--color-border);
}
button.primary {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}
button.primary:hover {
  opacity: 0.9;
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.ping-btn {
  background: var(--color-bg);
}
</style>
