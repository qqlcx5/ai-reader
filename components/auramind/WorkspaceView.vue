<script lang="ts" setup>
import { ref } from 'vue'
import WorkspaceHeader from '@/components/workspace/WorkspaceHeader.vue'
import ChatView from './ChatView.vue'
import ContextView from './ContextView.vue'
import ChatInput from './ChatInput.vue'
import ConversationList from '@/components/workspace/ConversationList.vue'

const activeTab = ref<'chat' | 'context'>('chat')
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0 relative">
    <WorkspaceHeader />
    <ConversationList />

    <!-- Chat/Context Tabs -->
    <div class="flex p-0.5 mx-3 mt-2 bg-zinc-100 border border-zinc-200 rounded-[9px] self-start">
      <button
        class="px-3 py-1 text-[12px] font-medium rounded-[7px] transition-all"
        :class="activeTab === 'chat' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'"
        @click="activeTab = 'chat'"
      >
        对话
      </button>
      <button
        class="px-3 py-1 text-[12px] font-medium rounded-[7px] transition-all"
        :class="activeTab === 'context' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'"
        @click="activeTab = 'context'"
      >
        上下文
      </button>
    </div>

    <ChatView v-show="activeTab === 'chat'" />
    <ContextView v-show="activeTab === 'context'" />
    <ChatInput v-show="activeTab === 'chat'" />
  </div>
</template>
