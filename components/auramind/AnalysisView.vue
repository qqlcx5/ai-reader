<script lang="ts" setup>
import dayjs from 'dayjs'
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  Zap, Loader2, CheckCircle2, XCircle, Clock, RefreshCw, Trash2,
  Play, Pause, ChevronDown, ChevronRight, Filter, X, AlertCircle,
  Activity, Timer, CheckSquare, Square,
  ArrowUp, ArrowDown, MoreVertical, Plus, Ban,
} from '@lucide/vue'
import AnalysisConfigCenter from '@/components/auramind/AnalysisConfigCenter.vue'
import DocumentPickerDialog from '@/components/auramind/DocumentPickerDialog.vue'
import BatchAnalysisDialog from '@/components/auramind/BatchAnalysisDialog.vue'
import UDropdownMenu from '@/components/ui/UDropdownMenu.vue'
import { useAiJobStore } from '@/stores/ai-job.store'
import { useAppStore } from '@/stores/app.store'
import { useModelStore } from '@/stores/model.store'
import { usePromptTemplateStore } from '@/stores/prompt-template.store'
import { useDocumentStore } from '@/stores/document.store'
import { useChatStore } from '@/stores/chat.store'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { DocumentRepository } from '@/db/repositories/document.repository'
import { ChatRepository } from '@/db/repositories/chat.repository'
import { formatMs } from '@/utils/cost'
import type { AiJobEntity, AiJobStatus, AiJobPriority } from '@/types/ai-job'
import { PRIORITY_WEIGHT } from '@/types/ai-job'
import type { ModelConfig } from '@/types/model'

const aiJobStore = useAiJobStore()
const appStore = useAppStore()
const modelStore = useModelStore()
const promptStore = usePromptTemplateStore()
const documentStore = useDocumentStore()
const chatStore = useChatStore()
const workspaceStore = useWorkspaceStore()

