<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  Globe, FileSearch, FileText, Sparkles, Database, CheckCircle2,
  XCircle, Loader2, Clock, AlertCircle, ArrowRight, RefreshCw,
  Zap, Brain, Tag, Save, Eye,
} from '@lucide/vue'
import { useAiJobStore } from '@/stores/ai-job.store'
import { useAppStore } from '@/stores/app.store'
import { formatMs } from '@/utils/cost'
import type { AiJobEntity, AiJobStatus } from '@/types/ai-job'

// ── Props ──
const props = defineProps<{
  /** Compact mode for sidebar embed */
  compact?: boolean
  /** Show detailed stats per stage */
  showStats?: boolean
}>()

const aiJobStore = useAiJobStore()
const appStore = useAppStore()

// ── Pipeline Stage Definition ──
interface PipelineStage {
  id: string
  label: string
  sublabel: string
  icon: any
  color: string
  bgColor: string
  borderColor: string
  activeColor: string
  doneColor: string
  errorColor: string
}

const stages: PipelineStage[] = [
  {
    id: 'capture',
    label: '网页捕获',
    sublabel: 'Content Script',
    icon: Globe,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    activeColor: 'ring-blue-400',
    doneColor: 'text-blue-500',
    errorColor: 'text-red-500',
  },
  {
    id: 'extract',
    label: '正文提取',
    sublabel: 'defuddle',
    icon: FileSearch,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    activeColor: 'ring-indigo-400',
    doneColor: 'text-indigo-500',
    errorColor: 'text-red-500',
  },
  {
    id: 'markdown',
    label: 'Markdown 生成',
    sublabel: 'Turndown',
    icon: FileText,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
    activeColor: 'ring-violet-400',
    doneColor: 'text-violet-500',
    errorColor: 'text-red-500',
  },
  {
    id: 'ai-analyze',
    label: 'AI 深度分析',
    sublabel: 'LLM Stream',
    icon: Sparkles,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    activeColor: 'ring-amber-400',
    doneColor: 'text-amber-500',
    errorColor: 'text-red-500',
  },
  {
    id: 'tag-generate',
    label: '智能标签',
    sublabel: 'Auto Tag',
    icon: Tag,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    activeColor: 'ring-teal-400',
    doneColor: 'text-teal-500',
    errorColor: 'text-red-500',
  },
  {
    id: 'persist',
    label: '本地持久化',
    sublabel: 'IndexedDB',
    icon: Database,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    activeColor: 'ring-emerald-400',
    doneColor: 'text-emerald-500',
    errorColor: 'text-red-500',
  },
]

// ── Stage Status Tracking ──
interface StageState {
  status: 'idle' | 'active' | 'done' | 'error'
  progress: number // 0-100
  duration?: number // ms
  detail?: string
}

const stageStates = ref<Record<string, StageState>>({
  capture: { status: 'idle', progress: 0 },
  extract: { status: 'idle', progress: 0 },
  markdown: { status: 'idle', progress: 0 },
  'ai-analyze': { status: 'idle', progress: 0 },
  'tag-generate': { status: 'idle', progress: 0 },
  persist: { status: 'idle', progress: 0 },
})

// ── Derived from live job data ──
const activeJobs = computed(() =>
  aiJobStore.jobs.filter((j) => j.status === 'processing' || j.status === 'pending')
)

const recentJobs = computed(() =>
  aiJobStore.jobs
    .filter((j) => j.status === 'success' || j.status === 'failed')
    .sort((a, b) => new Date(b.finishedAt ?? b.createdAt).getTime() - new Date(a.finishedAt ?? a.createdAt).getTime())
    .slice(0, 5)
)

// Map job statuses to pipeline stages
const pipelineActive = computed(() => {
  const hasProcessing = aiJobStore.stats.processing > 0
  const hasPending = aiJobStore.stats.pending > 0
  return hasProcessing || hasPending
})

