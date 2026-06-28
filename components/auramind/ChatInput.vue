<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
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

// ── Model selection (single / multi) ─────────────────────
const multiModelIds = ref<string[]>([...modelStore.selectedModelIds])

// Sync if store changes externally
watch(
  () => modelStore.selectedModelIds,
  (ids) => { multiModelIds.value = [...ids] },
)

const isMultiModel = computed(() => multiModelIds.value.length > 1)
const multiCount = computed(() => multiModelIds.value.length)

const sendLabel = computed(() => {
  if (isMultiModel.value) return `广播 ${multiCount.value} 个模型`
  return ''
})

// ── canSend for multi-model: at least 1 model selected ───
const canSendMulti = computed(() => {
  const msg = chatStore.inputText.trim()
  if (!msg) return false
  if (chatStore.isSending || chatStore.isStreaming) return false
  if (multiModelIds.value.length === 0) return false

  // Single-model: delegate to existing canSend
  if (multiModelIds.value.length === 1) {
    // Ensure the single model is selected in store for canSend to work
    if (modelStore.currentModelId !== multiModelIds.value[0]) return false
    return chatStore.canSend
  }

  // Multi-model: check each selected model is valid
  for (const id of multiModelIds.value) {
    const m = modelStore.models.find((mod) => mod.id === id)
    if (!m || !m.enabled) return false
  }
  return true
})

function handleModelChange(value: string | string[]) {
  if (Array.isArray(value)) {
    multiModelIds.value = value
    modelStore.setSelectedModelIds(value)
  } else {
    multiModelIds.value = [value]
    modelStore.selectModel(value)
  }
}

function submit() {
  const msg = chatStore.inputText.trim()
  if (!msg) return
  if (!canSendMulti.value) return

  chatStore.clearError()

  const modelIds = multiModelIds.value.length > 0
    ? multiModelIds.value
    : modelStore.currentModelId ? [modelStore.currentModelId] : []

  chatStore.sendMessage(msg, modelIds).catch((e: Error) => {
    chatStore.lastError = e.message || '发送失败，请重试'
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
          :model-value="multiModelIds"
          :models="modelStore.models"
          :multiple="true"
          @update:model-value="handleModelChange"
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
        <!-- Error banner -->
        <div
          v-if="chatStore.lastError"
          class="mx-3 mb-1 px-2.5 py-1.5 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg"
        >
          {{ chatStore.lastError }}
        </div>
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
          :disabled="!canSendMulti"
          @click="submit"
        >
          <Send class="w-3.5 h-3.5" />
          <span v-if="sendLabel" class="ml-1 text-[11px]">{{ sendLabel }}</span>
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
