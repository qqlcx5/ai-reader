<script lang="ts" setup>
import dayjs from 'dayjs'
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { MessageSquare, Plus, Trash2, Download, FileJson, FileText, X } from '@lucide/vue'
import { useChatStore } from '@/stores/chat.store'
import { useDocumentStore } from '@/stores/document.store'
import { useAppStore } from '@/stores/app.store'
import { formatRelative } from '@/utils/date'
import UButton from '@/components/ui/UButton.vue'
import { ChatRepository } from '@/db/repositories/chat.repository'
import { DocumentRepository } from '@/db/repositories/document.repository'
import {
  exportConversationAsMarkdown,
  exportConversationAsJson,
  exportConversationsToZip,
  exportConversationsAsJson,
} from '@/utils/conversation-export'
import { downloadBlob } from '@/utils/export'
import type { ConversationEntity } from '@/types/chat'
import type { DocumentEntity } from '@/types/document'

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

// ── Export ────────────────────────────────────────────────
const appStore = useAppStore()
const showExportMenu = ref(false)
const showBatchExport = ref(false)

// ── Horizontal wheel scroll for conversation list ──
const convScrollRef = ref<HTMLElement | null>(null)
function onConvWheel(e: WheelEvent) {
  const el = convScrollRef.value
  if (!el) return
  el.scrollLeft += e.deltaY
}

/** Export a single conversation as Markdown file. */
async function handleExportMarkdown(conv: ConversationEntity) {
  const doc = conv.documentId ? await DocumentRepository.findById(conv.documentId) : undefined
  const md = exportConversationAsMarkdown(conv, doc)
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const name = (conv.title || 'conversation') + '.md'
  downloadBlob(blob, name)
  showExportMenu.value = false
  appStore.showToast('已导出 Markdown', 'success')
}

/** Export a single conversation as JSON file. */
async function handleExportJson(conv: ConversationEntity) {
  const doc = conv.documentId ? await DocumentRepository.findById(conv.documentId) : undefined
  const json = exportConversationAsJson(conv, doc)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const name = (conv.title || 'conversation') + '.json'
  downloadBlob(blob, name)
  showExportMenu.value = false
  appStore.showToast('已导出 JSON', 'success')
}

/** Batch export all conversations for the current document as ZIP (Markdown). */
async function handleBatchExportMarkdown() {
  const docId = chatStore.currentDocumentId
  if (!docId) return

  const allConvs = await ChatRepository.findByDocumentId(docId)
  if (!allConvs.length) {
    appStore.showToast('没有对话可导出', 'info')
    return
  }

  const docs = new Map<string, DocumentEntity>()
  const doc = await DocumentRepository.findById(docId)
  if (doc) docs.set(docId, doc)

  const blob = exportConversationsToZip(allConvs, docs)
  const date = dayjs().toISOString().slice(0, 10)
  downloadBlob(blob, `conversations-${date}.zip`)
  showBatchExport.value = false
  appStore.showToast(`已导出 ${allConvs.length} 个对话`, 'success')
}

/** Batch export all conversations for the current document as JSON. */
async function handleBatchExportJson() {
  const docId = chatStore.currentDocumentId
  if (!docId) return

  const allConvs = await ChatRepository.findByDocumentId(docId)
  if (!allConvs.length) {
    appStore.showToast('没有对话可导出', 'info')
    return
  }

  const docs = new Map<string, DocumentEntity>()
  const doc = await DocumentRepository.findById(docId)
  if (doc) docs.set(docId, doc)

  const json = exportConversationsAsJson(allConvs, docs)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const date = dayjs().toISOString().slice(0, 10)
  downloadBlob(blob, `conversations-${date}.json`)
  showBatchExport.value = false
  appStore.showToast(`已导出 ${allConvs.length} 个对话`, 'success')
}

/** Export a specific conversation from the list. */
async function handleExportConversation(conv: ConversationEntity, format: 'md' | 'json') {
  if (format === 'md') {
    await handleExportMarkdown(conv)
  } else {
    await handleExportJson(conv)
  }
}

