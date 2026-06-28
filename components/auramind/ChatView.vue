<script lang="ts" setup>
import { watch, ref, nextTick, computed } from 'vue'
import { PlugZap, Sparkles, RefreshCw } from '@lucide/vue'
import { useChatStore } from '@/stores/chat.store'
import { useDocumentStore } from '@/stores/document.store'
import { useModelStore } from '@/stores/model.store'
import ChatMessage from '@/components/workspace/ChatMessage.vue'
import RekaButton from '@/components/ui/RekaButton.vue'

const chatStore = useChatStore()
const documentStore = useDocumentStore()
const modelStore = useModelStore()

const scrollContainer = ref<HTMLElement | null>(null)

const contextDoc = computed(() =>
  documentStore.pageDocument || documentStore.currentDocument,
)

const contextTitle = computed(() => contextDoc.value?.title ?? null)

const currentModelName = computed(() => modelStore.currentModel?.name)

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

    <!-- Messages -->
    <ChatMessage
      v-for="msg in chatStore.messages"
      :key="msg.id"
      :message="msg"
      :model-name="msg.role === 'assistant' ? currentModelName : undefined"
    />

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
