<script lang="ts" setup>
import { watch, ref, nextTick, computed } from 'vue'
import { PlugZap, Sparkles, ArrowDown, X } from '@lucide/vue'
import { useChatStore } from '@/stores/chat.store'
import { useDocumentStore } from '@/stores/document.store'
import { useModelStore } from '@/stores/model.store'
import { useAppStore } from '@/stores/app.store'
import ChatMessage from '@/components/workspace/ChatMessage.vue'
import UButton from '@/components/ui/UButton.vue'
import ScrollFab from '@/components/ui/ScrollFab.vue'
import type { ChatMessage as ChatMessageType } from '@/types/chat'
import { calcMessageCost, formatCNY } from '@/utils/cost'

const chatStore = useChatStore()
const documentStore = useDocumentStore()
const modelStore = useModelStore()
const appStore = useAppStore()

const scrollContainer = ref<HTMLElement | null>(null)

const contextDoc = computed(() =>
  documentStore.pageDocument || documentStore.currentDocument,
)

const contextTitle = computed(() => contextDoc.value?.title ?? null)

// ── Model name lookup ───────────────────────────────────
function modelNameFor(modelId?: string, modelConfigId?: string): string | undefined {
  if (!modelId && !modelConfigId) return undefined
  // Prefer modelConfigId (unique UUID) to avoid ambiguity when two configs
  // share the same modelId (e.g. GPT-4o via different providers).
  if (modelConfigId) {
    const m = modelStore.models.find((mod) => mod.id === modelConfigId)
    if (m) return m.name
  }
  const m = modelStore.models.find((mod) => mod.modelId === modelId)
  return m?.name ?? modelId
}

// ── Token usage + cost label ────────────────────────────
function metaFor(msg: ChatMessageType): string | undefined {
  if (msg.role !== 'assistant' || !msg.tokenUsage) return undefined
  const u = msg.tokenUsage
  const prompt = u.promptTokens ?? 0
  const completion = u.completionTokens ?? 0
  const total = prompt + completion
  if (total === 0) return undefined
  const parts: string[] = [`Tokens: ${total} ↑${prompt} ↓${completion}`]
  const model = modelStore.models.find((m) => m.id === msg.modelConfigId)
    ?? modelStore.models.find((m) => m.modelId === msg.modelId)
  if (model) {
    const cost = calcMessageCost(u, model)
    if (cost != null && cost > 0) parts.push(`花费:${formatCNY(cost)}`)
  }
  return parts.join('  ')
}

// ── Round grouping ──────────────────────────────────────
// A round = 1 user message + all consecutive assistant messages that follow
interface MessageRound {
  userMsg: ChatMessageType
  assistantMsgs: ChatMessageType[]
}

const rounds = computed<MessageRound[]>(() => {
  const result: MessageRound[] = []
  const msgs = chatStore.messages
  let i = 0

  while (i < msgs.length) {
    if (msgs[i].role === 'user') {
      const userMsg = msgs[i]
      const assistantMsgs: ChatMessageType[] = []
      i++
      while (i < msgs.length && msgs[i].role === 'assistant') {
        assistantMsgs.push(msgs[i])
        i++
      }
      result.push({ userMsg, assistantMsgs })
    } else {
      // Standalone assistant message (e.g., restored from DB out of order)
      // Treat as a round with a synthetic empty user
      const assistantMsgs: ChatMessageType[] = [msgs[i]]
      // Find preceding user message if any, or create synthetic
      const lastRound = result[result.length - 1]
      result.push({
        userMsg: lastRound?.userMsg ?? {
          id: '',
          role: 'user',
          content: '',
          status: 'success',
          createdAt: '',
        },
        assistantMsgs,
      })
      i++
    }
  }

  return result
})

// ── Auto-scroll: only while the user is pinned to the bottom. Once they scroll
//    up to read earlier turns, streaming/new messages stop yanking the view
//    back down; a floating "back to bottom" button appears instead.
const pinned = ref(true)
const unreadCount = ref(0)
const NEAR_BOTTOM_THRESHOLD = 80

function isNearBottom(): boolean {
  const el = scrollContainer.value
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_THRESHOLD
}

function onScroll() {
  pinned.value = isNearBottom()
  if (pinned.value) unreadCount.value = 0
}

function scrollToBottom(smooth = false) {
  nextTick(() => {
    if (!scrollContainer.value) return
    scrollContainer.value.scrollTo({
      top: scrollContainer.value.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    })
  })
}

function backToBottom() {
  pinned.value = true
  unreadCount.value = 0
  scrollToBottom(true)
}

// New message added: follow if pinned, otherwise just bump the unread counter.
watch(
  () => chatStore.messages.length,
  () => {
    if (pinned.value) scrollToBottom()
    else unreadCount.value++
  },
)

// Streaming tokens on the last message: follow only while still pinned.
watch(
  () => chatStore.messages[chatStore.messages.length - 1]?.content,
  () => {
    if (pinned.value) scrollToBottom()
  },
)

function handleStop() {
  chatStore.stopGeneration()
}

function handleCopy(content: string) {
  navigator.clipboard.writeText(content).catch(() => {
    // Fallback for older browsers / non-HTTPS
    const textarea = document.createElement('textarea')
    textarea.value = content
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  })
  appStore.showToast('已复制到剪贴板', 'success')
}

function handleDeleteMessage(id: string) {
  chatStore.deleteMessage(id)
  appStore.showToast('消息已删除', 'success')
}

function handleEdit(id: string, content: string) {
  chatStore.editMessage(id, content)
}

function handleRegenerate(id: string) {
  chatStore.regenerate(id)
}

