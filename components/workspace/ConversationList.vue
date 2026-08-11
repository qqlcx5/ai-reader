<script lang="ts" setup>
import dayjs from 'dayjs'
import { computed, ref } from 'vue'
import { Plus, MoreHorizontal, Download, FileJson, FileText, Pencil, Trash2, GitBranch, History, X } from '@lucide/vue'
import { useChatStore } from '@/stores/chat.store'
import { useDocumentStore } from '@/stores/document.store'
import { useAppStore } from '@/stores/app.store'
import { formatRelative } from '@/utils/date'
import UButton from '@/components/ui/UButton.vue'
import UDropdownMenu from '@/components/ui/UDropdownMenu.vue'
import type { DropdownMenuAction } from '@/components/ui/UDropdownMenu.vue'
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

async function handleRenameConversation(conv: ConversationEntity) {
  const title = window.prompt('重命名会话', conv.title || '新对话')?.trim()
  if (title) await chatStore.updateConversationTitle(title, conv.id)
}

// ── Export ────────────────────────────────────────────────
const appStore = useAppStore()

const conversationMenu: DropdownMenuAction[] = [
  { key: 'rename', label: '重命名', icon: Pencil },
  { key: 'markdown', label: '导出 Markdown', icon: Download },
  { key: 'json', label: '导出 JSON', icon: FileJson },
  { key: 'delete', label: '删除会话', icon: Trash2, danger: true, separatorBefore: true },
]
const batchExportMenu: DropdownMenuAction[] = [
  { key: 'markdown', label: '导出 Markdown (ZIP)', icon: FileText },
  { key: 'json', label: '导出 JSON', icon: FileJson },
]

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
  appStore.showToast('已导出 Markdown', 'success')
}

/** Export a single conversation as JSON file. */
async function handleExportJson(conv: ConversationEntity) {
  const doc = conv.documentId ? await DocumentRepository.findById(conv.documentId) : undefined
  const json = exportConversationAsJson(conv, doc)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const name = (conv.title || 'conversation') + '.json'
  downloadBlob(blob, name)
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
const showHistory = ref(false)
const historyMessages = computed(() => chatStore.messages.filter((message) => message.role !== 'system'))
const branchConversations = computed(() => chatStore.conversations.filter((conversation) => conversation.parentConversationId))

async function restoreNode(id: string) {
  await chatStore.restoreConversationAt(id)
  showHistory.value = false
}

async function branchNode(id: string) {
  await chatStore.branchConversationAt(id)
  showHistory.value = false
}

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

        <UDropdownMenu
          :items="conversationMenu"
          @select="(item) => {
            if (item.key === 'rename') handleRenameConversation(conv)
            else if (item.key === 'markdown') handleExportConversation(conv, 'md')
            else if (item.key === 'json') handleExportConversation(conv, 'json')
            else if (item.key === 'delete') handleDeleteConversation(conv.id)
          }"
        >
          <template #trigger>
            <div
              class="invisible group-hover:visible flex items-center justify-center w-3 h-3 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-black/5 transition-colors"
              title="更多操作"
              @click.stop
            >
              <MoreHorizontal class="w-4 h-4" />
            </div>
          </template>
        </UDropdownMenu>
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
      <button
        v-if="chatStore.messages.length > 0"
        class="p-1 rounded-md text-zinc-400 hover:text-brand hover:bg-brand/5 transition-colors"
        title="会话历史树"
        @click="showHistory = !showHistory"
      ><History class="w-3 h-3" /></button>
      <UDropdownMenu
        v-if="hasConversations"
        :items="batchExportMenu"
        @select="(item) => item.key === 'markdown' ? handleBatchExportMarkdown() : handleBatchExportJson()"
      >
        <template #trigger>
          <button
            class="p-1 rounded-md text-zinc-400 hover:text-brand hover:bg-brand/5 transition-colors"
            title="批量导出"
          >
            <Download class="w-3 h-3" />
          </button>
        </template>
      </UDropdownMenu>
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

  <div v-if="showHistory" class="absolute left-3 right-3 top-12 z-30 bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden">
    <div class="flex items-center justify-between px-3 py-2 border-b border-zinc-100">
      <span class="text-[12px] font-semibold text-zinc-700">会话历史树</span>
      <button class="text-zinc-400 hover:text-zinc-700" title="关闭历史树" @click="showHistory = false"><X class="w-3.5 h-3.5" /></button>
    </div>
    <div class="max-h-56 overflow-y-auto p-2 space-y-1">
      <div v-for="message in historyMessages" :key="message.id" class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-50">
        <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="message.role === 'user' ? 'bg-brand' : 'bg-zinc-300'" />
        <span class="flex-1 min-w-0 truncate text-[11px] text-zinc-700">{{ message.content || (message.role === 'assistant' ? 'AI 响应' : '空消息') }}</span>
        <button class="p-1 text-zinc-400 hover:text-brand" title="从此处分支" @click="branchNode(message.id)"><GitBranch class="w-3 h-3" /></button>
        <button class="p-1 text-zinc-400 hover:text-brand" title="恢复到此处" @click="restoreNode(message.id)"><History class="w-3 h-3" /></button>
      </div>
      <div v-if="branchConversations.length" class="border-t border-zinc-100 mt-2 pt-2 text-[10px] text-zinc-400">
        已保存 {{ branchConversations.length }} 个历史分支
      </div>
    </div>
  </div>
</template>
