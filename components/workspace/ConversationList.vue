<script lang="ts" setup>
import { computed } from 'vue'
import { MessageSquare, Plus, Trash2 } from '@lucide/vue'
import { useChatStore } from '@/stores/chat.store'
import RekaButton from '@/components/ui/RekaButton.vue'

const chatStore = useChatStore()

function handleNewConversation() {
  const docId = chatStore.currentDocumentId
  if (!docId) return
  chatStore.createConversation(docId)
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
  <div class="flex flex-col min-h-0 border-b border-zinc-200 bg-white">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2 shrink-0">
      <span class="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
        会话
        <span class="font-normal text-zinc-400 ml-1">{{ chatStore.conversations.length }}</span>
      </span>
      <RekaButton
        variant="ghost"
        size="sm"
        class="text-[11px] text-brand"
        @click="handleNewConversation"
      >
        <Plus class="w-3.5 h-3.5 mr-0.5" />
        新建
      </RekaButton>
    </div>

    <!-- Conversation list -->
    <div class="overflow-x-auto px-2 pb-1.5 flex gap-1.5 shrink-0">
      <button
        v-for="conv in chatStore.conversations"
        :key="conv.id"
        class="group relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] transition-all shrink-0 border"
        :class="conv.id === chatStore.currentConversationId
          ? 'bg-brand/10 border-brand/30 text-brand'
          : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'"
        @click="handleSwitchConversation(conv.id)"
      >
        <MessageSquare class="w-3 h-3 shrink-0" />
        <span class="max-w-[120px] truncate">{{ conv.title || '新对话' }}</span>
        <span class="text-[10px] opacity-60 shrink-0">{{ conv.messages.length }}</span>

        <!-- Delete button (only show when multiple conversations) -->
        <button
          v-if="chatStore.conversations.length > 1"
          class="hidden group-hover:flex absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white items-center justify-center"
          @click.stop="handleDeleteConversation(conv.id)"
        >
          <Trash2 class="w-2.5 h-2.5" />
        </button>
      </button>

      <!-- Empty state -->
      <div
        v-if="!hasConversations"
        class="px-3 py-2 text-[12px] text-zinc-400"
      >
        暂无会话，发送第一条消息自动创建
      </div>
    </div>
  </div>
</template>
