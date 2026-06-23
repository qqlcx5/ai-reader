<script lang="ts" setup>
/**
 * M6 — SnapshotViewer
 * 快照查看器：点击 HistoryItem 后懒加载副表，双 Tab 展示文章快照 + 对话历史
 * Tab 切换动画：opacity 150ms 淡入淡出
 * 严禁在列表渲染阶段提前加载副表（仅按 ID 懒加载）
 */
import { ref, watch } from 'vue'
import type { ConversationRecord, MessageRecord, ChatMessage } from '@/lib/db/types'
import { messageRepo } from '@/lib/db/repositories/message.repo'
import MarkdownRenderer from '@/components/chat/MarkdownRenderer.vue'
import MessageList, { type ChatTurn } from '@/components/chat/MessageList.vue'

type TabId = 'article' | 'chat'

const props = defineProps<{
  conversation: ConversationRecord | null
}>()

const emit = defineEmits<{
  (e: 'continue', pageId: string): void
  (e: 'close'): void
}>()

const activeTab = ref<TabId>('article')
const loading = ref(false)
const messageRecord = ref<MessageRecord | null>(null)

// Lazy-load副表 only when conversation changes
watch(
  () => props.conversation?.id,
  async (newId) => {
    if (!newId) {
      messageRecord.value = null
      return
    }
    loading.value = true
    messageRecord.value = null
    try {
      messageRecord.value = await messageRepo.loadById(newId) ?? null
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

// Convert chatHistory to ChatTurn[] for MessageList
function toChatTurns(history: ChatMessage[]): ChatTurn[] {
  return history.map((msg) => ({
    id: msg.id,
    role: msg.role as 'user' | 'assistant' | 'system',
    content: msg.content,
    timestamp: msg.timestamp,
    slots: msg.role === 'assistant'
      ? [{ engineId: msg.model ?? 'unknown', model: msg.model ?? 'unknown', text: msg.content, done: true, error: null, ttft: msg.ttft, tps: msg.tps, cost: msg.cost }]
      : undefined,
  }))
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return dateStr
  }
}
</script>

<template>
  <div class="snapshot-viewer">
    <!-- Empty state -->
    <div v-if="!conversation" class="snapshot-viewer__placeholder">
      <span class="snapshot-viewer__placeholder-icon" aria-hidden="true">📄</span>
      <p>点击左侧记录查看详情</p>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="snapshot-viewer__header">
        <div class="snapshot-viewer__info">
          <img
            v-if="conversation.favicon"
            class="snapshot-viewer__favicon"
            :src="conversation.favicon"
            :alt="conversation.domain"
            @error="($event.target as HTMLImageElement).style.display = 'none'"
          />
          <div class="snapshot-viewer__title-wrap">
            <div class="snapshot-viewer__title">{{ conversation.title }}</div>
            <a
              class="snapshot-viewer__url"
              :href="conversation.url"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ conversation.url }}
            </a>
          </div>
        </div>
        <button class="snapshot-viewer__close" aria-label="关闭查看器" @click="emit('close')">✕</button>
      </div>

      <!-- Tab bar -->
      <div class="snapshot-viewer__tabs" role="tablist">
        <button
          class="snapshot-viewer__tab"
          :class="{ 'snapshot-viewer__tab--active': activeTab === 'article' }"
          role="tab"
          :aria-selected="activeTab === 'article'"
          @click="activeTab = 'article'"
        >
          文章快照
        </button>
        <button
          class="snapshot-viewer__tab"
          :class="{ 'snapshot-viewer__tab--active': activeTab === 'chat' }"
          role="tab"
          :aria-selected="activeTab === 'chat'"
          @click="activeTab = 'chat'"
        >
          对话历史
          <span
            v-if="conversation.messageCount > 0"
            class="snapshot-viewer__tab-badge"
          >
            {{ conversation.messageCount }}
          </span>
        </button>
      </div>

      <!-- Loading skeleton -->
      <div v-if="loading" class="snapshot-viewer__skeleton-wrap" aria-label="加载中...">
        <div class="snapshot-viewer__skeleton snapshot-viewer__skeleton--lg" />
        <div class="snapshot-viewer__skeleton snapshot-viewer__skeleton--md" />
        <div class="snapshot-viewer__skeleton snapshot-viewer__skeleton--sm" />
        <div class="snapshot-viewer__skeleton snapshot-viewer__skeleton--md" />
        <div class="snapshot-viewer__skeleton snapshot-viewer__skeleton--lg" />
      </div>

      <!-- Tab panels with opacity transition -->
      <Transition name="tab-fade" mode="out-in">
        <!-- Tab 1: Article snapshot -->
        <div
          v-if="!loading && activeTab === 'article'"
          key="article"
          class="snapshot-viewer__panel"
          role="tabpanel"
          aria-label="文章快照"
        >
          <!-- Metadata bar -->
          <div v-if="messageRecord?.metadata" class="snapshot-viewer__meta">
            <div v-if="messageRecord.metadata.author" class="snapshot-viewer__meta-row">
              <span class="snapshot-viewer__meta-label">作者</span>
              <span class="snapshot-viewer__meta-value">{{ messageRecord.metadata.author }}</span>
            </div>
            <div v-if="messageRecord.metadata.published" class="snapshot-viewer__meta-row">
              <span class="snapshot-viewer__meta-label">发布时间</span>
              <span class="snapshot-viewer__meta-value">{{ formatDate(messageRecord.metadata.published) }}</span>
            </div>
            <div class="snapshot-viewer__meta-row">
              <span class="snapshot-viewer__meta-label">来源</span>
              <a
                class="snapshot-viewer__meta-link"
                :href="conversation.url"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ conversation.domain }}
              </a>
            </div>
            <div v-if="messageRecord.metadata.description" class="snapshot-viewer__meta-row snapshot-viewer__meta-row--desc">
              <span class="snapshot-viewer__meta-value snapshot-viewer__meta-value--desc">
                {{ messageRecord.metadata.description }}
              </span>
            </div>
          </div>

          <!-- Article content (Markdown) -->
          <div class="snapshot-viewer__article">
            <MarkdownRenderer
              v-if="messageRecord?.rawText"
              :content="messageRecord.rawText"
              :done="true"
            />
            <div v-else class="snapshot-viewer__no-content">
              未找到文章快照内容
            </div>
          </div>
        </div>

        <!-- Tab 2: Chat history -->
        <div
          v-else-if="!loading && activeTab === 'chat'"
          key="chat"
          class="snapshot-viewer__panel"
          role="tabpanel"
          aria-label="对话历史"
        >
          <MessageList
            v-if="messageRecord && messageRecord.chatHistory.length > 0"
            :turns="toChatTurns(messageRecord.chatHistory.filter(m => m.role !== 'system'))"
            :show-summary-card="false"
          />
          <div v-else class="snapshot-viewer__no-content">
            该页面暂无对话记录
          </div>

          <!-- Continue conversation button -->
          <div class="snapshot-viewer__continue-bar">
            <button
              class="snapshot-viewer__continue-btn"
              @click="emit('continue', conversation.id)"
            >
              继续对话 →
            </button>
          </div>
        </div>
      </Transition>
    </template>
  </div>