// ── Polling for live updates while jobs are processing ──
let pollTimer: ReturnType<typeof setInterval> | null = null

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(() => {
    aiJobStore.loadJobs()
  }, 2000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

watch(
  () => aiJobStore.stats.pending + aiJobStore.stats.processing,
  (active) => {
    if (active > 0 && !aiJobStore.queuePaused) startPolling()
    else stopPolling()
  },
)

onMounted(async () => {
  await aiJobStore.loadJobs()
  await modelStore.loadModels()
  await promptStore.initTemplates()
  // If there are pending jobs and queue is not paused, auto-start draining
  if (aiJobStore.stats.pending > 0 && !aiJobStore.draining && !aiJobStore.queuePaused) {
    void aiJobStore.drain()
  }
})

onUnmounted(() => {
  stopPolling()
})

// ── Model name lookup ──
const modelMap = computed(() => {
  const map = new Map<string, ModelConfig>()
  for (const m of modelStore.models) map.set(m.id, m)
  return map
})

function modelName(id: string): string {
  return modelMap.value.get(id)?.name ?? id
}

function templateName(id: string): string {
  if (!id) return '无模板'
  return promptStore.templates.find((t) => t.id === id)?.title ?? id
}

// ── Filter UI ──
const showFilter = ref(false)
const statusOptions: { value: AiJobStatus | 'all'; label: string; icon: any; color: string }[] = [
  { value: 'all', label: '全部', icon: null, color: '' },
  { value: 'pending', label: '等待中', icon: Clock, color: 'text-amber-500' },
  { value: 'processing', label: '处理中', icon: Loader2, color: 'text-blue-500' },
  { value: 'success', label: '成功', icon: CheckCircle2, color: 'text-emerald-500' },
  { value: 'failed', label: '失败', icon: XCircle, color: 'text-red-500' },
  { value: 'cancelled', label: '已取消', icon: Ban, color: 'text-zinc-400' },
]

const modelFilterOptions = computed(() =>
  [{ value: '', label: '全部模型' },
   ...modelStore.models.map((m) => ({ value: m.id, label: m.name }))]
)

const hasActiveFilters = computed(
  () =>
    (aiJobStore.filter.status && aiJobStore.filter.status !== 'all') ||
    aiJobStore.filter.modelId ||
    aiJobStore.filter.search,
)

// ── Expanded job details ──
const expandedJobId = ref<string | null>(null)
const jobConversation = ref<{ content: string; modelId?: string } | null>(null)
const loadingConversation = ref(false)

async function toggleJobDetail(job: AiJobEntity) {
  if (expandedJobId.value === job.id) {
    expandedJobId.value = null
    jobConversation.value = null
    return
  }

  expandedJobId.value = job.id
  if (job.conversationId) {
    loadingConversation.value = true
    try {
      const conv = await ChatRepository.findById(job.conversationId)
      if (conv) {
        const assistantMsg = conv.messages.find((m) => m.role === 'assistant')
        jobConversation.value = {
          content: assistantMsg?.content ?? '(空)',
          modelId: assistantMsg?.modelId,
        }
      } else {
        jobConversation.value = null
      }
    } catch {
      jobConversation.value = null
    } finally {
      loadingConversation.value = false
    }
  } else {
    jobConversation.value = null
  }
}

// ── Actions ──
async function handleRetry(jobId: string) {
  await aiJobStore.retry(jobId)
  appStore.showToast('已重新入队', 'success')
}

async function handleRetryAllFailed() {
  const count = aiJobStore.jobs.filter((j) => j.status === 'failed' || j.status === 'cancelled').length
  if (!count) return
  await aiJobStore.retryAllFailed()
  appStore.showToast(`已重新入队 ${count} 个失败或取消任务`, 'success')
}

async function handleRemove(jobId: string) {
  await aiJobStore.remove(jobId)
}

async function handleClearByStatus(status: AiJobStatus) {
  await aiJobStore.clearByStatus(status)
  appStore.showToast('已清除', 'info')
}

async function handleDrain() {
  await aiJobStore.drain()
}

async function handleTogglePause() {
  await aiJobStore.toggleQueuePause()
  appStore.showToast(
    aiJobStore.queuePaused ? '队列已暂停' : '队列已恢复',
    'info',
  )
  // If unpaused and there are pending jobs, auto-drain
  if (!aiJobStore.queuePaused && aiJobStore.stats.pending > 0) {
    void aiJobStore.drain()
  }
}

// ── Multi-select batch actions ──
async function handleBatchRetry() {
  const count = aiJobStore.selectedCount
  if (!count) return
  await aiJobStore.retrySelected()
  appStore.showToast(`已重试 ${count} 个任务`, 'success')
}

async function handleBatchDelete() {
  const count = aiJobStore.selectedCount
  if (!count) return
  await aiJobStore.removeSelected()
  appStore.showToast(`已删除 ${count} 个任务`, 'info')
}

async function handleBatchPriority(priority: AiJobPriority) {
  const count = aiJobStore.selectedCount
  if (!count) return
  await aiJobStore.setPrioritySelected(priority)
  const label = priority === 'high' ? '高' : priority === 'low' ? '低' : '中'
  appStore.showToast(`已设置 ${count} 个任务优先级为${label}`, 'info')
}

// ── Single job priority ──
async function handleSetPriority(jobId: string, priority: AiJobPriority) {
  await aiJobStore.setPriority(jobId, priority)
}

// ── Drag-and-drop reorder (pending jobs only) ──
const dragJobId = ref<string | null>(null)
const dragOverJobId = ref<string | null>(null)

function onDragStart(jobId: string, e: DragEvent) {
  dragJobId.value = jobId
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', jobId)
  }
}

function onDragOver(jobId: string, e: DragEvent) {
  if (!dragJobId.value || dragJobId.value === jobId) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dragOverJobId.value = jobId
}

function onDragLeave() {
  dragOverJobId.value = null
}

async function onDrop(jobId: string, e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  const draggedId = dragJobId.value
  dragOverJobId.value = null
  dragJobId.value = null
  if (!draggedId || draggedId === jobId) return

  // Reorder: build new ordered list
  const pending = aiJobStore.sortedPendingJobs.map((j) => j.id)
  const fromIdx = pending.indexOf(draggedId)
  const toIdx = pending.indexOf(jobId)
  if (fromIdx < 0 || toIdx < 0) return
  pending.splice(fromIdx, 1)
  pending.splice(toIdx, 0, draggedId)
  await aiJobStore.reorderPendingJobs(pending)
}