// Update stage states based on live data
function updateStageStates() {
  const processing = aiJobStore.jobs.filter((j) => j.status === 'processing')
  const recentSuccess = aiJobStore.jobs.filter((j) => j.status === 'success')
  const recentFailed = aiJobStore.jobs.filter((j) => j.status === 'failed')
  const hasRecent = recentSuccess.length > 0 || recentFailed.length > 0

  // Reset to idle
  const reset: Record<string, StageState> = {
    capture: { status: 'idle', progress: 0 },
    extract: { status: 'idle', progress: 0 },
    markdown: { status: 'idle', progress: 0 },
    'ai-analyze': { status: 'idle', progress: 0 },
    'tag-generate': { status: 'idle', progress: 0 },
    persist: { status: 'idle', progress: 0 },
  }

  if (processing.length > 0) {
    // Simulate pipeline progression based on processing job presence
    // In a real system, each stage would emit events
    const job = processing[0]
    const elapsed = Date.now() - new Date(job.createdAt).getTime()
    const estimatedTotal = 30000 // 30s estimated total
    const overallProgress = Math.min(95, (elapsed / estimatedTotal) * 100)

    // Distribute progress across stages
    const stageProgress = [
      { id: 'capture', start: 0, end: 10 },
      { id: 'extract', start: 10, end: 30 },
      { id: 'markdown', start: 30, end: 45 },
      { id: 'ai-analyze', start: 45, end: 80 },
      { id: 'tag-generate', start: 80, end: 90 },
      { id: 'persist', start: 90, end: 100 },
    ]

    for (const sp of stageProgress) {
      if (overallProgress >= sp.end) {
        reset[sp.id] = { status: 'done', progress: 100 }
      } else if (overallProgress >= sp.start) {
        const localProgress = ((overallProgress - sp.start) / (sp.end - sp.start)) * 100
        reset[sp.id] = { status: 'active', progress: Math.round(localProgress) }
      } else {
        reset[sp.id] = { status: 'idle', progress: 0 }
      }
    }
  } else if (recentSuccess.length > 0) {
    // All stages done
    for (const s of stages) {
      reset[s.id] = { status: 'done', progress: 100 }
    }
  } else if (recentFailed.length > 0) {
    // Mark stages up to failure as done, failure stage as error
    const failedJob = recentFailed[0]
    // Simplified: mark AI analyze as error (most common failure point)
    reset['capture'].status = 'done'
    reset['capture'].progress = 100
    reset['extract'].status = 'done'
    reset['extract'].progress = 100
    reset['markdown'].status = 'done'
    reset['markdown'].progress = 100
    reset['ai-analyze'].status = 'error'
    reset['ai-analyze'].progress = 100
    reset['ai-analyze'].detail = failedJob.error ?? '分析失败'
  }

  stageStates.value = reset
}

// Watch for job changes
watch(
  () => aiJobStore.jobs,
  () => updateStageStates(),
  { deep: true }
)

// ── Flow animation ──
const flowAnimating = ref(false)
let flowTimer: ReturnType<typeof setInterval> | null = null

function startFlowAnimation() {
  flowAnimating.value = true
  flowTimer = setInterval(() => {
    updateStageStates()
  }, 1000)
}

function stopFlowAnimation() {
  flowAnimating.value = false
  if (flowTimer) {
    clearInterval(flowTimer)
    flowTimer = null
  }
}

watch(pipelineActive, (active) => {
  if (active) startFlowAnimation()
  else stopFlowAnimation()
})

onMounted(() => {
  updateStageStates()
  if (pipelineActive.value) startFlowAnimation()
})

onUnmounted(() => {
  stopFlowAnimation()
})

// ── Overall progress ──
const overallProgress = computed(() => {
  const done = stages.filter((s) => stageStates.value[s.id]?.status === 'done').length
  const active = stages.filter((s) => stageStates.value[s.id]?.status === 'active').length
  if (done === stages.length) return 100
  const stageWeight = 100 / stages.length
  let progress = done * stageWeight
  for (const s of stages) {
    const state = stageStates.value[s.id]
    if (state?.status === 'active') {
      progress += (state.progress / 100) * stageWeight
    }
  }
  return Math.round(progress)
})

const overallStatus = computed(() => {
  const hasError = stages.some((s) => stageStates.value[s.id]?.status === 'error')
  if (hasError) return 'error'
  const hasActive = stages.some((s) => stageStates.value[s.id]?.status === 'active')
  if (hasActive) return 'active'
  const allDone = stages.every((s) => stageStates.value[s.id]?.status === 'done')
  if (allDone) return 'done'
  return 'idle'
})

// ── Stage status helpers ──
function stageStatus(id: string): StageState {
  return stageStates.value[id] ?? { status: 'idle', progress: 0 }
}

function statusIcon(id: string): any {
  const state = stageStatus(id)
  switch (state.status) {
    case 'done': return CheckCircle2
    case 'active': return Loader2
    case 'error': return XCircle
    default: return stages.find((s) => s.id === id)?.icon ?? Clock
  }
}

