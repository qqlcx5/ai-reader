<script lang="ts" setup>
import { computed } from 'vue'
import { MessageSquare, Plus, Trash2 } from '@lucide/vue'
import { useChatStore } from '@/stores/chat.store'
import { useDocumentStore } from '@/stores/document.store'
import UButton from '@/components/ui/UButton.vue'

const chatStore = useChatStore()
const documentStore = useDocumentStore()

async function handleNewConversation() {
  const docId = chatStore.currentDocumentId
    || documentStore.pageDocument?.id
    || documentStore.currentDocument?.id
    || null

  if (!docId) return

  try {
    await chatStore.createConversation(docId)
  } catch (err) {
    console.error('[ConversationList] Failed to create conversation:', err)
    chatStore.lastError = '新建会话失败，请重试'
  }
}

async function handleSwitchConversation(id: string) {
  await chatStore.switchConversation(id)
}

async function handleDeleteConversation(id: string) {
  await chatStore.deleteConversation(id)
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins} 分钟前`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} 小时前`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays} 天前`

  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const hasConversations = computed(() => chatStore.conversations.length > 0)
</script>

<template>
  <div class="flex flex-row items-stretch min-h-0 border-b border-zinc-200 bg-white">
    <!-- Left: Title (tight against list) -->
    <div class="flex items-center pl-3 pr-1.5 py-2 shrink-0">
      <span class="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">
        会话
        <span class="font-normal text-zinc-400 ml-1">{{ chatStore.conversations.length }}</span>
      </span>
    </div>

    <!-- Center: Scrollable conversation list -->
    <div class="overflow-y-auto flex-1 min-w-0 flex gap-0.5 py-1.5 ">
      <button
        v-for="conv in chatStore.conversations"
        :key="conv.id"
        class="group relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] transition-all w-full border max-w-[140px]"
        :class="conv.id === chatStore.currentConversationId
          ? 'bg-brand/10 border-brand/30 text-brand'
          : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'"
        @click="handleSwitchConversation(conv.id)"
      >
        <MessageSquare class="w-3 h-3 shrink-0" />
        <span class="truncate flex-1 min-w-0">{{ conv.title || '新对话' }}</span>
        <span class="text-[10px] opacity-50 shrink-0 tabular-nums">{{ conv.messages.length }}</span>
        <span class="text-[10px] opacity-40 shrink-0 tabular-nums min-w-[20px] text-right">{{ formatTime(conv.updatedAt || conv.createdAt) }}</span>

        <!-- Delete button (only show when multiple conversations) -->
        <div
          v-if="chatStore.conversations.length > 1"
          class="hidden group-hover:flex absolute -top-1 -right-1 z-1 w-3 h-3 rounded-full bg-red-500 text-white items-center justify-center"
          @click.stop="handleDeleteConversation(conv.id)"
        >
          <Trash2 class="w-1.8 h-1.8" />
        </div>
      </button>

      <!-- Empty state -->
      <div
        v-if="!hasConversations"
        class="px-1 py-1.5 text-[12px] text-zinc-400"
      >
        暂无会话，发送第一条消息自动创建
      </div>
    </div>

    <!-- Right: New button -->
    <div class="flex items-center px-2 py-2 shrink-0">
      <UButton
        variant="ghost"
        size="sm"
        class="text-[11px] text-brand"
        @click="handleNewConversation"
      >
        <Plus class="w-3.5 h-3.5 mr-0.5" />
        新建
      </UButton>
    </div>
  </div>
</template>
