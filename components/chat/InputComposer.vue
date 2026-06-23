<script lang="ts" setup>
/**
 * M4 — InputComposer
 * ModelRouteChips + 文本域（min 56px / max 128px）+ 发送按钮 + 中断按钮 + QuickPromptBar
 */
import { ref, computed, watch, nextTick } from 'vue'
import ModelRouteChips from './ModelRouteChips.vue'
import QuickPromptBar from './QuickPromptBar.vue'
import type { ProviderOption } from './ModelRouteChips.vue'

const props = defineProps<{
  providers: ProviderOption[]
  selectedProviderIds: string[]
  disabled?: boolean
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'update:selectedProviderIds', value: string[]): void
  (e: 'send', payload: { text: string }): void
  (e: 'abort'): void
  (e: 'shortcut', payload: { type: 'roundtable' | 'relay' }): void
}>()

const text = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const isStreaming = computed(() => !!props.disabled)
const canSend = computed(
  () => text.value.trim().length > 0 && props.selectedProviderIds.length > 0 && !isStreaming.value,
)

function onSend(): void {
  if (!canSend.value) return
  const value = text.value.trim()
  text.value = ''
  resetHeight()
  emit('send', { text: value })
}

function onAbort(): void {
  emit('abort')
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    onSend()
  } else if (e.key === 'Escape' && isStreaming.value) {
    e.preventDefault()
    onAbort()
  }
}

function onInput(): void {
  autoResize()
}

function autoResize(): void {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 128)}px`
}

function resetHeight(): void {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  nextTick(autoResize)
}

function handleQuickPrompt(payload: { prompt: string; autoSend?: boolean }): void {
  text.value = payload.prompt
  nextTick(() => {
    autoResize()
    textareaRef.value?.focus()
  })
  if (payload.autoSend) {
    onSend()
  }
}

watch(
  () => props.disabled,
  () => nextTick(autoResize),
)
</script>

<template>
  <div class="composer">
    <!-- 模型路由选择器 -->
    <ModelRouteChips
      :providers="providers"
      :selected="selectedProviderIds"
      :disabled="isStreaming"
      @update:selected="(v) => emit('update:selectedProviderIds', v)"
    />

    <!-- 输入行 -->
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
      <div class="composer__btns">
        <button
          v-if="isStreaming"
          class="composer__btn composer__btn--abort"
          type="button"
          title="中断（Esc）"
          @click="onAbort"
        >
          ⎋ Esc
        </button>
        <button
          v-else
          class="composer__btn composer__btn--send"
          type="button"
          :disabled="!canSend"
          @click="onSend"
        >
          ↑ 发送
        </button>
      </div>
    </div>

    <!-- 快捷指令栏 -->
    <QuickPromptBar
      @quick-prompt="handleQuickPrompt"
      @shortcut="(p) => emit('shortcut', p)"
    />
  </div>
</template>

<style scoped>
.composer {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-top: 1px solid var(--border, #e6e2d8);
  background: var(--panel, #ffffff);
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
}

.composer__row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 8px 12px;
}

.composer__textarea {
  flex: 1;
  min-height: 56px;
  max-height: 128px;
  resize: none;
  border: 1px solid var(--border, #e6e2d8);
  border-radius: 12px;
  padding: 10px 12px;
  font-family: var(--font-sans, sans-serif);
  font-size: 12px;
  line-height: 1.55;
  background: var(--bg, #fcfcf9);
  color: var(--text, #2e2d2a);
  outline: none;
  transition: border-color 100ms ease-out, box-shadow 100ms ease-out;
}

.composer__textarea:focus {
  border-color: rgba(91, 96, 229, 0.5);
  box-shadow: 0 0 0 4px rgba(91, 96, 229, 0.08);
}

.composer__textarea:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.composer__btns {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.composer__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 700;
  border-radius: 12px;
  border: 1px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  transition: all 100ms ease-out;
}

.composer__btn--send {
  background: var(--primary, #5b60e5);
  color: white;
  box-shadow: 0 1px 3px rgba(91, 96, 229, 0.2);
}

.composer__btn--send:hover:not(:disabled) {
  background: #4a4fc9;
}

.composer__btn--send:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  background: var(--muted-light, #a39d8f);
  box-shadow: none;
}

.composer__btn--abort {
  background: var(--red-soft, #fdf4f4);
  color: var(--red, #d14343);
  border-color: #f5c2c2;
}

.composer__btn--abort:hover {
  background: var(--red, #d14343);
  color: white;
}
</style>
