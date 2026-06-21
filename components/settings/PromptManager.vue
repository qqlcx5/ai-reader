<script lang="ts" setup>
import { ref } from 'vue';
import { useSettingsStore } from '@/stores/settings.store';
import type { PromptTemplate } from '@/modules/storage/types';

const store = useSettingsStore();

const editingId = ref<string | null>(null);
const showForm = ref(false);
const form = ref<PromptTemplate>({
  id: '',
  name: '',
  content: '',
  mode: 'chat',
});

function openNew() {
  form.value = {
    id: crypto.randomUUID(),
    name: '',
    content: '',
    mode: 'chat',
  };
  editingId.value = null;
  showForm.value = true;
}

function openEdit(p: PromptTemplate) {
  form.value = { ...p };
  editingId.value = p.id;
  showForm.value = true;
}

function save() {
  if (!form.value.name.trim() || !form.value.content.trim()) return;
  const updated = [...store.settings.prompts];
  if (editingId.value) {
    const idx = updated.findIndex(p => p.id === editingId.value);
    if (idx >= 0) updated[idx] = { ...form.value };
  } else {
    updated.push({ ...form.value });
  }
  store.setSettings({ prompts: updated });
  showForm.value = false;
}

function remove(id: string) {
  store.setSettings({ prompts: store.settings.prompts.filter(p => p.id !== id) });
}

function cancel() {
  showForm.value = false;
}
</script>

<template>
  <div class="prompt-manager">
    <div class="pm-head">
      <h3 class="pm-title">提示词模板</h3>
      <button class="pm-add" @click="openNew">+ 添加模板</button>
    </div>

    <div v-if="store.settings.prompts.length === 0" class="pm-empty muted">
      还没有提示词模板。
    </div>

    <div v-for="p in store.settings.prompts" :key="p.id" class="pm-card">
      <div class="pm-card-head">
        <span class="pm-card-name">{{ p.name }}</span>
        <span v-if="p.mode" class="pm-card-mode">用于: {{ p.mode }}</span>
      </div>
      <div class="pm-card-content muted">{{ p.content }}</div>
      <div class="pm-card-actions">
        <button class="pm-btn" @click="openEdit(p)">编辑</button>
        <button class="pm-btn pm-btn--danger" @click="remove(p.id)">删除</button>
      </div>
    </div>

    <div v-if="showForm" class="pm-overlay" @click.self="cancel">
      <div class="pm-form surface">
        <h4 class="pm-form-title">{{ editingId ? '编辑模板' : '添加模板' }}</h4>

        <label class="pm-field">
          <span>名称</span>
          <input v-model="form.name" placeholder="如：总结摘要" />
        </label>

        <label class="pm-field">
          <span>模式</span>
          <select v-model="form.mode">
            <option value="chat">Chat</option>
            <option value="roundtable">Roundtable</option>
            <option value="relay">Relay</option>
          </select>
        </label>

        <label class="pm-field">
          <span>内容</span>
          <textarea v-model="form.content" rows="5" placeholder="请输入提示词内容..." />
        </label>

        <div class="pm-form-actions">
          <button class="pm-btn" @click="cancel">取消</button>
          <button class="pm-btn pm-btn--primary" @click="save" :disabled="!form.name.trim() || !form.content.trim()">
            保存
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prompt-manager {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pm-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.pm-title {
  margin: 0;
  font-size: var(--fs-sm);
  font-weight: 700;
}
.pm-add {
  font-size: var(--fs-xs);
  padding: 4px 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--primary);
  background: var(--primary);
  color: #fff;
  cursor: pointer;
}
.pm-add:hover { opacity: 0.9; }
.pm-empty {
  text-align: center;
  padding: var(--space-6);
  font-size: var(--fs-xs);
}
.pm-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pm-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pm-card-name {
  font-weight: 700;
  font-size: var(--fs-xs);
}
.pm-card-mode {
  font-size: 10px;
  padding: 1px 6px;
  background: var(--primary-soft);
  color: var(--primary);
  border-radius: var(--radius-pill);
}
.pm-card-content {
  font-size: var(--fs-xs);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.pm-card-actions {
  display: flex;
  gap: 6px;
}
.pm-btn {
  font-size: var(--fs-xs);
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  cursor: pointer;
}
.pm-btn:hover {
  background: var(--primary-soft);
  border-color: var(--primary);
}
.pm-btn--primary { background: var(--primary); color: #fff; border-color: var(--primary); }
.pm-btn--danger { color: var(--red); border-color: var(--red); }
.pm-btn--danger:hover { background: var(--red-soft); }
.pm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.pm-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.35);
  z-index: 100;
  backdrop-filter: blur(2px);
}
.pm-form {
  width: 480px;
  max-width: 90vw;
  padding: 20px;
  border-radius: var(--radius-xl);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pm-form-title {
  margin: 0;
  font-size: var(--fs-sm);
  font-weight: 700;
}
.pm-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: var(--fs-xs);
}
.pm-field input,
.pm-field select,
.pm-field textarea {
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--panel);
  color: var(--text);
  font-size: var(--fs-xs);
  font-family: inherit;
}
.pm-field textarea { resize: vertical; }
.pm-field input:focus,
.pm-field select:focus,
.pm-field textarea:focus {
  outline: none;
  border-color: var(--primary);
}
.pm-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}
</style>
