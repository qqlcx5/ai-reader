<script lang="ts" setup>
import { ref } from 'vue';

const props = defineProps<{
  providerId: string;
  providerName: string;
  contextSnippet: string;
}>();
const emit = defineEmits<{
  (e: 'submit', payload: { providerId: string; text: string }): void;
  (e: 'cancel'): void;
}>();

const followUp = ref('');

function submit() {
  if (!followUp.value.trim()) return;
  emit('submit', { providerId: props.providerId, text: followUp.value.trim() });
}
</script>

<template>
  <div class="bp-overlay" @click.self="emit('cancel')">
    <div class="bp-modal">
      <div class="bp-head">
        <span class="bp-title">追问 · {{ providerName }}</span>
        <button class="bp-close" type="button" @click="emit('cancel')">✕</button>
      </div>
      <div class="bp-body">
        <div class="bp-context">
          <div class="bp-context-label">此前回复</div>
          <div class="bp-context-text">{{ contextSnippet }}</div>
        </div>
        <textarea
          v-model="followUp"
          class="bp-input"
          rows="3"
          placeholder="输入你的追问…"
          @keydown.meta.enter="submit"
          @keydown.ctrl.enter="submit"
        />
        <div class="bp-hint muted">⌘+Enter 发送</div>
      </div>
      <div class="bp-foot">
        <button class="bp-btn" type="button" @click="emit('cancel')">取消</button>
        <button class="bp-btn bp-btn--primary" type="button" :disabled="!followUp.trim()" @click="submit">
          发送追问
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bp-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.35);
}
.bp-modal {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  width: min(480px, 90vw);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
}
.bp-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
}
.bp-title {
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--text);
}
.bp-close {
  background: none;
  border: none;
  font-size: 14px;
  color: var(--muted);
  cursor: pointer;
  padding: 2px 4px;
}
.bp-body {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}
.bp-context {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  background: var(--panel);
}
.bp-context-label {
  font-size: var(--fs-11);
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 4px;
}
.bp-context-text {
  font-size: var(--fs-11);
  color: var(--muted-light);
  line-height: 1.5;
  max-height: 80px;
  overflow-y: auto;
  word-break: break-word;
}
.bp-input {
  font-size: var(--fs-xs);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--panel);
  color: var(--text);
  padding: 8px 10px;
  resize: vertical;
  font-family: inherit;
  line-height: 1.5;
}
.bp-input:focus {
  outline: none;
  border-color: var(--primary);
}
.bp-hint {
  font-size: var(--fs-10);
  text-align: right;
}
.bp-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--border);
}
.bp-btn {
  font-size: var(--fs-xs);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 6px 12px;
  background: var(--panel);
  color: var(--text);
  cursor: pointer;
}
.bp-btn--primary {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}
.bp-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
