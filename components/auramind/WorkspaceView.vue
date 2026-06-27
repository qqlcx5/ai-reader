<script lang="ts" setup>
import { ref } from 'vue'
import { FileText } from '@lucide/vue'
import ChatView from './ChatView.vue'
import ContextView from './ContextView.vue'
import ChatInput from './ChatInput.vue'

const activeTab = ref<'chat' | 'context'>('chat')

function handleSend(_text: string) {
  // Placeholder for actual send logic
}
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0 relative">
    <!-- Workspace Header -->
    <div class="h-14 shrink-0 border-b border-zinc-200 bg-white/75 backdrop-blur-md px-3 flex items-center justify-between">
      <div class="flex items-center gap-2 min-w-0">
        <div class="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center shrink-0">
          <FileText class="w-4 h-4 text-zinc-600" />
        </div>
        <div class="min-w-0">
          <div class="text-[13px] font-medium truncate max-w-[145px]">Local-First 软件设计原则</div>
          <div class="text-[10px] text-zinc-400 flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            当前网页 · 3,421 tokens
          </div>
        </div>
      </div>

      <!-- Chat/Context Tabs -->
      <div class="flex p-0.5 bg-zinc-100 border border-zinc-200 rounded-[9px]">
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
    </div>

    <ChatView v-show="activeTab === 'chat'" />
    <ContextView v-show="activeTab === 'context'" />
    <ChatInput v-show="activeTab === 'chat'" @send="handleSend" />
  </div>
</template>