function statusColorClass(id: string): string {
  const state = stageStatus(id)
  const stage = stages.find((s) => s.id === id)
  if (!stage) return ''
  switch (state.status) {
    case 'done': return 'text-emerald-500'
    case 'active': return stage.color
    case 'error': return 'text-red-500'
    default: return 'text-zinc-300'
  }
}

function statusBgClass(id: string): string {
  const state = stageStatus(id)
  const stage = stages.find((s) => s.id === id)
  if (!stage) return ''
  switch (state.status) {
    case 'done': return 'bg-emerald-50 border-emerald-200'
    case 'active': return `${stage.bgColor} ${stage.borderColor} ring-2 ${stage.activeColor}`
    case 'error': return 'bg-red-50 border-red-200'
    default: return 'bg-white border-zinc-200'
  }
}

// ── Connector line state ──
function connectorState(fromId: string, toId: string): 'done' | 'active' | 'idle' {
  const fromState = stageStatus(fromId)
  const toState = stageStatus(toId)
  if (fromState.status === 'done' && (toState.status === 'done' || toState.status === 'active' || toState.status === 'error')) {
    return 'done'
  }
  if (fromState.status === 'done' && toState.status === 'active') {
    return 'active'
  }
  return 'idle'
}

function connectorClass(state: 'done' | 'active' | 'idle'): string {
  switch (state) {
    case 'done': return 'bg-emerald-400'
    case 'active': return 'bg-blue-400 animate-pulse'
    default: return 'bg-zinc-200'
  }
}

