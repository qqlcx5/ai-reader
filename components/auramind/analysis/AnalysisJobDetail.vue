<script lang="ts" setup>
import { ref, watch } from 'vue'
import {
  Zap, Loader2, RefreshCw, Trash2, AlertCircle, Ban,
} from '@lucide/vue'
import { ChatRepository } from '@/db/repositories/chat.repository'
import { DocumentRepository } from '@/db/repositories/document.repository'
import { useAiJobStore } from '@/stores/ai-job.store'
import { useAppStore } from '@/stores/app.store'
import { useDocumentStore } from '@/stores/document.store'
import { useChatStore } from '@/stores/chat.store'
import { useWorkspaceStore } from '@/stores/workspace.store'
import type { AiJobEntity, AiJobPriority } from '@/types/ai-job'

const props = defineProps<{
  job: AiJobEntity
}>()

const aiJobStore = useAiJobStore()
const appStore = useAppStore()
const documentStore = useDocumentStore()
const chatStore = useChatStore()
const workspaceStore = useWorkspaceStore()

const jobConversation = ref<{ content: string; modelId?: string } | null>(null)
const loadingConversation = ref(false)

async function loadConversation() {
  jobConversation.value = null
  if (!props.job.conversationId) return
  loadingConversation.value = true
  try {
    const conv = await ChatRepository.findById(props.job.conversationId)
    if (conv) {
      const assistantMsg = conv.messages.find((m) => m.role === 'assistant')
      jobConversation.value = {
        content: assistantMsg?.content ?? '(空)',
        modelId: assistantMsg?.modelId,
      }
    }
  } catch {
    jobConversation.value = null
  } finally {
    loadingConversation.value = false
  }
}

watch(() => props.job.id, () => { void loadConversation() }, { immediate: true })

function priorityLabel(p?: AiJobPriority): string {
  return p === 'high' ? '高' : p === 'low' ? '低' : '中'
}

function priorityColor(p?: AiJobPriority): string {
  return p === 'high' ? 'text-red-500' : p === 'low' ? 'text-zinc-400' : 'text-zinc-500'
}

async function handleCancel() {
  await aiJobStore.cancel(props.job.id)
  appStore.showToast('已取消', 'info')
}

async function handleRetry() {
  await aiJobStore.retry(props.job.id)
  appStore.showToast('已重新入队', 'success')
}

async function handleRemove() {
  await aiJobStore.remove(props.job.id)
}

async function openConversation() {
  if (!props.job.conversationId) return
  const doc = await DocumentRepository.findById(props.job.documentId)
  if (!doc) return
  documentStore.setCurrentDocument(doc)
  await chatStore.loadConversations(doc.id)
  const conv = chatStore.conversations.find((c) => c.id === props.job.conversationId)
  if (conv) chatStore.switchConversation(conv.id)
  workspaceStore.setDocumentSource('library')
  appStore.setCurrentView('workspace')
}
</script>

<template>
  <div class="px-3.5 py-3 bg-zinc-50/60 border-t border-zinc-100">
    <div v-if="job.status === 'failed' && job.error" class="mb-2.5">
      <div class="flex items-start gap-1.5 text-[11px] text-red-500 bg-red-50 rounded-lg p-2">
        <AlertCircle class="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span class="break-all">{{ job.error }}</span>
      </div>
    </div>

    <div v-if="loadingConversation" class="flex items-center gap-1.5 text-[11px] text-zinc-400">
      <Loader2 class="w-3 h-3 animate-spin" /> 加载分析结果…
    </div>

    <div v-else-if="jobConversation" class="mb-2.5">
      <div class="text-[10px] text-zinc-400 mb-1">分析结果预览</div>
      <div class="text-[12px] text-zinc-600 leading-relaxed bg-white rounded-lg border border-zinc-100 p-2.5 max-h-48 overflow-y-auto whitespace-pre-wrap">{{ jobConversation.content.slice(0, 500) }}{{ jobConversation.content.length > 500 ? '…' : '' }}</div>
    </div>

    <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-zinc-400 mb-2.5">
      <div>文档 ID: <span class="text-zinc-500">{{ job.documentId.slice(0, 12) }}…</span></div>
      <div>任务 ID: <span class="text-zinc-500">{{ job.id.slice(0, 12) }}…</span></div>
      <div>重试次数: <span class="text-zinc-500">{{ job.retries }}</span></div>
      <div>来源: <span class="text-zinc-500">{{ job.jobSource === 'manual' ? '手动触发' : '自动触发' }}</span></div>
      <div v-if="job.priority">优先级: <span :class="priorityColor(job.priority)">{{ priorityLabel(job.priority) }}</span></div>
      <div v-if="job.sortOrder !== undefined">排序: <span class="text-zinc-500">{{ job.sortOrder }}</span></div>
    </div>

    <div class="flex items-center gap-2">
      <div
        v-if="job.status === 'processing'"
        class="px-2.5 py-1 rounded-md text-[11px] font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer"
        @click.stop="handleCancel"
      >
        <Ban class="w-3 h-3" /> 取消
      </div>
      <div
        v-if="job.status === 'failed' || job.status === 'cancelled'"
        class="px-2.5 py-1 rounded-md text-[11px] font-medium text-blue-500 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center gap-1 cursor-pointer"
        @click.stop="handleRetry"
      >
        <RefreshCw class="w-3 h-3" /> 重试
      </div>
      <div
        v-if="job.status === 'success' && job.conversationId"
        class="px-2.5 py-1 rounded-md text-[11px] font-medium text-brand bg-brand/10 hover:bg-brand/20 transition-colors flex items-center gap-1 cursor-pointer"
        @click.stop="openConversation"
      >
        <Zap class="w-3 h-3" /> 查看对话
      </div>
      <button
        class="px-2.5 py-1 rounded-md text-[11px] font-medium text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors flex items-center gap-1"
        @click.stop="handleRemove"
      >
        <Trash2 class="w-3 h-3" /> 删除
      </button>
    </div>
  </div>
</template>
