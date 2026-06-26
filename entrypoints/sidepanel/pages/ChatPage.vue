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
      class="chat-page__history w-56 border-r border-slate-200 dark:border-slate-700 flex flex-col bg-white dark:bg-slate-800"
    >
      <div class="p-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <span class="text-sm font-medium text-slate-700 dark:text-slate-200">会话历史</span>
        <BaseButton
          variant="ghost"
          size="sm"
          @click="newSession"
        >
          + 新建
        </BaseButton>
      </div>
      <div class="flex-1 overflow-y-auto">
        <div
          v-if="chatStore.sessions.length === 0"
          class="p-3 text-xs text-slate-400"
        >
          还没有会话
        </div>
        <BaseButton
          v-for="s in chatStore.sessions"
          :key="s.id"
          variant="ghost"
          class="w-full text-left p-3 text-sm border-b border-slate-100 dark:border-slate-700 justify-start rounded-none"
          :class="s.id === chatStore.currentSessionId ? '!bg-brand-50 dark:!bg-brand-900/30' : ''"
          @click="selectSession(s.id)"
        >
          <div class="w-full">
            <div class="font-medium text-slate-800 dark:text-slate-100 truncate">
              {{ sessionTitle(s) }}
            </div>
            <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {{ s.messages.length }} 条消息 · {{ formatRelativeTime(s.updatedAt) }}
            </div>
          </div>
        </BaseButton>
      </div>
    </aside>

    <!-- Main column -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Top bar: model + document summary + actions -->
      <div
        class="chat-page__topbar px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center gap-2"
      >
        <BaseButton
          variant="ghost"
          size="sm"
          :title="showHistory ? '隐藏历史' : '显示历史'"
          @click="showHistory = !showHistory"
        >
          <History class="w-4 h-4" />
        </BaseButton>

        <ModelSelector
          v-if="modelStore.models.length > 0"
          v-model="modelId"
          class="text-xs"
        />

        <div class="flex-1 min-w-0">
          <div
            v-if="chatStore.currentDocument"
            class="text-xs text-slate-600 dark:text-slate-300 truncate"
            :title="chatStore.currentDocument.title"
          >
            {{ chatStore.currentDocument.title }}
          </div>
          <div v-else class="text-xs text-slate-400">未选择文档</div>
        </div>

        <BaseButton
          v-if="chatStore.currentSessionId"
          variant="ghost"
          size="sm"
          title="新建会话"
          @click="newSession"
        >
          <Plus class="w-4 h-4" />
        </BaseButton>
        <BaseButton
          v-if="chatStore.currentSessionId"
          variant="ghost"
          size="sm"
          class="!text-red-500 hover:!bg-red-50 dark:hover:!bg-red-900/30"
          title="删除当前会话"
          @click="deleteCurrentSession"
        >
          <Trash2 class="w-4 h-4" />
        </BaseButton>
        <BaseButton
          variant="ghost"
          size="sm"
          :title="showSystemPrompt ? '隐藏系统提示词' : '查看系统提示词'"
          @click="showSystemPrompt = !showSystemPrompt"
        >
          <Eye class="w-4 h-4" />
        </BaseButton>
      </div>

      <!-- Collapsible system prompt preview -->
      <details
        v-if="showSystemPrompt"
        class="chat-page__system-prompt border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
        open
      >
        <summary class="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
          系统提示词
        </summary>
        <pre class="px-3 pb-3 text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{{ resolvedSystemPrompt || '(使用全局默认提示词)' }}</pre>
      </details>

      <!-- Messages -->
      <div
        ref="messagesContainer"
        class="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-slate-50 dark:bg-slate-900"
      >
        <div
          v-if="chatStore.currentMessages.length === 0 && chatStore.currentDocument"
          class="text-center text-sm text-slate-400 py-8"
        >
          <Sparkles class="w-6 h-6 mx-auto mb-2" />
          <p>问点什么吧 — 我已经读完了这篇文档。</p>
        </div>
        <div
          v-else-if="!chatStore.currentDocument"
          class="text-center text-sm text-slate-400 py-8"
        >
          请先在网页上点击浮动按钮捕获一篇文档。
        </div>

        <ChatMessageBubble
          v-for="m in chatStore.currentMessages"
          :key="m.id"
          :message="m"
        />
        <div v-if="chatStore.streaming" class="flex items-center gap-2 text-xs text-slate-400 px-2">
          <span class="inline-block w-2 h-2 bg-brand-500 rounded-full animate-pulse" />
          <span class="inline-block w-2 h-2 bg-brand-500 rounded-full animate-pulse" style="animation-delay: 150ms" />
          <span class="inline-block w-2 h-2 bg-brand-500 rounded-full animate-pulse" style="animation-delay: 300ms" />
          <span>正在思考…</span>
        </div>
      </div>

      <!-- Error -->
      <div
        v-if="chatStore.error"
        class="px-3 py-2 text-xs bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-t border-red-200 dark:border-red-800"
      >
        {{ chatStore.error }}
        <BaseButton variant="ghost" size="sm" class="ml-2 underline" @click="chatStore.error = null">关闭</BaseButton>
      </div>

      <!-- Composer -->
      <div ref="composerWrapper" class="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
        <div class="flex gap-2 items-end">
          <BaseTextarea
            v-model="input"
            :placeholder="composerPlaceholder"
            :disabled="!chatStore.currentDocument"
            :rows="1"
            class="flex-1 chat-page__composer"
            @input="autoGrow"
            @keydown="onComposerKeydown"
          />
          <BaseButton
            v-if="chatStore.streaming"
            variant="danger"
            size="sm"
            @click="chatStore.abort()"
          >
            <Square class="w-4 h-4" />
          </BaseButton>
          <BaseButton
            v-else
            variant="primary"
            size="sm"
            :disabled="!canSend"
            @click="send"
          >
            <Send class="w-4 h-4" />
          </BaseButton>
        </div>
        <div class="text-[10px] text-slate-400 mt-1 text-right">
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
import { BaseButton, BaseTextarea } from '@/components/ui'
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
const composerWrapper = ref<HTMLElement | null>(null)
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

function getComposerEl(): HTMLTextAreaElement | null {
  return composerWrapper.value?.querySelector('textarea') ?? null
}

function autoGrow() {
  const el = getComposerEl()
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
  await nextTick()
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
  getComposerEl()?.focus()
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
.chat-page__composer :deep(textarea) {
  font-family: inherit;
  line-height: 1.4;
  max-height: 128px;
}
</style>
