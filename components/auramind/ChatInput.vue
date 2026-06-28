<script lang="ts" setup>
import { computed } from 'vue'
import { Cpu, Paperclip, Send, Square } from '@lucide/vue'
import { useChatStore } from '@/stores/chat.store'
import { useModelStore } from '@/stores/model.store'
import { useDocumentStore } from '@/stores/document.store'
import ModelSelect from '@/components/workspace/ModelSelect.vue'
import RekaButton from '@/components/ui/RekaButton.vue'
import RekaTextarea from '@/components/ui/RekaTextarea.vue'

const chatStore = useChatStore()
const modelStore = useModelStore()
const documentStore = useDocumentStore()

const contextDoc = computed(() =>
  documentStore.pageDocument || documentStore.currentDocument,
)

const contextLabel = computed(() => {
  if (contextDoc.value) return '当前网页'
  return '无上下文'
})

function submit() {
  const msg = chatStore.inputText.trim()
  if (!msg) return
  if (!chatStore.canSend) return

  chatStore.sendMessage(msg).catch((_e: Error) => {
    // Error is handled in store (marks message as failed)
  })
  chatStore.setInputText('')
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit()
  }
}

function handleStop() {
  chatStore.stopGeneration()
}
</script>

<template>
  <div class="absolute left-0 right-0 bottom-0 p-3 bg-gradient-to-t from-[#FAFAFA] via-[#FAFAFA] to-transparent z-20">
    <div class="bg-white border border-zinc-200 rounded-2xl shadow-lg overflow-hidden">
      <div class="flex items-center justify-between px-3 pt-2">
        <ModelSelect
          v-if="modelStore.models.length > 0"
          :model-value="modelStore.currentModelId ?? ''"
          :models="modelStore.models"
          @update:model-value="modelStore.selectModel($event)"
        />
        <RekaButton v-else variant="ghost" size="sm" class="text-[11px] text-zinc-400">
          <Cpu class="w-3 h-3" />
          No model
        </RekaButton>

        <RekaButton variant="ghost" size="sm" class="text-[11px] text-zinc-400">
          <Paperclip class="w-3 h-3" />
          {{ contextLabel }}
        </RekaButton>
      </div>

      <div class="relative">
        <RekaTextarea
          :model-value="chatStore.inputText"
          :rows="1"
          auto-height
          class="w-full bg-transparent text-[13px] px-3 py-2.5 pr-11 placeholder:text-zinc-400 min-h-[42px] focus:border-transparent"
          placeholder="基于当前网页继续提问..."
          @update:model-value="chatStore.setInputText($event)"
          @keydown="handleKeydown"
        />
        <!-- Send button -->
        <RekaButton
          v-if="!chatStore.isStreaming"
          variant="primary"
          class="absolute right-2 bottom-2 p-1.5 !rounded-lg"
          :disabled="!chatStore.canSend"
          @click="submit"
        >
          <Send class="w-3.5 h-3.5" />
        </RekaButton>
        <!-- Stop button during streaming -->
        <RekaButton
          v-else
          variant="ghost"
          class="absolute right-2 bottom-2 p-1.5 !rounded-lg text-red-500"
          @click="handleStop"
        >
          <Square class="w-3.5 h-3.5" />
        </RekaButton>
      </div>
    </div>
  </div>
</template>
