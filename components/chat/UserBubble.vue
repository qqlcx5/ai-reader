<script lang="ts" setup>
/**
 * M4 — UserBubble
 * 用户消息气泡：白色 + border + rounded-2xl rounded-tr-sm，最大宽度 78%，右对齐。
 * hover 出现删除按钮，双击进入 contenteditable 编辑模式。
 */
import { ref, nextTick } from 'vue'

const props = defineProps<{
  content: string
  timestamp?: number
}>()

const emit = defineEmits<{
  (e: 'delete'): void
  (e: 'edit', payload: { newContent: string }): void
}>()

const isEditing = ref(false)
const editRef = ref<HTMLDivElement | null>(null)

function formatTime(ts?: number): string {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

async function startEdit(): Promise<void> {
  isEditing.value = true
  await nextTick()
  if (editRef.value) {
    editRef.value.focus()
    // 将光标移到末尾
    const range = document.createRange()
    range.selectNodeContents(editRef.value)
    range.collapse(false)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }
}

function saveEdit(): void {
  if (!editRef.value) return
  const newContent = editRef.value.innerText.trim()
  if (newContent && newContent !== props.content) {
    emit('edit', { newContent })
  }
  isEditing.value = false
}

function cancelEdit(): void {
  isEditing.value = false
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    saveEdit()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    cancelEdit()
  }
}
</script>

<template>
  <div class="user-bubble-wrapper">
    <div class="user-bubble__row">
      <div class="user-bubble__spacer"></div>
      <div
        class="user-bubble group"
        @dblclick="startEdit"
      >
        <!-- 编辑模式 -->
        <div
          v-if="isEditing"
          ref="editRef"
          class="user-bubble__edit"
          contenteditable="true"
          :data-placeholder="content"
          @keydown="onKeydown"
          @blur="saveEdit"
        >{{ content }}</div>
        <!-- 显示模式 -->
        <p v-else class="user-bubble__text">{{ content }}</p>
        <!-- 编辑模式操作 -->
        <div v-if="isEditing" class="user-bubble__edit-actions">
          <button class="user-bubble__save-btn" type="button" @click="saveEdit">保存</button>
          <button class="user-bubble__cancel-btn" type="button" @click="cancelEdit">取消</button>
        </div>
        <!-- hover 删除按钮 -->
        <button
          v-if="!isEditing"
          class="user-bubble__delete"
          type="button"
          title="删除此消息"
          @click.stop="emit('delete')"
        >✕</button>
      </div>
    </div>
    <div v-if="timestamp" class="user-bubble__time">{{ formatTime(timestamp) }}</div>
  </div>
</template>

<style scoped>
.user-bubble-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding: 4px 12px;
  gap: 2px;
}

.user-bubble__row {
  display: flex;
  align-items: flex-start;
  width: 100%;
  gap: 8px;
}

.user-bubble__spacer {
  flex: 1;
}

.user-bubble {
  position: relative;
  max-width: 78%;
  background: var(--panel, #ffffff);
  border: 1px solid var(--border, #e6e2d8);
  border-radius: 16px 6px 16px 16px;
  padding: 10px 14px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.user-bubble__text {
  font-size: var(--fs-xs, 12px);
  color: var(--text, #2e2d2a);
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.user-bubble__time {
  font-size: 10px;
  color: var(--muted-light, #a39d8f);
  padding-right: 4px;
}

/* 删除按钮：默认不可见，hover 时出现 */
.user-bubble__delete {
  position: absolute;
  top: -8px;
  left: -8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--red, #d14343);
  color: white;
  border: none;
  cursor: pointer;
  font-size: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 150ms ease-out;
  z-index: 1;
}

.user-bubble:hover .user-bubble__delete {
  opacity: 1;
}

/* 编辑模式 */
.user-bubble__edit {
  min-width: 120px;
  min-height: 1.6em;
  outline: none;
  font-size: var(--fs-xs, 12px);
  line-height: 1.6;
  color: var(--text, #2e2d2a);
  white-space: pre-wrap;
  word-break: break-word;
  border-bottom: 1px dashed var(--primary, #5b60e5);
  padding-bottom: 2px;
}

.user-bubble__edit-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  justify-content: flex-end;
}

.user-bubble__save-btn,
.user-bubble__cancel-btn {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid var(--border, #e6e2d8);
}

.user-bubble__save-btn {
  background: var(--primary, #5b60e5);
  color: white;
  border-color: transparent;
}

.user-bubble__cancel-btn {
  background: var(--panel, #fff);
  color: var(--muted, #7a7568);
}
</style>