// ── Navigate to conversation ──
async function openConversation(job: AiJobEntity) {
  if (!job.conversationId) return
  const doc = await DocumentRepository.findById(job.documentId)
  if (doc) {
    documentStore.setCurrentDocument(doc)
    await chatStore.loadConversations(doc.id)
    const conv = chatStore.conversations.find((c) => c.id === job.conversationId)
    if (conv) {
      chatStore.switchConversation(conv.id)
    }
    workspaceStore.setDocumentSource('library')
    appStore.setCurrentView('workspace')
  }
}

// ── Progress percentage ──
const progressPercent = computed(() => {
  const { total, pending, processing } = aiJobStore.stats
  if (total === 0) return 0
  const done = total - pending - processing
  return Math.round((done / total) * 100)
})

const activeCount = computed(() => aiJobStore.stats.pending + aiJobStore.stats.processing)

const filteredJobsLength = computed(() => aiJobStore.filteredJobs.length)

// ── Show pending list when viewing pending or all (for drag-and-drop) ──
const showDragDropList = computed(() => {
  const st = aiJobStore.filter.status
  return (!st || st === 'all' || st === 'pending') && aiJobStore.sortedPendingJobs.length > 1
})

// ── New analysis (from AnalysisView): pick docs → batch dialog ──
const showDocPicker = ref(false)
const showBatchDialog = ref(false)
const pickedDocIds = ref<string[]>([])

function startNewAnalysis() {
  showDocPicker.value = true
}

function onDocsPicked(ids: string[]) {
  pickedDocIds.value = ids
  showBatchDialog.value = true
}

// ── Cancel processing job ──
async function handleCancel(jobId: string) {
  await aiJobStore.cancel(jobId)
  appStore.showToast('已取消', 'info')
}

// ── Format helpers ──
function formatTime(iso: string): string {
  const date = dayjs(iso)
  if (!date.isValid()) return iso
  const minutes = dayjs().diff(date, 'minute')
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  return date.format('MM-DD HH:mm')
}

function jobDuration(job: AiJobEntity): string {
  if (!job.finishedAt || !job.createdAt) return '—'
  const ms = dayjs(job.finishedAt).valueOf() - dayjs(job.createdAt).valueOf()
  if (ms <= 0) return '—'
  return formatMs(ms)
}

function priorityLabel(p?: AiJobPriority): string {
  return p === 'high' ? '高' : p === 'low' ? '低' : '中'
}

function priorityColor(p?: AiJobPriority): string {
  return p === 'high' ? 'text-red-500' : p === 'low' ? 'text-zinc-400' : 'text-zinc-500'
}

const statusConfig: Record<AiJobStatus, { color: string; bg: string; icon: any; label: string }> = {
  pending: { color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock, label: '等待中' },
  processing: { color: 'text-blue-600', bg: 'bg-blue-50', icon: Loader2, label: '处理中' },
  success: { color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle2, label: '成功' },
  failed: { color: 'text-red-600', bg: 'bg-red-50', icon: XCircle, label: '失败' },
  cancelled: { color: 'text-zinc-500', bg: 'bg-zinc-100', icon: XCircle, label: '已取消' },
}
</script>