// ── Mini timeline for recent jobs ──
const timelineJobs = computed(() => recentJobs.value.slice(0, 4))

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mi}`
}

function jobStatusConfig(status: AiJobStatus) {
  switch (status) {
    case 'success': return { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' }
    case 'failed': return { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' }
    case 'processing': return { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-50' }
    case 'pending': return { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' }
  }
}

// ── Expand/collapse detail ──
const expanded = ref(false)
</script>

<template>
  <div class="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
    <!-- Header -->
    <div class="px-4 py-3 flex items-center justify-between border-b border-zinc-100">
      <div class="flex items-center gap-2">
        <div
          class="w-7 h-7 rounded-lg flex items-center justify-center"
          :class="overallStatus === 'active' ? 'bg-blue-100' : overallStatus === 'done' ? 'bg-emerald-100' : overallStatus === 'error' ? 'bg-red-100' : 'bg-zinc-100'"
        >
          <component
            :is="overallStatus === 'active' ? Loader2 : overallStatus === 'done' ? CheckCircle2 : overallStatus === 'error' ? XCircle : Zap"
            class="w-4 h-4"
            :class="overallStatus === 'active' ? 'text-blue-600 animate-spin' : overallStatus === 'done' ? 'text-emerald-600' : overallStatus === 'error' ? 'text-red-500' : 'text-zinc-400'"
          />
        </div>
        <div>
          <div class="text-[13px] font-semibold text-zinc-900">AI 自动分析流程</div>
          <div class="text-[10px] text-zinc-400">
            <template v-if="overallStatus === 'active'">
              正在处理 · {{ aiJobStore.stats.processing }} 个任务 · {{ overallProgress }}%
            </template>
            <template v-else-if="overallStatus === 'done'">
              已完成 · 最近 {{ recentJobs.length }} 个任务
            </template>
            <template v-else-if="overallStatus === 'error'">
              存在失败任务 · 点击查看详情
            </template>
            <template v-else>
              空闲 · 等待新任务
            </template>
          </div>
        </div>
      </div>

      <!-- Overall progress ring -->
      <div class="flex items-center gap-2">
        <div class="relative w-9 h-9">
          <svg class="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" stroke-width="3" class="text-zinc-100" />
            <circle
              cx="18" cy="18" r="15" fill="none" stroke="currentColor" stroke-width="3"
              stroke-linecap="round"
              :class="overallStatus === 'error' ? 'text-red-400' : overallStatus === 'done' ? 'text-emerald-400' : 'text-blue-400'"
              :stroke-dasharray="`${(overallProgress / 100) * 94.25} 94.25`"
              :style="{ transition: 'stroke-dasharray 0.5s ease' }"
            />
          </svg>
          <div class="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-zinc-600 tabular-nums">
            {{ overallProgress }}%
          </div>
        </div>
        <button
          class="text-[10px] text-zinc-400 hover:text-zinc-600 transition-colors px-1.5 py-1 rounded hover:bg-zinc-100"
          @click="expanded = !expanded"
        >
          {{ expanded ? '收起' : '展开' }}
        </button>
      </div>
    </div>

    <!-- Pipeline Flow Diagram -->
    <div class="px-4 py-4">
      <!-- Horizontal pipeline (default) -->
      <div v-if="!compact" class="flex items-stretch gap-0">
        <template v-for="(stage, idx) in stages" :key="stage.id">
          <!-- Stage Node -->
          <div class="flex flex-col items-center relative" style="min-width: 0; flex: 1;">
            <!-- Node Circle -->
            <div
              class="relative w-11 h-11 rounded-xl flex items-center justify-center border-2 transition-all duration-300"
              :class="statusBgClass(stage.id)"
            >
              <component
                :is="statusIcon(stage.id)"
                class="w-5 h-5 transition-all duration-300"
                :class="[
                  statusColorClass(stage.id),
                  stageStatus(stage.id).status === 'active' ? 'animate-spin' : ''
                ]"
              />

              <!-- Pulse ring for active stage -->
              <div
                v-if="stageStatus(stage.id).status === 'active'"
                class="absolute inset-0 rounded-xl border-2 animate-ping opacity-30"
                :class="stage.borderColor.replace('border-', 'border-')"
              />

              <!-- Stage number badge -->
              <div
                class="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center"
                :class="stageStatus(stage.id).status === 'done' ? 'bg-emerald-500 text-white' : stageStatus(stage.id).status === 'active' ? 'bg-blue-500 text-white' : stageStatus(stage.id).status === 'error' ? 'bg-red-500 text-white' : 'bg-zinc-200 text-zinc-400'"
              >
                {{ idx + 1 }}
              </div>
            </div>

            <!-- Label -->
            <div class="mt-2 text-center">
              <div class="text-[11px] font-semibold" :class="stageStatus(stage.id).status === 'idle' ? 'text-zinc-400' : 'text-zinc-700'">
                {{ stage.label }}
              </div>
              <div class="text-[9px] text-zinc-400 mt-0.5">{{ stage.sublabel }}</div>
            </div>

            <!-- Progress bar under active stage -->
            <div v-if="stageStatus(stage.id).status === 'active'" class="mt-1.5 w-full max-w-[60px] h-1 bg-zinc-100 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="stage.color.replace('text-', 'bg-')"
                :style="{ width: `${stageStatus(stage.id).progress}%` }"
              />
            </div>

            <!-- Error detail -->
            <div v-if="stageStatus(stage.id).status === 'error' && stageStatus(stage.id).detail" class="mt-1 text-[9px] text-red-400 max-w-[80px] truncate" :title="stageStatus(stage.id).detail">
              {{ stageStatus(stage.id).detail }}
            </div>
          </div>

          <!-- Connector Line -->
          <div v-if="idx < stages.length - 1" class="flex items-start pt-[18px]">
            <div class="relative w-6 h-0.5 rounded-full transition-all duration-300"
              :class="connectorClass(connectorState(stage.id, stages[idx + 1].id))"
            >
              <!-- Flow particles for active connector -->
              <div
                v-if="connectorState(stage.id, stages[idx + 1].id) === 'active'"
                class="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white shadow-sm"
                style="animation: flowRight 1.2s ease-in-out infinite;"
              />
            </div>
          </div>
        </template>
      </div>

      <!-- Compact vertical pipeline (for sidebar) -->
      <div v-else class="flex flex-col gap-1">
        <template v-for="(stage, idx) in stages" :key="stage.id">
          <div class="flex items-center gap-2.5">
            <div
              class="w-7 h-7 rounded-lg flex items-center justify-center border transition-all duration-300 shrink-0"
              :class="statusBgClass(stage.id)"
            >
              <component
                :is="statusIcon(stage.id)"
                class="w-3.5 h-3.5"
                :class="[
                  statusColorClass(stage.id),
                  stageStatus(stage.id).status === 'active' ? 'animate-spin' : ''
                ]"
              />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-[11px] font-medium" :class="stageStatus(stage.id).status === 'idle' ? 'text-zinc-400' : 'text-zinc-700'">
                {{ stage.label }}
              </div>
              <div class="text-[9px] text-zinc-400">{{ stage.sublabel }}</div>
            </div>
            <div v-if="stageStatus(stage.id).status === 'active'" class="text-[9px] font-medium text-blue-500 tabular-nums">
              {{ stageStatus(stage.id).progress }}%
            </div>
            <component
              v-else-if="stageStatus(stage.id).status === 'done'"
              :is="CheckCircle2"
              class="w-3.5 h-3.5 text-emerald-400 shrink-0"
            />
            <component
              v-else-if="stageStatus(stage.id).status === 'error'"
              :is="XCircle"
              class="w-3.5 h-3.5 text-red-400 shrink-0"
            />
          </div>
          <!-- Vertical connector -->
          <div v-if="idx < stages.length - 1" class="ml-[14px] w-0.5 h-3 rounded-full"
            :class="connectorClass(connectorState(stage.id, stages[idx + 1].id))"
          />
        </template>
      </div>
    </div>

    <!-- Expanded Detail Panel -->
    <div v-if="expanded" class="border-t border-zinc-100 px-4 py-3 space-y-3">
      <!-- Live stats grid -->
      <div v-if="showStats" class="grid grid-cols-6 gap-1.5">
        <div
          v-for="stage in stages"
          :key="stage.id"
          class="text-center p-2 rounded-lg border"
          :class="statusBgClass(stage.id)"
        >
          <div class="text-[9px] text-zinc-400 mb-0.5">{{ stage.label }}</div>
          <div class="text-[11px] font-bold" :class="statusColorClass(stage.id)">
            <template v-if="stageStatus(stage.id).status === 'done'">✓</template>
            <template v-else-if="stageStatus(stage.id).status === 'active'">{{ stageStatus(stage.id).progress }}%</template>
            <template v-else-if="stageStatus(stage.id).status === 'error'">✗</template>
            <template velse>—</template>
          </div>
        </div>
      </div>

      <!-- Recent jobs timeline -->
      <div v-if="timelineJobs.length > 0">
        <div class="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">最近任务</div>
        <div class="space-y-1.5">
          <div
            v-for="job in timelineJobs"
            :key="job.id"
            class="flex items-center gap-2.5 p-2 rounded-lg bg-zinc-50 border border-zinc-100"
          >
            <div
              class="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
              :class="jobStatusConfig(job.status)?.bg"
            >
              <component
                :is="jobStatusConfig(job.status)?.icon"
                class="w-3.5 h-3.5"
                :class="[jobStatusConfig(job.status)?.color, job.status === 'processing' ? 'animate-spin' : '']"
              />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-[11px] font-medium text-zinc-700 truncate">
                {{ job.documentTitle || job.documentId.slice(0, 12) + '…' }}
              </div>
              <div class="text-[9px] text-zinc-400">
                {{ formatTime(job.finishedAt ?? job.createdAt) }}
                <span v-if="job.error" class="text-red-400 ml-1">· {{ job.error.slice(0, 30) }}</span>
              </div>
            </div>
            <div v-if="job.status === 'success'" class="text-[9px] text-emerald-500 font-medium tabular-nums">
              {{ formatMs(new Date(job.finishedAt!).getTime() - new Date(job.createdAt).getTime()) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="text-center py-4">
        <Brain class="w-6 h-6 text-zinc-300 mx-auto mb-1" />
        <div class="text-[11px] text-zinc-400">暂无分析任务记录</div>
        <div class="text-[10px] text-zinc-300 mt-0.5">在记忆库中选择文档后点击「批量分析」</div>
      </div>

      <!-- Action buttons -->
      <div class="flex items-center gap-2 pt-1">
        <button
          v-if="aiJobStore.stats.pending > 0 && !aiJobStore.draining"
          class="flex-1 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white bg-blue-500 hover:bg-blue-600 transition-colors flex items-center justify-center gap-1.5"
          @click="aiJobStore.drain()"
        >
          <Zap class="w-3 h-3" />
          开始处理 ({{ aiJobStore.stats.pending }})
        </button>
        <button
          v-if="aiJobStore.stats.failed > 0"
          class="px-3 py-1.5 rounded-lg text-[11px] font-medium text-red-500 bg-red-50 hover:bg-red-100 transition-colors flex items-center gap-1"
          @click="aiJobStore.retryAllFailed()"
        >
          <RefreshCw class="w-3 h-3" />
          重试失败 ({{ aiJobStore.stats.failed }})
        </button>
        <button
          class="px-3 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 bg-zinc-100 hover:bg-zinc-200 transition-colors flex items-center gap-1"
          @click="aiJobStore.loadJobs()"
        >
          <RefreshCw class="w-3 h-3" />
          刷新
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes flowRight {
  0% { left: 0; opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { left: 100%; opacity: 0; }
}
</style>
