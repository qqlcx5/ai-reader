<!--
  ChatPage.vue

  The Chat with Doc surface: a model selector, document
  summary, message list, and composer. State is owned by
  `useChatStore`; this component is a (mostly) dumb view on top.
-->
<template>
  <div class="chat-page h-full flex">
    <!-- History rail -->
    <aside
      v-if="showHistory"
      class="chat-page__history w-56 border-r border-surface-200 dark:border-surface-700 flex flex-col bg-white dark:bg-surface-800"
    >
      <div class="p-3 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
        <span class="text-sm font-medium text-surface-700 dark:text-surface-200">会话历史</span>
        <button
          class="text-xs text-primary-500 hover:text-primary-600"
          @click="newSession"
        >
          + 新建
        </button>
      </div>
      <div class="flex-1 overflow-y-auto">
        <div
          v-if="chatStore.sessions.length === 0"
          class="p-3 text-xs text-surface-400"
        >
          还没有会话
        </div>
        <button
          v-for="s in chatStore.sessions"
          :key="s.id"
          class="w-full text-left p-3 text-sm border-b border-surface-100 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-700"
          :class="s.id === chatStore.currentSessionId ? 'bg-primary-50 dark:bg-primary-900/30' : ''"
          @click="selectSession(s.id)"
        >
          <div class="font-medium text-surface-800 dark:text-surface-100 truncate">
            {{ sessionTitle(s) }}
          </div>
          <div class="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
            {{ s.messages.length }} 条消息 · {{ formatRelativeTime(s.updatedAt) }}
          </div>
        </button>
      </div>
    </aside>

    <!-- Main column -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Top bar: model + document summary + actions -->
      <div
        class="chat-page__topbar px-3 py-2 border-b border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 flex items-center gap-2"
      >
        <button
          class="p-1.5 rounded text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-700"
          :title="showHistory ? '隐藏历史' : '显示历史'"
          @click="showHistory = !showHistory"
        >
          <History class="w-4 h-4" />
        </button>

        <ModelSelector
          v-if="modelStore.models.length > 0"
          v-model="modelId"
          class="text-xs"
        />

        <div class="flex-1 min-w-0">
          <div
            v-if="chatStore.currentDocument"
            class="text-xs text-surface-600 dark:text-surface-300 truncate"
            :title="chatStore.currentDocument.title"
          >
            {{ chatStore.currentDocument.title }}
          </div>
          <div v-else class="text-xs text-surface-400">未选择文档</div>
        </div>

        <button
          v-if="chatStore.currentSessionId"
          class="p-1.5 rounded text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-700"
          title="新建会话"
          @click="newSession"
        >
          <Plus class="w-4 h-4" />
        </button>
        <button
          v-if="chatStore.currentSessionId"
          class="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
          title="删除当前会话"
          @click="deleteCurrentSession"
        >
          <Trash2 class="w-4 h-4" />
        </button>
        <button
          class="p-1.5 rounded text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-700"
          :title="showSystemPrompt ? '隐藏系统提示词' : '查看系统提示词'"
          @click="showSystemPrompt = !showSystemPrompt"
        >
          <Eye class="w-4 h-4" />
        </button>
      </div>

      <!-- Collapsible system prompt preview -->
      <details
        v-if="showSystemPrompt"
        class="chat-page__system-prompt border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800"
        open
      >
        <summary class="px-3 py-2 text-xs font-medium text-surface-600 dark:text-surface-300 cursor-pointer">
          系统提示词
        </summary>
        <pre class="px-3 pb-3 text-xs text-surface-600 dark:text-surface-300 whitespace-pre-wrap font-mono leading-relaxed">{{ resolvedSystemPrompt || '(使用全局默认提示词)' }}</pre>
      </details>

      <!-- Messages -->
      <div
        ref="messagesContainer"
        class="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-surface-50 dark:bg-surface-900"
      >
        <div
          v-if="chatStore.currentMessages.length === 0 && chatStore.currentDocument"
          class="text-center text-sm text-surface-400 py-8"
        >
          <Sparkles class="w-6 h-6 mx-auto mb-2" />
          <p>问点什么吧 — 我已经读完了这篇文档。</p>
        </div>
        <div
          v-else-if="!chatStore.currentDocument"
          class="text-center text-sm text-surface-400 py-8"
        >
          请先在网页上点击浮动按钮捕获一篇文档。
        </div>

        <ChatMessageBubble
          v-for="m in chatStore.currentMessages"
          :key="m.id"
          :message="m"
        />
        <div v-if="chatStore.streaming" class="flex items-center gap-2 text-xs text-surface-400 px-2">
          <span class="inline-block w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
          <span class="inline-block w-2 h-2 bg-primary-500 rounded-full animate-pulse" style="animation-delay: 150ms" />
          <span class="inline-block w-2 h-2 bg-primary-500 rounded-full animate-pulse" style="animation-delay: 300ms" />
          <span>正在思考…</span>
        </div>
      </div>

      <!-- Error -->
      <div
        v-if="chatStore.error"
        class="px-3 py-2 text-xs bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-t border-red-200 dark:border-red-800"
      >
        {{ chatStore.error }}
        <button class="ml-2 underline" @click="chatStore.error = null">关闭</button>
      </div>

      <!-- Composer -->
      <div class="border-t border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-3">
        <div class="flex gap-2 items-end">
          <textarea
            ref="composerEl"
            v-model="input"
            :placeholder="composerPlaceholder"
            :disabled="!chatStore.currentDocument"
            :maxlength="MAX_MESSAGE_LENGTH"
            rows="1"
            class="chat-page__composer flex-1 resize-none max-h-32 px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-surface-50 dark:bg-surface-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
            @keydown="onComposerKeydown"
            @input="autoGrow"
          />
          <button
            v-if="chatStore.streaming"
            class="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm"
            @click="chatStore.abort()"
          >
            <Square class="w-4 h-4" />
          </button>
          <button
            v-else
            :disabled="!canSend"
            class="px-3 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            @click="send"
          >
            <Send class="w-4 h-4" />
          </button>
        </div>
        <div class="text-[10px] text-surface-400 mt-1 text-right">
          {{ input.length }} / {{ MAX_MESSAGE_LENGTH }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import { History, Plus, Trash2, Send, Square, Sparkles, Eye } from '@lucide/vue'
import ModelSelector from '@components/ModelSelector.vue'
import ChatMessageBubble from './ChatMessageBubble.vue'
import { useChatStore } from '@core/chat/store'
import { useModelStore } from '@core/models/store'
import type { CapturedDocument, ChatHistory } from '@db/schema'
import { formatRelativeTime } from '@shared/utils'
import { MAX_MESSAGE_LENGTH } from '@shared/constants'

const props = defineProps<{
  currentDocument?: CapturedDocument | null
}>()

const chatStore = useChatStore()
const modelStore = useModelStore()
const input = ref('')
const composerEl = ref<HTMLTextAreaElement | null>(null)
const messagesContainer = ref<HTMLElement | null>(null)
const showHistory = ref(true)
const showSystemPrompt = ref(false)

const modelId = computed({
  get: () => chatStore.activeModelId ?? modelStore.defaultModel?.id ?? '',
  set: (v: string) => chatStore.setActiveModel(v || null),
})

const resolvedSystemPrompt = computed(() =>
  chatStore.activeModelId
    ? modelStore.getModelPrompt(chatStore.activeModelId) || modelStore.settings.defaultSystemPrompt
    : modelStore.settings.defaultSystemPrompt
)

const composerPlaceholder = computed(() => {
  if (!chatStore.currentDocument) return '请先选择文档…'
  return '向文档提问… (Enter 发送，Shift+Enter 换行)'
})

const canSend = computed(
  () => !!input.value.trim() && input.value.length <= MAX_MESSAGE_LENGTH && !chatStore.streaming
)

function autoGrow() {
  const el = composerEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 128)}px`
}

function onComposerKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

async function send() {
  if (!canSend.value) return
  const text = input.value.trim()
  input.value = ''
  autoGrow()
  await chatStore.sendMessage(text)
}

function newSession() {
  const doc = chatStore.currentDocument ?? props.currentDocument
  if (!doc) return
  chatStore.startNewSession(doc.id, modelId.value || undefined)
}

function selectSession(id: string) {
  chatStore.selectSession(id)
}

async function deleteCurrentSession() {
  const id = chatStore.currentSessionId
  if (!id) return
  if (!confirm('确定要删除这个会话吗？')) return
  await chatStore.deleteSession(id)
}

function sessionTitle(s: ChatHistory): string {
  const firstUser = s.messages.find((m) => m.role === 'user')
  if (firstUser) return firstUser.content.slice(0, 40)
  return `会话 ${s.id.slice(-6)}`
}

function scrollToBottom() {
  const el = messagesContainer.value
  if (!el) return
  el.scrollTop = el.scrollHeight
}

// React to incoming documents.
watch(
  () => props.currentDocument,
  (doc) => {
    if (!doc) return
    chatStore.setCurrentDocument(doc)
    void chatStore.loadForDocument(doc.id).then(() => {
      if (chatStore.sessions.length > 0) {
        chatStore.selectSession(chatStore.sessions[0].id)
      } else {
        chatStore.startNewSession(doc.id, modelId.value || undefined)
      }
    })
  },
  { immediate: true }
)

watch(
  () => chatStore.currentMessages.length,
  () => nextTick(scrollToBottom)
)
watch(
  () => chatStore.streamingContent,
  () => nextTick(scrollToBottom)
)

onMounted(async () => {
  chatStore.attachStreamListeners()
  if (modelStore.models.length === 0) {
    await modelStore.loadAll()
  }
  await nextTick()
  composerEl.value?.focus()
})

onBeforeUnmount(() => {
  chatStore.detachStreamListeners()
})
</script>

<style scoped>
.chat-page__system-prompt summary {
  list-style: none;
}
.chat-page__system-prompt summary::-webkit-details-marker {
  display: none;
}
.chat-page__composer {
  font-family: inherit;
  line-height: 1.4;
}
</style>
