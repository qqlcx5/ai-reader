<!--
  ChatMessageBubble.vue

  A single message in the chat list. Renders user messages as
  preformatted text and assistant messages through the markdown
  renderer. Includes a small footer with model + timestamp and
  an inline error indicator when present.
-->
<template>
  <div
    class="chat-bubble flex"
    :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
  >
    <div
      class="chat-bubble__inner max-w-[85%] px-3 py-2 rounded-lg text-sm"
      :class="bubbleClass"
    >
      <!-- Assistant: render markdown; user: render as plain text -->
      <MarkdownRenderer
        v-if="message.role === 'assistant'"
        :source="message.content || ' '"
        content-class="chat-bubble__md"
      />
      <p
        v-else
        class="whitespace-pre-wrap break-words"
      >
        {{ message.content }}
      </p>

      <div
        v-if="message.error"
        class="mt-1 text-[10px] text-red-600 dark:text-red-300"
      >
        ⚠ {{ message.error }}
      </div>
      <div
        v-if="message.role === 'assistant' && message.model"
        class="mt-1 text-[10px] opacity-60"
      >
        {{ message.model }}
        <span v-if="message.tokens"> · {{ message.tokens }} tokens</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MarkdownRenderer from '@components/MarkdownRenderer.vue'
import type { ChatMessage } from '@db/schema'

const props = defineProps<{ message: ChatMessage }>()

const bubbleClass = computed(() =>
  props.message.role === 'user'
    ? 'bg-primary-500 text-white'
    : 'bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-100 border border-surface-200 dark:border-surface-700'
)
</script>

<style scoped>
.chat-bubble__inner :deep(.markdown-renderer p:first-child) {
  margin-top: 0;
}
.chat-bubble__inner :deep(.markdown-renderer p:last-child) {
  margin-bottom: 0;
}
</style>
