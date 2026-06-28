<script lang="ts" setup>
import { watch, ref, nextTick, computed } from 'vue'
import { PlugZap, Sparkles, RefreshCw } from '@lucide/vue'
import { useChatStore } from '@/stores/chat.store'
import { useDocumentStore } from '@/stores/document.store'
import { useModelStore } from '@/stores/model.store'
import ChatMessage from '@/components/workspace/ChatMessage.vue'
import RekaButton from '@/components/ui/RekaButton.vue'
import type { ChatMessage as ChatMessageType } from '@/types/chat'

const chatStore = useChatStore()
const documentStore = useDocumentStore()
const modelStore = useModelStore()

const scrollContainer = ref<HTMLElement | null>(null)

const contextDoc = computed(() =>
  documentStore.pageDocument || documentStore.currentDocument,
)

const contextTitle = computed(() => contextDoc.value?.title ?? null)

// ── Model name lookup ───────────────────────────────────
function modelNameFor(modelId?: string): string | undefined {
  if (!modelId) return undefined
  const m = modelStore.models.find((mod) => mod.modelId === modelId)
  return m?.name
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

function scrollToBottom() {
  nextTick(() => {
    if (scrollContainer.value) {
      scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight
    }
  })
}

watch(
  () => chatStore.messages.length,
  () => scrollToBottom(),
)

watch(
  () => chatStore.messages[chatStore.messages.length - 1]?.content,
  () => scrollToBottom(),
)

function handleStop() {
  chatStore.stopGeneration()
}
</script>

<template>
  <div ref="scrollContainer" class="flex-1 min-h-0 overflow-y-auto p-4 pb-28 flex flex-col gap-5 bg-[#FAFAFA]">
    <!-- Context badge -->
    <div class="flex justify-center">
      <span
        v-if="contextTitle"
        class="text-[10px] border border-brand/20 bg-indigo-50 text-brand px-2 py-0.5 rounded-md flex items-center gap-1"
      >
        <PlugZap class="w-3 h-3" />
        已挂载：{{ contextTitle }}
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
        :model-name="modelNameFor(round.userMsg.modelId)"
      />

      <!-- Single assistant: normal flow -->
      <ChatMessage
        v-if="round.assistantMsgs.length === 1"
        :message="round.assistantMsgs[0]"
        :model-name="modelNameFor(round.assistantMsgs[0].modelId)"
      />

      <!-- Multi-assistant: side-by-side card layout -->
      <div
        v-else-if="round.assistantMsgs.length > 1"
        class="grid gap-3"
        :class="{
          'grid-cols-2': round.assistantMsgs.length === 2,
          'grid-cols-2': round.assistantMsgs.length === 3,
          'grid-cols-2': round.assistantMsgs.length >= 4,
        }"
      >
        <ChatMessage
          v-for="amsg in round.assistantMsgs"
          :key="amsg.id"
          :message="amsg"
          :model-name="modelNameFor(amsg.modelId)"
          :is-multi-model="true"
        />
      </div>
    </template>

    <!-- Stop button -->
    <div v-if="chatStore.isStreaming" class="flex justify-center">
      <RekaButton variant="ghost" size="sm" class="text-[11px] text-zinc-500" @click="handleStop">
        停止生成
      </RekaButton>
    </div>

    <!-- Regenerate button (after last assistant message, when not streaming) -->
    <div
      v-if="!chatStore.isStreaming && chatStore.messages.length > 0"
      class="flex justify-center"
    >
      <RekaButton variant="ghost" size="sm" class="text-[11px] text-zinc-400" @click="chatStore.regenerate()">
        <RefreshCw class="w-3 h-3 mr-1" />
        重新生成
      </RekaButton>
    </div>
  </div>
</template>