const formatTime = (iso: string) => formatRelative(iso).replace(/(分钟|小时|天)前$/, ' $1前')

const hasConversations = computed(() => chatStore.conversations.length > 0)

// Close batch export menu when clicking outside
function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.relative')) {
    showBatchExport.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<template>
  <div class="flex flex-row items-stretch min-h-0 border-b border-zinc-200 bg-white">
    <!-- Left: Title (tight against list) -->
    <div class="flex items-center pl-3 pr-1.5 py-2 shrink-0">
      <span class="text-[11px] font-medium text-zinc-400 whitespace-nowrap">
        会话
        <span class="font-normal text-zinc-400 ml-1">{{ chatStore.conversations.length }}</span>
      </span>
    </div>

    <!-- Center: Scrollable conversation list -->
    <div
      ref="convScrollRef"
      class="overflow-y-auto flex-1 min-w-0 flex gap-0.5 py-1.5"
      @wheel.prevent="onConvWheel"
    >
      <div
        v-for="conv in chatStore.conversations"
        :key="conv.id"
        class="group relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] transition-all w-full border max-w-[130px]"
        :class="conv.id === chatStore.currentConversationId
          ? 'bg-brand/10 border-brand/30 text-brand'
          : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'"
        @click="handleSwitchConversation(conv.id)"
      >
        <!-- <MessageSquare class="w-3 h-3 shrink-0" /> -->
        <span class="truncate flex-1 min-w-0">{{ conv.title || '新对话' }}</span>
        <span class="text-[10px] opacity-50 shrink-0 tabular-nums">{{ conv.messages.length }}</span>
        <span class="text-[10px] opacity-40 shrink-0 tabular-nums min-w-[20px] text-right">{{ formatTime(conv.updatedAt || conv.createdAt) }}</span>

        <!-- Export button (appears on hover) -->
        <div
          class="hidden group-hover:flex w-3 h-3 rounded-full bg-zinc-400 text-white items-center justify-center hover:bg-brand transition-colors"
          title="导出"
          @click.stop="handleExportConversation(conv, 'md')"
        >
          <Download class="size-2" />
        </div>

        <!-- Delete button (only show when multiple conversations) -->
        <div
          v-if="chatStore.conversations.length > 1"
          class="hidden group-hover:flex absolute -top-1 -right-1 z-1 w-3 h-3 rounded-full bg-red-500 text-white items-center justify-center"
          @click.stop="handleDeleteConversation(conv.id)"
        >
          <Trash2 class="w-1.8 h-1.8" />
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-if="!hasConversations"
        class="px-1 py-1.5 text-[12px] text-zinc-400"
      >
        暂无会话，发送第一条消息自动创建
      </div>
    </div>

    <!-- Right: Export + New buttons -->
    <div class="flex items-center gap-0.5 px-1.5 py-2 shrink-0">
      <!-- Batch export dropdown -->
      <div v-if="hasConversations" class="relative">
        <div
          class="p-1 rounded-md text-zinc-400 hover:text-brand hover:bg-brand/5 transition-colors"
          title="批量导出"
          @click="showBatchExport = !showBatchExport"
        >
          <Download class="w-3 h-3" />
        </div>
        <div
          v-if="showBatchExport"
          class="absolute right-0 top-full mt-1 bg-white rounded-lg border border-zinc-200 shadow-lg z-20 py-0.5 min-w-[140px]"
        >
          <div
            class="w-full px-2.5 py-1.5 text-left text-[11px] text-zinc-600 hover:bg-zinc-50 flex items-center gap-1.5"
            @click="handleBatchExportMarkdown"
          >
            <FileText class="w-3 h-3" /> 导出 Markdown (ZIP)
          </div>
          <div
            class="w-full px-2.5 py-1.5 text-left text-[11px] text-zinc-600 hover:bg-zinc-50 flex items-center gap-1.5"
            @click="handleBatchExportJson"
          >
            <FileJson class="w-3 h-3" /> 导出 JSON
          </div>
        </div>
      </div>
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