</template>

<style scoped>
.snapshot-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--panel, #fff);
}

/* Placeholder */
.snapshot-viewer__placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--muted, #7a7568);
  font-size: 13px;
}

.snapshot-viewer__placeholder-icon {
  font-size: 40px;
  opacity: 0.5;
}

/* Header */
.snapshot-viewer__header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  background: var(--card, #faf9f5);
  border-bottom: 1px solid var(--border, #e6e2d8);
  flex-shrink: 0;
}

.snapshot-viewer__info {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.snapshot-viewer__favicon {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  flex-shrink: 0;
  object-fit: contain;
  margin-top: 2px;
}

.snapshot-viewer__title-wrap {
  flex: 1;
  min-width: 0;
}

.snapshot-viewer__title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text, #2e2d2a);
  line-height: 1.4;
  word-break: break-word;
}

.snapshot-viewer__url {
  font-size: 10px;
  color: var(--muted, #7a7568);
  text-decoration: none;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.snapshot-viewer__url:hover {
  color: var(--primary, #5b60e5);
  text-decoration: underline;
}

.snapshot-viewer__close {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--muted, #7a7568);
  background: transparent;
  border: none;
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.snapshot-viewer__close:hover {
  background: var(--border, #e6e2d8);
  color: var(--text, #2e2d2a);
}

/* Tabs */
.snapshot-viewer__tabs {
  display: flex;
  border-bottom: 1px solid var(--border, #e6e2d8);
  background: var(--panel, #fff);
  flex-shrink: 0;
}

.snapshot-viewer__tab {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 9px 16px;
  font-size: 12px;
  font-weight: 700;
  color: var(--muted, #7a7568);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 0.12s, border-color 0.12s;
}

.snapshot-viewer__tab:hover {
  color: var(--text, #2e2d2a);
}

.snapshot-viewer__tab--active {
  color: var(--primary, #5b60e5);
  border-bottom-color: var(--primary, #5b60e5);
}

.snapshot-viewer__tab-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: var(--radius-pill, 999px);
  background: var(--primary-soft, #eef0ff);
  color: var(--primary, #5b60e5);
}

/* Skeleton */
.snapshot-viewer__skeleton-wrap {
  flex: 1;
  padding: 20px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.snapshot-viewer__skeleton {
  border-radius: var(--radius-md, 8px);
  background: linear-gradient(90deg, var(--card, #faf9f5) 25%, var(--border, #e6e2d8) 50%, var(--card, #faf9f5) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}

.snapshot-viewer__skeleton--lg { height: 18px; width: 90%; }
.snapshot-viewer__skeleton--md { height: 14px; width: 70%; }
.snapshot-viewer__skeleton--sm { height: 14px; width: 50%; }

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Tab panels */
.snapshot-viewer__panel {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar, #dedad0) transparent;
}

.snapshot-viewer__panel::-webkit-scrollbar {
  width: 4px;
}

.snapshot-viewer__panel::-webkit-scrollbar-thumb {
  background: var(--scrollbar, #dedad0);
  border-radius: 2px;
}

/* Metadata bar */
.snapshot-viewer__meta {
  background: var(--card, #faf9f5);
  border-bottom: 1px solid var(--border, #e6e2d8);
  padding: 10px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
}

.snapshot-viewer__meta-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.snapshot-viewer__meta-row--desc {
  margin-top: 4px;
}

.snapshot-viewer__meta-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--muted, #7a7568);
  min-width: 56px;
  flex-shrink: 0;
}

.snapshot-viewer__meta-value {
  font-size: 11px;
  color: var(--text, #2e2d2a);
}

.snapshot-viewer__meta-value--desc {
  font-size: 11px;
  color: var(--muted, #7a7568);
  line-height: 1.5;
}

.snapshot-viewer__meta-link {
  font-size: 11px;
  color: var(--primary, #5b60e5);
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* Article content */
.snapshot-viewer__article {
  flex: 1;
  padding: 16px 18px;
}

/* Continue bar */
.snapshot-viewer__continue-bar {
  padding: 12px 16px;
  border-top: 1px solid var(--border, #e6e2d8);
  background: var(--panel, #fff);
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
}

.snapshot-viewer__continue-btn {
  padding: 8px 20px;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  background: var(--primary, #5b60e5);
  border: none;
  border-radius: var(--radius-lg, 10px);
  cursor: pointer;
  transition: background 0.12s;
  box-shadow: 0 2px 8px rgba(91, 96, 229, 0.25);
}

.snapshot-viewer__continue-btn:hover {
  background: var(--primary-strong, #4347c7);
}

.snapshot-viewer__no-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--muted, #7a7568);
  font-style: italic;
  padding: 32px;
}

/* Tab fade transition */
.tab-fade-enter-active,
.tab-fade-leave-active {
  transition: opacity 0.15s ease;
}

.tab-fade-enter-from,
.tab-fade-leave-to {
  opacity: 0;
}
</style>