async function handleBranch(id: string) {
  try {
    await chatStore.branchConversationAt(id)
    appStore.showToast('已创建分支会话', 'success')
  } catch {
    appStore.showToast('创建分支失败', 'error')
  }
}

async function handleRestore(id: string) {
  try {
    await chatStore.restoreConversationAt(id)
    appStore.showToast('已恢复到历史节点，原路径已保存', 'success')
  } catch {
    appStore.showToast('恢复历史节点失败', 'error')
  }
}

function handleDetachContext() {
  // Detach the current page context from the chat dialog. The document
  // itself stays in the library; we just clear the in-memory refs so
  // subsequent messages are sent without it. The includeContext toggle
  // is independent — the user can re-attach the next captured page
  // manually via the toggle in ChatInput.
  documentStore.setPageDocument(null)
  documentStore.setCurrentDocument(null)
  appStore.showToast('已卸载上下文', 'success')
}

// ── Last assistant message ID ────────────────────────────
const lastAssistantMsgId = computed<string | null>(() => {
  const msgs = chatStore.messages
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'assistant') return msgs[i].id
  }
  return null
})
</script>

<template>
  <div class="flex-1 min-h-0 flex flex-col relative">
    <div
      ref="scrollContainer"
      class="flex-1 min-h-0 overflow-y-auto p-4 pb-28 flex flex-col gap-3 bg-[#FAFAFA]"
      @scroll.passive="onScroll"
    >
    <!-- Context badge -->
    <div class="flex justify-center">
      <span
        v-if="contextTitle"
        class="group inline-flex items-center gap-1 text-[11px] border border-brand/30 bg-brand/10 text-brand pl-2 pr-1 py-1 rounded-md"
      >
        <PlugZap class="w-3.5 h-3.5" />
        <span class="max-w-[200px] truncate">已挂载：{{ contextTitle }}</span>
        <button
          class="ml-1 -mr-0.5 w-5 h-5 rounded inline-flex items-center justify-center text-white bg-brand/80 hover:bg-brand hover:scale-110 active:scale-95 transition-all shadow-sm"
          title="卸载上下文"
          aria-label="卸载上下文"
          @click="handleDetachContext"
        >
          <X class="w-3 h-3" stroke-width="3" />
        </button>
      </span>
      <span
        v-else
        class="text-[10px] border border-zinc-200 bg-zinc-50 text-zinc-400 px-2 py-0.5 rounded-md flex items-center gap-1"
      >
        <PlugZap class="w-3 h-3" />
        未挂载上下文
      </span>
    </div>

    <!-- Empty state -->
    <div
      v-if="chatStore.messages.length === 0"
      class="flex-1 flex flex-col items-center justify-center text-center gap-3"
    >
      <Sparkles class="w-8 h-8 text-brand/40" />
      <p class="text-[13px] text-zinc-500">
        基于当前网页的内容开始对话
      </p>
      <p class="text-[11px] text-zinc-400">
        打开网页并点击"抓取"后, AI 将理解全文内容进行回答
      </p>
    </div>

    <!-- Rounds -->
    <template v-for="(round, ri) in rounds" :key="round.userMsg.id || ri">
      <!-- User message -->
      <ChatMessage
        v-if="round.userMsg.content"
        :message="round.userMsg"
        :model-name="modelNameFor(round.userMsg.modelId, round.userMsg.modelConfigId)"
        :context-label="ri === 0 && contextTitle ? `已附带：${contextTitle}` : undefined"
        @copy="handleCopy"
        @delete="handleDeleteMessage"
        @edit="handleEdit"
        @branch="handleBranch"
        @restore="handleRestore"
      />

      <!-- Single assistant: normal flow -->
      <ChatMessage
        v-if="round.assistantMsgs.length === 1"
        :message="round.assistantMsgs[0]"
        :model-name="modelNameFor(round.assistantMsgs[0].modelId, round.assistantMsgs[0].modelConfigId)"
        :meta="metaFor(round.assistantMsgs[0])"
        :is-last-assistant="round.assistantMsgs[0].id === lastAssistantMsgId"
        @regenerate="handleRegenerate"
        @copy="handleCopy"
        @delete="handleDeleteMessage"
        @branch="handleBranch"
        @restore="handleRestore"
      />

      <!-- Multi-assistant: side-by-side card layout -->
      <div
        v-else-if="round.assistantMsgs.length > 1"
        class="grid grid-cols-2 gap-3"
      >
        <ChatMessage
          v-for="amsg in round.assistantMsgs"
          :key="amsg.id"
          :message="amsg"
          :model-name="modelNameFor(amsg.modelId, amsg.modelConfigId)"
          :meta="metaFor(amsg)"
          :is-multi-model="true"
          :is-last-assistant="amsg.id === lastAssistantMsgId"
          @regenerate="handleRegenerate"
          @copy="handleCopy"
          @delete="handleDeleteMessage"
          @branch="handleBranch"
          @restore="handleRestore"
        />
      </div>
    </template>

    <!-- Stop button -->
    <div v-if="chatStore.isStreaming" class="flex justify-center">
      <UButton variant="ghost" size="sm" class="text-[11px] text-zinc-500" @click="handleStop">
        停止生成
      </UButton>
    </div>
    </div>
    <ScrollFab :visible="!pinned">
      <button
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-zinc-200 shadow-md text-[12px] text-zinc-600 hover:text-brand hover:border-brand/40 transition-colors"
        @click="backToBottom"
      >
        <ArrowDown class="w-3.5 h-3.5" />
        <span v-if="unreadCount > 0">{{ unreadCount }} 条新消息</span>
        <span v-else>回到底部</span>
      </button>
    </ScrollFab>
  </div>
</template>
