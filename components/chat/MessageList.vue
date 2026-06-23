<script lang="ts" setup>
/**
 * M4 — MessageList
 * overflow-y-auto 滚动区，新消息自动 scrollIntoView。
 * 第一条系统消息为 PageSummaryCard，其余按 role 渲染 UserBubble 或 ModelGrid。
 */
import { ref, watch, nextTick } from 'vue'
import UserBubble from './UserBubble.vue'
import ModelGrid from './ModelGrid.vue'
import PageSummaryCard from './PageSummaryCard.vue'
import type { ProviderSlot } from '@/stores/arena.store'
import type { ExtractionResult } from '@/lib/db/types'

export interface ChatTurn {
  id: string
  role: 'user' | 'assistant' | 'system'
  content?: string
  timestamp?: number
  /** assistant 专用：各 Provider 的流式 slot */
  slots?: ProviderSlot[]
}

const props = defineProps<{
  turns: ChatTurn[]
  extraction?: ExtractionResult | null
  showSummaryCard?: boolean
}>()

const emit = defineEmits<{
  (e: 'delete-message', payload: { id: string }): void
  (e: 'edit-message', payload: { id: string; newContent: string }): void
  (e: 'continue', payload: { engineId: string }): void
  (e: 'abort', payload: { engineId: string }): void
  (e: 'retry', payload: { engineId: string }): void
}>()

const listRef = ref<HTMLDivElement | null>(null)
const bottomRef = ref<HTMLDivElement | null>(null)

function scrollToBottom(): void {
  nextTick(() => {
    bottomRef.value?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  })
}

// 每次新增消息时自动滚动
watch(
  () => props.turns.length,
  () => scrollToBottom(),
)

// 监听最后一条消息内容变化（流式追加时）
watch(
  () => {
    const last = props.turns[props.turns.length - 1]
    if (!last) return ''
    if (last.role === 'assistant' && last.slots) {
      return last.slots.map((s) => s.text).join('')
    }
    return last.content ?? ''
  },
  () => scrollToBottom(),
)
</script>

<template>
  <div ref="listRef" class="message-list">
    <!-- 页面摘要卡片（对话第一条） -->
    <PageSummaryCard
      v-if="showSummaryCard && extraction"
      :title="extraction.title"
      :url="extraction.url"
      :favicon="extraction.favicon"
      :word-count="extraction.wordCount"
      :engine="extraction.engine"
      :raw-text="extraction.rawText"
      :markdown-text="extraction.markdownText"
    />

    <!-- 消息列表 -->
    <template v-for="turn in turns" :key="turn.id">
      <!-- 用户消息 -->
      <UserBubble
        v-if="turn.role === 'user'"
        :content="turn.content || ''"
        :timestamp="turn.timestamp"
        @delete="emit('delete-message', { id: turn.id })"
        @edit="(payload) => emit('edit-message', { id: turn.id, newContent: payload.newContent })"
      />

      <!-- 助手消息：模型网格 -->
      <ModelGrid
        v-else-if="turn.role === 'assistant' && turn.slots"
        :slots="turn.slots"
        @continue="(p) => emit('continue', p)"
        @abort="(p) => emit('abort', p)"
        @retry="(p) => emit('retry', p)"
      />
    </template>

    <!-- 底部锚点：自动滚动目标 -->
    <div ref="bottomRef" class="message-list__bottom" aria-hidden="true"></div>

    <!-- 空态 -->
    <div v-if="turns.length === 0 && !showSummaryCard" class="message-list__empty">
      还没有消息，发送第一条提问开始吧。
    </div>
  </div>
</template>

<style scoped>
.message-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding-bottom: 8px;

  /* 自定义滚动条 */
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar, #dedad0) transparent;
}

.message-list::-webkit-scrollbar {
  width: 4px;
}

.message-list::-webkit-scrollbar-thumb {
  background: var(--scrollbar, #dedad0);
  border-radius: 2px;
}

.message-list__bottom {
  height: 1px;
  flex-shrink: 0;
}

.message-list__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--muted, #7a7568);
  font-style: italic;
  padding: 32px;
}
</style>
