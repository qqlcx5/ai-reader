<script lang="ts" setup>
import { computed } from 'vue'
import { Sparkles } from '@lucide/vue'
import type { ChatMessage } from '@/types/chat'

const props = defineProps<{
  message: ChatMessage
  modelName?: string
}>()

const isUser = computed(() => props.message.role === 'user')
const isStreaming = computed(() => props.message.status === 'streaming')
const isFailed = computed(() => props.message.status === 'failed')
const isAborted = computed(() => props.message.status === 'aborted')
</script>

<template>
  <!-- User message -->
  <div v-if="isUser" class="flex justify-end">
    <div
      class="max-w-[84%] bg-brand text-white text-[13px] leading-relaxed px-3.5 py-2.5 rounded-2xl rounded-tr-sm shadow-sm"
    >
      {{ message.content }}
    </div>
  </div>

  <!-- AI message -->
  <div v-else class="flex flex-col gap-2 max-w-[95%]">
    <div class="flex items-center gap-1.5 text-[12px] font-medium text-zinc-900">
      <Sparkles class="w-3.5 h-3.5 text-brand" />
      AuraMind
      <span v-if="modelName" class="text-[10px] text-zinc-400 font-normal">{{ modelName }}</span>
    </div>

    <div
      class="bg-white border rounded-2xl rounded-tl-sm px-3.5 py-3 text-[13px] leading-relaxed shadow-sm"
      :class="{
        'border-zinc-200 text-zinc-800': !isFailed && !isAborted,
        'border-red-300 text-red-800': isFailed,
        'border-zinc-200 text-zinc-500': isAborted,
      }"
    >
      <!-- Normal content -->
      <template v-if="!isFailed && !isAborted && !isStreaming">
        <p v-for="(line, i) in message.content.split('\n')" :key="i" class="mb-1 last:mb-0">{{ line || '&nbsp;' }}</p>
      </template>

      <!-- Streaming content with cursor -->
      <template v-else-if="isStreaming">
        <span>{{ message.content }}</span>
        <span class="inline-block w-1.5 h-4 bg-brand animate-pulse align-middle ml-0.5 rounded-sm" />
      </template>

      <!-- Failed state -->
      <template v-else-if="isFailed">
        <p v-if="message.content" class="mb-2">{{ message.content }}</p>
        <div class="text-red-600 text-[11px] bg-red-50 rounded-md p-2 border border-red-200">
          Error: {{ message.error || 'Unknown error' }}
        </div>
      </template>

      <!-- Aborted state -->
      <template v-else-if="isAborted">
        <p v-if="message.content && message.content !== '(stopped)'">{{ message.content }}</p>
        <div class="text-zinc-500 text-[11px] italic">
          已停止生成
        </div>
      </template>
    </div>
  </div>
</template>