<template>
  <div class="flex-1 min-h-0 flex-col bg-surface flex">
    <!-- Header -->
    <div class="h-12 shrink-0 px-4 flex items-center justify-between border-b border-zinc-200/70 bg-surface/90 backdrop-blur-md">
      <div class="text-[14px] font-semibold flex items-center gap-2">
        <Zap class="w-4 h-4 text-brand" />
        AI 分析
        <span v-if="aiJobStore.stats.total > 0" class="text-[11px] font-normal text-zinc-400">
          {{ aiJobStore.stats.total }} 个任务
        </span>
        <!-- Queue paused indicator -->
        <span v-if="aiJobStore.queuePaused" class="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-100 text-amber-600 flex items-center gap-0.5">
          <Pause class="w-2.5 h-2.5" /> 队列已暂停
        </span>
      </div>
      <div class="flex items-center gap-1.5">
        <!-- New analysis -->
        <button
          class="px-2.5 py-1 rounded-md text-[11px] font-medium text-white bg-brand hover:bg-brand-dark transition-colors flex items-center gap-1"
          @click="startNewAnalysis"
        >
          <Plus class="w-3 h-3" />
          新建分析
        </button>
        <!-- Multi-select toggle -->
        <button
          class="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1"
          :class="aiJobStore.selectMode
            ? 'bg-brand text-white'
            : 'text-zinc-500 bg-white border border-zinc-200 hover:bg-zinc-50'"
          @click="aiJobStore.toggleSelectMode()"
        >
          <CheckSquare class="w-3 h-3" />
          {{ aiJobStore.selectMode ? '退出多选' : '多选' }}
        </button>
        <!-- Pause/Resume queue -->
        <button
          v-if="aiJobStore.stats.pending > 0 || aiJobStore.queuePaused"
          class="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1"
          :class="aiJobStore.queuePaused
            ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
            : 'text-amber-600 bg-amber-50 hover:bg-amber-100'"
          @click="handleTogglePause"
        >
          <component :is="aiJobStore.queuePaused ? Play : Pause" class="w-3 h-3" />
          {{ aiJobStore.queuePaused ? '恢复队列' : '暂停队列' }}
        </button>
        <!-- Retry all failed -->
        <button
          v-if="aiJobStore.stats.failed > 0 || aiJobStore.stats.cancelled > 0"
          class="px-2.5 py-1 rounded-md text-[11px] font-medium text-red-500 bg-red-50 hover:bg-red-100 transition-colors flex items-center gap-1"
          @click="handleRetryAllFailed"
        >
          <RefreshCw class="w-3 h-3" /> 重试失败/取消
        </button>
        <!-- Start processing -->
        <button
          v-if="!aiJobStore.queuePaused"
          class="px-2.5 py-1 rounded-md text-[11px] font-medium text-zinc-500 bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors flex items-center gap-1"
          :class="{ 'opacity-50 pointer-events-none': aiJobStore.stats.pending === 0 || aiJobStore.draining }"
          @click="handleDrain"
        >
          <Play class="w-3 h-3" />
          {{ aiJobStore.draining ? '处理中…' : '开始处理' }}
        </button>
      </div>
    </div>

    <!-- Batch action bar (when in select mode and have selection) -->
    <div
      v-if="aiJobStore.selectMode && aiJobStore.selectedCount > 0"
      class="shrink-0 px-4 py-2 flex items-center gap-2 border-b border-zinc-200 bg-brand/5"
    >
      <span class="text-[12px] font-medium text-brand">
        已选 {{ aiJobStore.selectedCount }} 项
      </span>
      <div class="flex-1" />
      <!-- Priority dropdown -->
      <UDropdownMenu
        :items="[
          { key: 'high', label: '高优先级' },
          { key: 'normal', label: '中优先级' },
          { key: 'low', label: '低优先级' },
        ]"
        @select="(item) => handleBatchPriority(item.key as AiJobPriority)"
      >
        <template #trigger>
          <button class="px-2.5 py-1 rounded-md text-[11px] font-medium text-zinc-500 bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors flex items-center gap-1">
            <ArrowUp class="w-3 h-3" /> 优先级
          </button>
        </template>
      </UDropdownMenu>
      <button
        class="px-2.5 py-1 rounded-md text-[11px] font-medium text-blue-500 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center gap-1"
        @click="handleBatchRetry"
      >
        <RefreshCw class="w-3 h-3" /> 重试
      </button>
      <button
        class="px-2.5 py-1 rounded-md text-[11px] font-medium text-red-500 bg-red-50 hover:bg-red-100 transition-colors flex items-center gap-1"
        @click="handleBatchDelete"
      >
        <Trash2 class="w-3 h-3" /> 删除
      </button>
      <button
        class="px-2.5 py-1 rounded-md text-[11px] text-zinc-400 hover:text-zinc-600 transition-colors"
        @click="aiJobStore.selectNone()"
      >
        取消选择
      </button>
    </div>

    <main class="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-4">
      <!-- Analysis Config Center -->
      <AnalysisConfigCenter />

      <!-- Stats Dashboard -->
      <div class="grid grid-cols-4 gap-2.5">
        <div class="bg-white rounded-xl border border-zinc-200 shadow-sm p-3">
          <div class="flex items-center gap-1 text-[10px] text-zinc-400">
            <Activity class="w-3 h-3" /> 总任务
          </div>
          <div class="text-[18px] font-semibold text-zinc-900 mt-0.5">{{ aiJobStore.stats.total }}</div>
        </div>
        <div class="bg-white rounded-xl border border-zinc-200 shadow-sm p-3">
          <div class="flex items-center gap-1 text-[10px] text-zinc-400">
            <CheckCircle2 class="w-3 h-3 text-emerald-500" /> 成功
          </div>
          <div class="text-[18px] font-semibold text-emerald-600 mt-0.5">{{ aiJobStore.stats.success }}</div>
        </div>
        <div class="bg-white rounded-xl border border-zinc-200 shadow-sm p-3">
          <div class="flex items-center gap-1 text-[10px] text-zinc-400">
            <XCircle class="w-3 h-3 text-red-500" /> 失败
          </div>
          <div class="text-[18px] font-semibold text-red-500 mt-0.5">{{ aiJobStore.stats.failed }}</div>
        </div>
        <div class="bg-white rounded-xl border border-zinc-200 shadow-sm p-3">
          <div class="flex items-center gap-1 text-[10px] text-zinc-400">
            <Timer class="w-3 h-3" /> 平均耗时
          </div>
          <div class="text-[18px] font-semibold text-zinc-900 mt-0.5">{{ formatMs(aiJobStore.stats.avgDurationMs) }}</div>
        </div>
      </div>

      <!-- Progress bar (when active and not paused) -->
      <div v-if="activeCount > 0" class="bg-white rounded-xl border border-zinc-200 shadow-sm p-3.5">
        <div class="flex items-center justify-between text-[12px] mb-2">
          <span class="font-medium text-zinc-700 flex items-center gap-1.5">
            处理进度
            <span v-if="aiJobStore.queuePaused" class="text-[10px] text-amber-500 flex items-center gap-0.5">
              <Pause class="w-2.5 h-2.5" /> 已暂停
            </span>
          </span>
          <span class="text-zinc-400 tabular-nums">
            {{ aiJobStore.stats.total - activeCount }} / {{ aiJobStore.stats.total }}（{{ progressPercent }}%）
          </span>
        </div>
        <div class="h-2 bg-zinc-100 rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="aiJobStore.queuePaused ? 'bg-amber-400' : 'bg-brand'"
            :style="{ width: `${progressPercent}%` }"
          />
        </div>
        <div class="flex items-center gap-3 mt-2 text-[10px] text-zinc-400">
          <span class="flex items-center gap-0.5">
            <Clock class="w-2.5 h-2.5 text-amber-500" /> 等待 {{ aiJobStore.stats.pending }}
          </span>
          <span class="flex items-center gap-0.5">
            <Loader2 class="w-2.5 h-2.5 text-blue-500 animate-spin" /> 处理 {{ aiJobStore.stats.processing }}
          </span>
        </div>
      </div>

      <!-- Pending jobs drag-and-drop list (only when not paused and has multiple pending) -->
      <div v-if="showDragDropList && !aiJobStore.queuePaused" class="bg-white rounded-xl border border-zinc-200 shadow-sm p-3">
        <div class="text-[11px] text-zinc-400 mb-2 flex items-center gap-1">
          <ArrowDown class="w-3 h-3" /> 拖拽调整等待中任务的执行顺序
        </div>
        <div class="flex flex-col gap-1">
          <div
            v-for="(job, idx) in aiJobStore.sortedPendingJobs"
            :key="job.id"
            draggable="true"
            class="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing transition-colors"
            :class="dragOverJobId === job.id ? 'bg-brand/10 border border-brand/30' : 'hover:bg-zinc-50 border border-transparent'"
            @dragstart="onDragStart(job.id, $event)"
            @dragover="onDragOver(job.id, $event)"
            @dragleave="onDragLeave"
            @drop="onDrop(job.id, $event)"
            @dragend="dragJobId = null; dragOverJobId = null"
          >
            <span class="text-[10px] text-zinc-300 tabular-nums w-4">{{ idx + 1 }}</span>
            <Clock class="w-3 h-3 text-amber-500 shrink-0" />
            <span class="text-[12px] text-zinc-700 truncate flex-1">{{ job.documentTitle || job.documentId }}</span>
            <span class="text-[10px] text-zinc-400">{{ modelName(job.modelId) }}</span>
            <span v-if="job.priority && job.priority !== 'normal'" class="text-[9px] px-1 rounded" :class="job.priority === 'high' ? 'bg-red-50 text-red-500' : 'bg-zinc-100 text-zinc-400'">
              {{ priorityLabel(job.priority) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Filter bar -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <button
          v-for="opt in statusOptions"
          :key="opt.value"
          class="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1"
          :class="(aiJobStore.filter.status || 'all') === opt.value
            ? 'bg-zinc-900 text-white'
            : 'bg-white text-zinc-500 border border-zinc-200 hover:bg-zinc-50'"
          @click="aiJobStore.setFilter({ status: opt.value })"
        >
          <component v-if="opt.icon" :is="opt.icon" class="w-3 h-3" :class="opt.color" />
          {{ opt.label }}
          <span v-if="opt.value !== 'all'" class="tabular-nums opacity-60">
            {{ opt.value === 'pending' ? aiJobStore.stats.pending
               : opt.value === 'processing' ? aiJobStore.stats.processing
               : opt.value === 'success' ? aiJobStore.stats.success
               : opt.value === 'cancelled' ? aiJobStore.stats.cancelled
               : aiJobStore.stats.failed }}
          </span>
        </button>

        <div class="ml-auto flex items-center gap-1.5">
          <select
            v-if="showFilter"
            :value="aiJobStore.filter.modelId || ''"
            class="px-2 py-1 rounded-md text-[11px] bg-white border border-zinc-200 text-zinc-600 outline-none"
            @change="(e: any) => aiJobStore.setFilter({ modelId: e.target.value || undefined })"
          >
            <option v-for="opt in modelFilterOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>

          <button
            class="p-1 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
            :class="{ 'text-brand bg-brand/10': showFilter }"
            @click="showFilter = !showFilter"
          >
            <Filter class="w-3.5 h-3.5" />
          </button>

          <button
            v-if="hasActiveFilters"
            class="p-1 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
            @click="aiJobStore.resetFilter()"
          >
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <!-- Select-all bar (in select mode) -->
      <div v-if="aiJobStore.selectMode" class="flex items-center gap-2 text-[11px] text-zinc-400">
        <button class="hover:text-zinc-600 transition-colors" @click="aiJobStore.selectAll()">
          全选 {{ filteredJobsLength }}
        </button>
        <span>·</span>
        <button class="hover:text-zinc-600 transition-colors" @click="aiJobStore.selectNone()">
          取消全选
        </button>
      </div>

      <!-- Job list -->
      <div v-if="filteredJobsLength === 0" class="text-center py-16">
        <Zap class="w-8 h-8 text-zinc-300 mx-auto mb-2" />
        <div class="text-[13px] text-zinc-400">
          {{ hasActiveFilters ? '没有匹配的任务' : '暂无分析任务' }}
        </div>
        <div v-if="!hasActiveFilters" class="text-[11px] text-zinc-400 mt-1">
          在记忆库中多选文档后点击「批量分析」即可创建
        </div>
      </div>

      <div v-else class="flex flex-col gap-1.5">
        <div
          v-for="job in aiJobStore.filteredJobs"
          :key="job.id"
          class="bg-white rounded-xl border shadow-sm overflow-hidden transition-colors"
          :class="aiJobStore.selectedIds.has(job.id) ? 'border-brand ring-1 ring-brand/20' : 'border-zinc-200'"
        >
          <!-- Job row -->
          <div class="flex items-center gap-3 px-3.5 py-2.5">
            <!-- Checkbox (in select mode) -->
            <button
              v-if="aiJobStore.selectMode"
              class="shrink-0 p-0.5"
              @click.stop="aiJobStore.toggleSelect(job.id)"
            >
              <component
                :is="aiJobStore.selectedIds.has(job.id) ? CheckSquare : Square"
                class="w-4 h-4 transition-colors"
                :class="aiJobStore.selectedIds.has(job.id) ? 'text-brand' : 'text-zinc-300'"
              />
            </button>

            <!-- Clickable area (expand detail) -->
            <div
              class="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
              @click="aiJobStore.selectMode ? aiJobStore.toggleSelect(job.id) : toggleJobDetail(job)"
            >
              <!-- Status icon -->
              <div class="shrink-0">
                <component
                  :is="statusConfig[job.status].icon"
                  class="w-4 h-4"
                  :class="[statusConfig[job.status].color, job.status === 'processing' ? 'animate-spin' : '']"
                />
              </div>

              <!-- Title + meta -->
              <div class="min-w-0 flex-1">
                <div class="text-[13px] font-medium text-zinc-900 truncate">
                  {{ job.documentTitle || job.documentId }}
                </div>
                <div class="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-2">
                  <span>{{ modelName(job.modelId) }}</span>
                  <span>·</span>
                  <span>{{ templateName(job.promptTemplateId) }}</span>
                  <span>·</span>
                  <span>{{ formatTime(job.createdAt) }}</span>
                  <span v-if="job.batchId" class="text-brand/60">· 批次</span>
                  <span v-if="job.priority && job.priority !== 'normal'" class="font-medium" :class="priorityColor(job.priority)">
                    · {{ priorityLabel(job.priority) }}优先
                  </span>
                </div>
              </div>

              <!-- Duration / error preview -->
              <div class="shrink-0 text-right">
                <div v-if="job.status === 'success'" class="text-[11px] text-zinc-400 tabular-nums">{{ jobDuration(job) }}</div>
                <div v-else-if="job.status === 'failed'" class="text-[11px] text-red-400 truncate max-w-[120px]">{{ job.error }}</div>
                <div v-else class="text-[11px] text-zinc-400">—</div>
              </div>

              <!-- Priority menu (pending jobs only) -->
              <UDropdownMenu
                v-if="job.status === 'pending'"
                :items="[
                  { key: 'high', label: `高优先级${job.priority === 'high' ? ' ✓' : ''}` },
                  { key: 'normal', label: `中优先级${job.priority === 'normal' || !job.priority ? ' ✓' : ''}` },
                  { key: 'low', label: `低优先级${job.priority === 'low' ? ' ✓' : ''}` },
                ]"
                content-class="min-w-[100px]"
                @select="(item) => handleSetPriority(job.id, item.key as AiJobPriority)"
              >
                <template #trigger>
                  <button class="p-1 rounded-md text-zinc-300 hover:text-zinc-500 hover:bg-zinc-100 transition-colors shrink-0">
                    <MoreVertical class="w-3.5 h-3.5" />
                  </button>
                </template>
              </UDropdownMenu>

              <!-- Expand chevron (hidden in select mode) -->
              <ChevronRight
                v-if="!aiJobStore.selectMode && expandedJobId !== job.id"
                class="w-3.5 h-3.5 text-zinc-300 shrink-0"
              />
              <ChevronDown
                v-if="!aiJobStore.selectMode && expandedJobId === job.id"
                class="w-3.5 h-3.5 text-zinc-400 shrink-0"
              />
            </div>
          </div>

          <!-- Expanded detail -->
          <div v-if="expandedJobId === job.id && !aiJobStore.selectMode" class="px-3.5 py-3 bg-zinc-50/60 border-t border-zinc-100">
            <!-- Error message -->
            <div v-if="job.status === 'failed' && job.error" class="mb-2.5">
              <div class="flex items-start gap-1.5 text-[11px] text-red-500 bg-red-50 rounded-lg p-2">
                <AlertCircle class="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span class="break-all">{{ job.error }}</span>
              </div>
            </div>

            <!-- Loading conversation -->
            <div v-if="loadingConversation" class="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <Loader2 class="w-3 h-3 animate-spin" /> 加载分析结果…
            </div>

            <!-- Conversation content preview -->
            <div v-else-if="jobConversation" class="mb-2.5">
              <div class="text-[10px] text-zinc-400 mb-1">分析结果预览</div>
              <div class="text-[12px] text-zinc-600 leading-relaxed bg-white rounded-lg border border-zinc-100 p-2.5 max-h-48 overflow-y-auto whitespace-pre-wrap">{{ jobConversation.content.slice(0, 500) }}{{ jobConversation.content.length > 500 ? '…' : '' }}</div>
            </div>

            <!-- Meta details -->
            <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-zinc-400 mb-2.5">
              <div>文档 ID: <span class="text-zinc-500">{{ job.documentId.slice(0, 12) }}…</span></div>
              <div>任务 ID: <span class="text-zinc-500">{{ job.id.slice(0, 12) }}…</span></div>
              <div>重试次数: <span class="text-zinc-500">{{ job.retries }}</span></div>
              <div>来源: <span class="text-zinc-500">{{ job.jobSource === 'manual' ? '手动触发' : '自动触发' }}</span></div>
              <div v-if="job.priority">优先级: <span :class="priorityColor(job.priority)">{{ priorityLabel(job.priority) }}</span></div>
              <div v-if="job.sortOrder !== undefined">排序: <span class="text-zinc-500">{{ job.sortOrder }}</span></div>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2">
              <div
                v-if="job.status === 'processing'"
                class="px-2.5 py-1 rounded-md text-[11px] font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors flex items-center gap-1"
                @click.stop="handleCancel(job.id)"
              >
                <Ban class="w-3 h-3" /> 取消
              </div>
              <div
                v-if="job.status === 'failed' || job.status === 'cancelled'"
                class="px-2.5 py-1 rounded-md text-[11px] font-medium text-blue-500 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center gap-1"
                @click.stop="handleRetry(job.id)"
              >
                <RefreshCw class="w-3 h-3" /> 重试
            </div>
              <div
                v-if="job.status === 'success' && job.conversationId"
                class="px-2.5 py-1 rounded-md text-[11px] font-medium text-brand bg-brand/10 hover:bg-brand/20 transition-colors flex items-center gap-1"
                @click.stop="openConversation(job)"
              >
                <Zap class="w-3 h-3" /> 查看对话
              </div>
              <button
                class="px-2.5 py-1 rounded-md text-[11px] font-medium text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors flex items-center gap-1"
                @click.stop="handleRemove(job.id)"
              >
                <Trash2 class="w-3 h-3" /> 删除
              </button>
            </div>
          </div>
        </div>

        <!-- Bulk clear actions at bottom -->
        <div v-if="aiJobStore.stats.success > 0 || aiJobStore.stats.failed > 0 || aiJobStore.stats.cancelled > 0" class="flex items-center justify-center gap-2 pt-3 pb-2">
          <button
            v-if="aiJobStore.stats.success > 0"
            class="px-2.5 py-1 rounded-md text-[11px] text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
            @click="handleClearByStatus('success')"
          >
            清除成功 ({{ aiJobStore.stats.success }})
          </button>
          <button
            v-if="aiJobStore.stats.failed > 0"
            class="px-2.5 py-1 rounded-md text-[11px] text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            @click="handleClearByStatus('failed')"
          >
            清除失败 ({{ aiJobStore.stats.failed }})
          </button>
          <button
            v-if="aiJobStore.stats.cancelled > 0"
            class="px-2.5 py-1 rounded-md text-[11px] text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
            @click="handleClearByStatus('cancelled')"
          >
            清除已取消 ({{ aiJobStore.stats.cancelled }})
          </button>
        </div>
      </div>
    </main>

    <!-- New analysis dialogs -->
    <DocumentPickerDialog
      :open="showDocPicker"
      @close="showDocPicker = false"
      @confirm="onDocsPicked"
    />
    <BatchAnalysisDialog
      :open="showBatchDialog"
      :document-count="pickedDocIds.length"
      :document-ids="pickedDocIds"
      @close="showBatchDialog = false"
    />
  </div>
</template>
