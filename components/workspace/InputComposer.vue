<script lang="ts" setup>
/**
 * M4 — InputComposer
 * 输入区：模型选择器 + textarea + 发送按钮
 */
import { ref, computed, watch, nextTick } from 'vue';
import ModelSelector from './ModelSelector.vue';
import type { ProviderConfig } from '@/modules/provider';

const props = defineProps<{
  providers: ProviderConfig[];
  selectedProviderIds: string[];
  disabled?: boolean;
  placeholder?: string;
}>();

const emit = defineEmits<{
  (e: 'update:selectedProviderIds', value: string[]): void;
  (e: 'send', payload: { text: string }): void;
  (e: 'abort'): void;
  (e: 'shortcut', payload: { type: 'roundtable' | 'relay' }): void;
}>();

const text = ref<string>('');
const textareaRef = ref<HTMLTextAreaElement | null>(null);

const isStreaming = computed(() => !!props.disabled);
const canSend = computed(() => text.value.trim().length > 0 && props.selectedProviderIds.length > 0 && !isStreaming.value);

function onSend() {
  if (!canSend.value) return;
  const value = text.value.trim();
  text.value = '';
  resetTextareaHeight();
  emit('send', { text: value });
}

function onAbort() {
  emit('abort');
}

function onKeydown(e: KeyboardEvent) {
  // Enter 发送，Shift+Enter 换行
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    onSend();
    return;
  }
  // Esc 中止
  if (e.key === 'Escape' && isStreaming.value) {
    e.preventDefault();
    onAbort();
  }
}

function onInput() {
  autoResize();
}

function autoResize() {
  const el = textareaRef.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 128) + 'px';
}

function resetTextareaHeight() {
  const el = textareaRef.value;
  if (!el) return;
  el.style.height = 'auto';
  nextTick(autoResize);
}

watch(
  () => props.disabled,
  () => {
    nextTick(autoResize);
  },
);

function updateSelected(ids: string[]) {
  emit('update:selectedProviderIds', ids);
}
</script>

<template>
  <div class="composer surface">
    <ModelSelector
      :providers="providers"
      :selected="selectedProviderIds"
      :disabled="isStreaming"
      @update:selected="updateSelected"
    />
    <div class="composer__row">
      <textarea
        ref="textareaRef"
        class="composer__textarea"
        v-model="text"
        :placeholder="placeholder || '输入问题，按 Enter 发送，Shift+Enter 换行'"
        :disabled="isStreaming"
        rows="1"
        @keydown="onKeydown"
        @input="onInput"
      />
      <div class="composer__actions">
        <button
          v-if="isStreaming"
          class="composer__btn composer__btn--abort"
          type="button"
          @click="onAbort"
          title="中止 (Esc)"
        >
          <span class="composer__btn-icon">⏹</span>
          <span class="composer__btn-text">Esc 中止</span>
        </button>
        <button
          v-else
          class="composer__btn composer__btn--send"
          type="button"
          :disabled="!canSend"
          @click="onSend"
        >
          <span class="composer__btn-icon">↑</span>
          <span class="composer__btn-text">发送</span>
        </button>
      </div>
    </div>
    <div class="composer__shortcuts muted">
      <button
        type="button"
        class="composer__shortcut"
        @click="emit('shortcut', { type: 'roundtable' })"
      >圆桌交锋</button>
      <span class="muted-light">·</span>
      <button
        type="button"
        class="composer__shortcut"
        @click="emit('shortcut', { type: 'relay' })"
      >串联接力</button>
    </div>
  </div>
</template>

<style scoped>
.composer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid var(--border);
  background: var(--panel);
  border-bottom-left-radius: var(--radius-xl);
  border-bottom-right-radius: var(--radius-xl);
}

.composer__row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.composer__textarea {
  flex: 1;
  min-height: 56px;
  max-height: 128px;
  resize: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 10px 12px;
  font-family: var(--font-sans);
  font-size: var(--fs-xs);
  line-height: 1.5;
  background: var(--bg);
  color: var(--text);
  outline: none;
  transition: border-color 100ms ease-out, box-shadow 100ms ease-out;
}

.composer__textarea:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 4px var(--primary-soft);
}

.composer__textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.composer__actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.composer__btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  font-size: var(--fs-11);
  font-weight: 700;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 100ms ease-out;
}

.composer__btn--send {
  background: var(--primary);
  color: white;
  box-shadow: 0 1px 2px rgba(91, 96, 229, 0.15);
}

.composer__btn--send:hover:not(:disabled) {
  background: var(--primary-strong);
}

.composer__btn--send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--muted-light);
}

.composer__btn--abort {
  background: var(--red-soft);
  color: var(--red);
  border-color: var(--red-soft);
}

.composer__btn--abort:hover {
  background: var(--red);
  color: white;
}

.composer__shortcuts {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--fs-10);
}

.composer__shortcut {
  background: transparent;
  border: 0;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
  color: var(--muted);
  font-size: var(--fs-10);
  font-weight: 600;
  cursor: pointer;
}

.composer__shortcut:hover {
  color: var(--primary);
}
</style>
