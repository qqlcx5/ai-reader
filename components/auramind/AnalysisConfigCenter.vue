<script lang="ts" setup>
import dayjs from 'dayjs'
import { ref, computed, onMounted, watch } from 'vue'
import {
  Zap, Clock, Tag, Brain, Settings2, Plus, Trash2, Edit3,
  ChevronDown, ChevronRight, Play, Pause, CheckCircle2, XCircle,
  Loader2, AlertCircle, DollarSign, Timer, TrendingUp, Save,
} from '@lucide/vue'
import { useAiJobStore } from '@/stores/ai-job.store'
import { useWorkflowStore } from '@/stores/workflow.store'
import { useScheduleStore } from '@/stores/schedule.store'
import { useAnalysisRuleStore } from '@/stores/analysis-rule.store'
import { useModelStore } from '@/stores/model.store'
import { usePromptTemplateStore } from '@/stores/prompt-template.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useAppStore } from '@/stores/app.store'
import Select from '@/components/ui/Select.vue'
import UButton from '@/components/ui/UButton.vue'
import Switch from '@/components/ui/Switch.vue'
import UInput from '@/components/ui/UInput.vue'
import UTextarea from '@/components/ui/UTextarea.vue'
import type { AutoAnalysisSettings } from '@/types/settings'
import type { ModelConfig } from '@/types/model'
import type { WorkflowEntity } from '@/types/workflow'
import type { ScheduleEntity } from '@/types/schedule'
import type { AnalysisRuleEntity } from '@/types/analysis-rule'
import { ChatRepository } from '@/db/repositories/chat.repository'
import { aggregateUsage, type UsageAggregate, formatTokens, formatCNY } from '@/utils/cost'
import type { PromptTemplate } from '@/types/prompt-template'

// ── Stores ──
const aiJobStore = useAiJobStore()
const workflowStore = useWorkflowStore()
const scheduleStore = useScheduleStore()
const analysisRuleStore = useAnalysisRuleStore()
const modelStore = useModelStore()
const promptStore = usePromptTemplateStore()
const settingsStore = useSettingsStore()
const appStore = useAppStore()

// ── Tab State ──
type TabId = 'rules' | 'workflow' | 'schedule' | 'cost'
const activeTab = ref<TabId>('rules')

const tabs = [
  { id: 'rules' as TabId, label: '自动规则', icon: Zap },
  { id: 'workflow' as TabId, label: '工作流编排', icon: Brain },
  { id: 'schedule' as TabId, label: '定时计划', icon: Clock },
  { id: 'cost' as TabId, label: '成本统计', icon: DollarSign },
]

// ── Expanded sections ──
const expandedSections = ref<Set<string>>(new Set(['auto-enable']))

function toggleSection(id: string) {
  const s = new Set(expandedSections.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  expandedSections.value = s
}

// ── Auto Analysis Rules (directly bound to store, no local copy) ──
const autoCfg = computed(() => settingsStore.settings.autoAnalysis)

function updateAutoCfg(patch: Partial<AutoAnalysisSettings>) {
  settingsStore.updateAutoAnalysis(patch)
}

// ── Advanced analysis rules (backed by analysisRuleStore + IndexedDB) ──
const analysisRules = computed(() => analysisRuleStore.rules)

function addRule() {
  const draft = analysisRuleStore.createDraft()
  // Seed model/template from current auto-analysis defaults for convenience.
  draft.modelId = autoCfg.value.modelId || modelStore.defaultModel?.id || ''
  draft.promptTemplateId = autoCfg.value.promptTemplateId || ''
  void analysisRuleStore.save(draft)
}

async function removeRule(id: string) {
  await analysisRuleStore.remove(id)
}

async function persistRule(rule: AnalysisRuleEntity) {
  await analysisRuleStore.save(rule)
}

// ── Workflow orchestration (backed by workflowStore + IndexedDB) ──
const workflows = computed(() => workflowStore.workflows)

function addWorkflow() {
  const draft = workflowStore.createDraft()
  void workflowStore.save(draft)
}

async function removeWorkflow(id: string) {
  await workflowStore.remove(id)
}

async function addStep(wfId: string) {
  await workflowStore.addStep(wfId)
}

async function removeStep(wfId: string, stepId: string) {
  await workflowStore.removeStep(wfId, stepId)
}

// Persist on field edits. v-model mutates the store object in place; we save
// on @change (fires on blur / selection) to avoid the deep-watch recursion
// that an auto-save watcher would cause (save → store updates array →
// watch fires → save again → ...).
async function persistWorkflow(wf: WorkflowEntity) {
  await workflowStore.save(wf)
}

// ── Schedule (backed by scheduleStore + IndexedDB; fired by background alarm) ──
const schedules = computed(() => scheduleStore.schedules)

function addSchedule() {
  const draft = scheduleStore.createDraft()
  void scheduleStore.save(draft)
}

async function removeSchedule(id: string) {
  await scheduleStore.remove(id)
}

async function persistSchedule(s: ScheduleEntity) {
  await scheduleStore.save(s)
}

const cronPresets = [
  { label: '每天 23:00', value: '0 23 * * *' },
  { label: '每天 09:00', value: '0 9 * * *' },
  { label: '工作日 09:00', value: '0 9 * * 1-5' },
  { label: '每周日 20:00', value: '0 20 * * 0' },
  { label: '每 6 小时', value: '0 */6 * * *' },
]

// ── Real usage stats ──
const usageStats = ref<UsageAggregate>(aggregateUsage([], []))

async function refreshUsageStats() {
  const conversations = await ChatRepository.findAll()
  usageStats.value = aggregateUsage(conversations, modelStore.models)
}

const costStats = computed(() => ({
  totalJobs: usageStats.value.totalMessages,
  inputTokens: usageStats.value.totalPrompt,
  outputTokens: usageStats.value.totalCompletion,
  totalTokens: usageStats.value.totalTokens,
  actualCostCNY: usageStats.value.totalCost,
  avgDurationMs: usageStats.value.avgDurationMs,
  successRate: aiJobStore.stats.successRate,
}))

// ── Model & Template options ──
const modelOptions = computed(() =>
  modelStore.models
    .filter((m) => m.enabled)
    .map((m) => ({ value: m.id, label: m.name }))
)

const templateOptions = computed(() => [
  { value: '', label: '不使用模板' },
  ...promptStore.templates.map((t) => ({ value: t.id, label: t.title })),
])

// ── Save handler (for manual save button; auto-save happens on each field change) ──
const saving = ref(false)

async function saveAllConfigs() {
  saving.value = true
  try {
    // autoAnalysis is already persisted via updateAutoAnalysis on each change
    // This button serves as a confirmation + refreshes stats
    await aiJobStore.refreshStats()
    await aiJobStore.refreshPauseState()
    appStore.showToast('配置已保存', 'success')
  } catch (e) {
    appStore.showToast('保存失败', 'error')
  } finally {
    saving.value = false
  }
}

async function toggleQueuePause() {
  await aiJobStore.toggleQueuePause()
}

// ── Validation: warn when auto-analysis is on but no model configured ──
const autoCfgWarnings = computed<string[]>(() => {
  const warns: string[] = []
  if (!autoCfg.value.enabled) return warns
  if (!autoCfg.value.modelId && !modelStore.defaultModel) {
    warns.push('未配置默认模型，自动分析将无法执行')
  }
  if (!autoCfg.value.promptTemplateId) {
    warns.push('未选择提示词模板，将仅使用系统提示词（可能效果有限）')
  }
  return warns
})

watch(
  () => aiJobStore.stats.success,
  () => { void refreshUsageStats() },
)

// ── Lifecycle ──
onMounted(async () => {
  await Promise.all([
    modelStore.loadModels(),
    promptStore.initTemplates(),
    settingsStore.loadSettings(),
    aiJobStore.loadJobs(),
    workflowStore.load(),
    scheduleStore.load(),
    analysisRuleStore.load(),
  ])
  await refreshUsageStats()
  // autoCfg is a computed from store — no manual sync needed
})
</script>

<template>
  <div class="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
    <!-- Header -->
    <div class="px-4 py-3 flex items-center justify-between border-b border-zinc-100">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
          <Settings2 class="w-4 h-4 text-white" />
        </div>
        <div>
          <div class="text-[13px] font-semibold text-zinc-900">AI 分析配置中心</div>
          <div class="text-[10px] text-zinc-400">规则 · 工作流 · 定时 · 成本</div>
        </div>
      </div>
      <button
        class="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1"
        :class="saving ? 'text-zinc-400 bg-zinc-100' : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'"
        :disabled="saving"
        @click="saveAllConfigs"
      >
        <Save v-if="!saving" class="w-3 h-3" />
        <Loader2 v-else class="w-3 h-3 animate-spin" />
        {{ saving ? '保存中…' : '保存配置' }}
      </button>
    </div>

    <!-- Tabs -->
    <div class="flex items-center gap-1 px-3 py-2 border-b border-zinc-100 bg-zinc-50/50">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1.5"
        :class="activeTab === tab.id
          ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200'
          : 'text-zinc-500 hover:text-zinc-700 hover:bg-white/60'"
        @click="activeTab = tab.id"
      >
        <component :is="tab.icon" class="w-3 h-3" />
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab Content -->
    <div class="p-4 max-h-[480px] overflow-y-auto">
      <!-- ═══════════════ Rules Tab ═══════════════ -->
      <div v-if="activeTab === 'rules'" class="space-y-3">
        <!-- Auto enable -->
        <div class="rounded-lg border border-zinc-200 overflow-hidden">
          <div
            class="px-3 py-2.5 flex items-center justify-between cursor-pointer hover:bg-zinc-50 transition-colors"
            @click="toggleSection('auto-enable')"
          >
            <div class="flex items-center gap-2">
              <component :is="expandedSections.has('auto-enable') ? ChevronDown : ChevronRight" class="w-3.5 h-3.5 text-zinc-400" />
              <Zap class="w-3.5 h-3.5 text-amber-500" />
              <span class="text-[12px] font-medium text-zinc-700">自动分析开关</span>
            </div>
            <Switch
              :model-value="autoCfg.enabled"
              @update:model-value="(v: boolean) => updateAutoCfg({ enabled: v })"
            />
          </div>
          <div v-if="expandedSections.has('auto-enable')" class="px-3 pb-3 space-y-2.5 border-t border-zinc-100 pt-2.5">
            <p class="text-[10px] text-zinc-400 leading-relaxed">
              开启后，每篇新捕获的网页将自动入队 AI 分析。可在下方指定默认模型和提示词模板。
            </p>

            <!-- Warnings -->
            <div
              v-for="w in autoCfgWarnings"
              :key="w"
              class="flex items-start gap-1.5 p-2 rounded-md bg-amber-50 border border-amber-200 text-[10px] text-amber-700"
            >
              <AlertCircle class="w-3 h-3 mt-px shrink-0" />
              <span>{{ w }}</span>
            </div>

            <!-- Default model -->
            <div>
              <label class="text-[10px] text-zinc-500 font-medium mb-1 block">默认模型</label>
              <Select
                :model-value="autoCfg.modelId ?? ''"
                :options="modelOptions"
                placeholder="选择默认模型（留空则使用全局默认）"
                @update:model-value="(v: string) => updateAutoCfg({ modelId: v || undefined })"
              />
            </div>
            <!-- Default template -->
            <div>
              <label class="text-[10px] text-zinc-500 font-medium mb-1 block">默认提示词模板</label>
              <Select
                :model-value="autoCfg.promptTemplateId ?? ''"
                :options="templateOptions"
                placeholder="选择模板（留空则仅使用系统提示词）"
                @update:model-value="(v: string) => updateAutoCfg({ promptTemplateId: v || undefined })"
              />
            </div>
            <!-- Queue pause -->
            <div class="flex items-center justify-between pt-1">
              <div class="flex items-center gap-1.5">
                <Pause class="w-3 h-3 text-amber-500" />
                <span class="text-[11px] text-zinc-600">队列暂停</span>
                <span class="text-[10px] text-zinc-400">（暂停后不处理新任务）</span>
              </div>
              <Switch
                :model-value="autoCfg.queuePaused ?? false"
                @update:model-value="() => toggleQueuePause()"
              />
            </div>
          </div>
        </div>

        <!-- Queue status bar -->
        <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-50 border border-zinc-200">
          <div class="flex items-center gap-1.5">
            <div class="w-1.5 h-1.5 rounded-full" :class="aiJobStore.queuePaused ? 'bg-amber-400' : aiJobStore.stats.pending > 0 ? 'bg-blue-400 animate-pulse' : 'bg-emerald-400'" />
            <span class="text-[10px] text-zinc-500 font-medium">队列</span>
          </div>
          <div class="flex items-center gap-1.5 text-[10px] tabular-nums">
            <span class="text-zinc-400">待处理</span>
            <span class="font-semibold text-zinc-700">{{ aiJobStore.stats.pending }}</span>
            <span class="text-zinc-300">·</span>
            <span class="text-zinc-400">处理中</span>
            <span class="font-semibold text-blue-500">{{ aiJobStore.stats.processing }}</span>
            <span class="text-zinc-300">·</span>
            <span class="text-zinc-400">成功</span>
            <span class="font-semibold text-emerald-500">{{ aiJobStore.stats.success }}</span>
            <span class="text-zinc-300">·</span>
            <span class="text-zinc-400">失败</span>
            <span class="font-semibold text-red-500">{{ aiJobStore.stats.failed }}</span>
          </div>
          <div class="flex-1" />
          <button
            v-if="aiJobStore.stats.pending > 0 && !aiJobStore.draining"
            class="px-2 py-0.5 rounded text-[9px] font-medium text-white bg-blue-500 hover:bg-blue-600 transition-colors flex items-center gap-0.5"
            @click="aiJobStore.drain()"
          >
            <Play class="w-2.5 h-2.5" /> 开始
          </button>
          <Loader2 v-if="aiJobStore.draining" class="w-3 h-3 animate-spin text-blue-500" />
          <button
            v-if="aiJobStore.stats.failed > 0"
            class="px-2 py-0.5 rounded text-[9px] font-medium text-red-500 bg-red-50 hover:bg-red-100 transition-colors flex items-center gap-0.5"
            @click="aiJobStore.retryAllFailed()"
          >
            <RefreshCw class="w-2.5 h-2.5" /> 重试
          </button>
        </div>

        <!-- Advanced rules -->
        <div class="rounded-lg border border-zinc-200 overflow-hidden">
          <div
            class="px-3 py-2.5 flex items-center justify-between cursor-pointer hover:bg-zinc-50 transition-colors"
            @click="toggleSection('adv-rules')"
          >
            <div class="flex items-center gap-2">
              <component :is="expandedSections.has('adv-rules') ? ChevronDown : ChevronRight" class="w-3.5 h-3.5 text-zinc-400" />
              <Brain class="w-3.5 h-3.5 text-indigo-500" />
              <span class="text-[12px] font-medium text-zinc-700">智能路由规则</span>
              <span class="text-[9px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-500 font-medium">BETA</span>
            </div>
            <button
              class="text-[10px] text-brand hover:text-brand-dark flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-brand/5"
              @click.stop="addRule"
            >
              <Plus class="w-3 h-3" /> 新增规则
            </button>
          </div>
          <div v-if="expandedSections.has('adv-rules')" class="px-3 pb-3 space-y-2 border-t border-zinc-100 pt-2.5">
            <p class="text-[10px] text-zinc-400 leading-relaxed mb-2">
              根据文档特征（域名、字数、语言等）自动选择不同的模型和模板。规则从上到下匹配，命中即停。
            </p>
            <div v-if="analysisRules.length === 0" class="text-center py-4 text-[11px] text-zinc-400">
              暂无规则，点击右上角「新增规则」创建
            </div>
            <div
              v-for="rule in analysisRules"
              :key="rule.id"
              class="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/50 space-y-2"
            >
              <!-- Rule header -->
              <div class="flex items-center gap-2">
                <Switch
                  :model-value="rule.enabled"
                  @update:model-value="(v: boolean) => { rule.enabled = v; persistRule(rule) }"
                />
                <UInput
                  v-model="rule.name"
                  class="flex-1 text-[11px]"
                  placeholder="规则名称"
                  @change="persistRule(rule)"
                />
                <button
                  class="p-1 rounded text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  @click="removeRule(rule.id)"
                >
                  <Trash2 class="w-3 h-3" />
                </button>
              </div>
              <!-- Conditions -->
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-[9px] text-zinc-400">当</span>
                <select
                  v-model="rule.conditions[0].field"
                  class="text-[10px] bg-white border border-zinc-200 rounded px-1.5 py-0.5 outline-none"
                  @change="persistRule(rule)"
                >
                  <option value="domain">域名</option>
                  <option value="siteName">站点名</option>
                  <option value="wordCount">字数</option>
                </select>
                <select
                  v-model="rule.conditions[0].operator"
                  class="text-[10px] bg-white border border-zinc-200 rounded px-1.5 py-0.5 outline-none"
                  @change="persistRule(rule)"
                >
                  <option value="contains">包含</option>
                  <option value="gt">大于</option>
                  <option value="lt">小于</option>
                  <option value="equals">等于</option>
                </select>
                <UInput
                  v-model="rule.conditions[0].value"
                  class="flex-1 text-[10px]"
                  placeholder="值"
                  @change="persistRule(rule)"
                />
              </div>
              <!-- Rule actions -->
              <div class="grid grid-cols-3 gap-1.5">
                <div>
                  <label class="text-[9px] text-zinc-400 block mb-0.5">模型</label>
                  <select
                    v-model="rule.modelId"
                    class="w-full text-[10px] bg-white border border-zinc-200 rounded px-1.5 py-1 outline-none"
                    @change="persistRule(rule)"
                  >
                    <option v-for="opt in modelOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  </select>
                </div>
                <div>
                  <label class="text-[9px] text-zinc-400 block mb-0.5">模板</label>
                  <select
                    v-model="rule.promptTemplateId"
                    class="w-full text-[10px] bg-white border border-zinc-200 rounded px-1.5 py-1 outline-none"
                    @change="persistRule(rule)"
                  >
                    <option v-for="opt in templateOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  </select>
                </div>
                <div>
                  <label class="text-[9px] text-zinc-400 block mb-0.5">优先级</label>
                  <select
                    v-model="rule.priority"
                    class="w-full text-[10px] bg-white border border-zinc-200 rounded px-1.5 py-1 outline-none"
                    @change="persistRule(rule)"
                  >
                    <option value="high">高</option>
                    <option value="normal">中</option>
                    <option value="low">低</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══════════════ Workflow Tab ═══════════════ -->
      <div v-if="activeTab === 'workflow'" class="space-y-3">
        <div class="flex items-center justify-between">
          <div class="text-[11px] text-zinc-500">
            编排多步骤分析流程：上一步完成后自动触发下一步
          </div>
          <button
            class="text-[10px] text-brand hover:text-brand-dark flex items-center gap-0.5 px-2 py-1 rounded hover:bg-brand/5"
            @click="addWorkflow"
          >
            <Plus class="w-3 h-3" /> 新建工作流
          </button>
        </div>

        <div
          v-for="wf in workflows"
          :key="wf.id"
          class="rounded-lg border border-zinc-200 overflow-hidden"
        >
          <!-- Workflow header -->
          <div class="px-3 py-2.5 flex items-center justify-between border-b border-zinc-100 bg-zinc-50/50">
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <Switch
                :model-value="wf.enabled"
                @update:model-value="(v: boolean) => { wf.enabled = v; persistWorkflow(wf) }"
              />
              <UInput
                v-model="wf.name"
                class="flex-1 text-[12px] font-medium"
                placeholder="工作流名称"
                @change="persistWorkflow(wf)"
              />
            </div>
            <button
              class="p-1 rounded text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors ml-1"
              @click="removeWorkflow(wf.id)"
            >
              <Trash2 class="w-3 h-3" />
            </button>
          </div>

          <!-- Workflow description -->
          <div class="px-3 py-2">
            <UInput
              v-model="wf.description"
              class="w-full text-[10px] text-zinc-500"
              placeholder="工作流描述"
              @change="persistWorkflow(wf)"
            />
          </div>

          <!-- Workflow steps -->
          <div class="px-3 pb-3 space-y-1.5">
            <div
              v-for="(step, idx) in wf.steps"
              :key="step.id"
              class="flex items-center gap-2"
            >
              <!-- Step number -->
              <div class="w-5 h-5 rounded-full bg-zinc-900 text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                {{ idx + 1 }}
              </div>
              <!-- Step label -->
              <UInput
                v-model="step.label"
                class="w-24 text-[10px]"
                placeholder="步骤名"
                @change="persistWorkflow(wf)"
              />
              <!-- Template -->
              <select
                v-model="step.templateId"
                class="flex-1 text-[10px] bg-white border border-zinc-200 rounded px-1.5 py-1 outline-none"
                @change="persistWorkflow(wf)"
              >
                <option value="">不使用模板</option>
                <option v-for="opt in templateOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
              <!-- Model -->
              <select
                v-model="step.modelId"
                class="w-28 text-[10px] bg-white border border-zinc-200 rounded px-1.5 py-1 outline-none"
                @change="persistWorkflow(wf)"
              >
                <option v-for="opt in modelOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
              <!-- Remove step -->
              <button
                class="p-0.5 rounded text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                @click="removeStep(wf.id, step.id)"
              >
                <XCircle class="w-3 h-3" />
              </button>
            </div>
            <!-- Add step -->
            <button
              class="w-full py-1 rounded-md text-[10px] text-zinc-400 hover:text-brand hover:bg-brand/5 border border-dashed border-zinc-200 transition-colors flex items-center justify-center gap-1"
              @click="addStep(wf.id)"
            >
              <Plus class="w-2.5 h-2.5" /> 添加步骤
            </button>
          </div>
        </div>

        <div v-if="workflows.length === 0" class="text-center py-6 text-[11px] text-zinc-400">
          暂无工作流，点击「新建工作流」开始编排
        </div>
      </div>

      <!-- ═══════════════ Schedule Tab ═══════════════ -->
      <div v-if="activeTab === 'schedule'" class="space-y-3">
        <div class="flex items-center justify-between">
          <div class="text-[11px] text-zinc-500">
            定时触发 AI 分析，支持按范围筛选文档
          </div>
          <button
            class="text-[10px] text-brand hover:text-brand-dark flex items-center gap-0.5 px-2 py-1 rounded hover:bg-brand/5"
            @click="addSchedule"
          >
            <Plus class="w-3 h-3" /> 新建计划
          </button>
        </div>

        <div
          v-for="sched in schedules"
          :key="sched.id"
          class="rounded-lg border border-zinc-200 overflow-hidden"
        >
          <!-- Schedule header -->
          <div class="px-3 py-2.5 flex items-center justify-between border-b border-zinc-100 bg-zinc-50/50">
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <Switch
                :model-value="sched.enabled"
                @update:model-value="(v: boolean) => { sched.enabled = v; persistSchedule(sched) }"
              />
              <Clock class="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <UInput
                v-model="sched.label"
                class="flex-1 text-[11px] font-medium"
                placeholder="计划名称"
                @change="persistSchedule(sched)"
              />
            </div>
            <button
              class="p-1 rounded text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors ml-1"
              @click="removeSchedule(sched.id)"
            >
              <Trash2 class="w-3 h-3" />
            </button>
          </div>

          <!-- Schedule config -->
          <div class="px-3 py-2.5 space-y-2">
            <!-- Cron preset + custom -->
            <div class="flex items-center gap-2">
              <label class="text-[10px] text-zinc-500 w-12 shrink-0">执行时间</label>
              <div class="flex flex-wrap gap-1 flex-1">
                <button
                  v-for="preset in cronPresets"
                  :key="preset.value"
                  class="px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors"
                  :class="sched.cron === preset.value
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'"
                  @click="sched.cron = preset.value; persistSchedule(sched)"
                >
                  {{ preset.label }}
                </button>
              </div>
              <UInput
                v-model="sched.cron"
                class="w-28 text-[10px] font-mono"
                placeholder="自定义 Cron"
                @change="persistSchedule(sched)"
              />
            </div>

            <!-- Scope -->
            <div class="flex items-center gap-2">
              <label class="text-[10px] text-zinc-500 w-12 shrink-0">分析范围</label>
              <div class="flex gap-1">
                <button
                  v-for="opt in [
                    { value: 'today', label: '当日收藏' },
                    { value: 'unread', label: '未读' },
                    { value: 'all', label: '全部' },
                  ]"
                  :key="opt.value"
                  class="px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors"
                  :class="sched.scope === opt.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'"
                  @click="sched.scope = opt.value as any; persistSchedule(sched)"
                >
                  {{ opt.label }}
                </button>
              </div>
            </div>

            <!-- Model + Template -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[9px] text-zinc-400 block mb-0.5">模型</label>
                <select
                  v-model="sched.modelId"
                  class="w-full text-[10px] bg-white border border-zinc-200 rounded px-1.5 py-1 outline-none"
                  @change="persistSchedule(sched)"
                >
                  <option value="">默认模型</option>
                  <option v-for="opt in modelOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </div>
              <div>
                <label class="text-[9px] text-zinc-400 block mb-0.5">模板</label>
                <select
                  v-model="sched.promptTemplateId"
                  class="w-full text-[10px] bg-white border border-zinc-200 rounded px-1.5 py-1 outline-none"
                  @change="persistSchedule(sched)"
                >
                  <option value="">不使用模板</option>
                  <option v-for="opt in templateOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div v-if="schedules.length === 0" class="text-center py-6 text-[11px] text-zinc-400">
          暂无定时计划
        </div>
      </div>

      <!-- ═══════════════ Cost Tab ═══════════════ -->
      <div v-if="activeTab === 'cost'" class="space-y-3">
        <!-- Summary cards -->
        <div class="grid grid-cols-4 gap-2">
          <div class="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/50">
            <div class="flex items-center gap-1 text-[9px] text-zinc-400">
              <TrendingUp class="w-2.5 h-2.5" /> 总响应
            </div>
            <div class="text-[16px] font-bold text-zinc-900 mt-0.5">{{ costStats.totalJobs }}</div>
          </div>
          <div class="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/50">
            <div class="flex items-center gap-1 text-[9px] text-zinc-400">
              <Timer class="w-2.5 h-2.5" /> 平均耗时
            </div>
            <div class="text-[16px] font-bold text-zinc-900 mt-0.5">
              {{ costStats.avgDurationMs > 0 ? `${(costStats.avgDurationMs / 1000).toFixed(1)}s` : '—' }}
            </div>
          </div>
          <div class="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/50">
            <div class="flex items-center gap-1 text-[9px] text-zinc-400">
              <CheckCircle2 class="w-2.5 h-2.5 text-emerald-500" /> 成功率
            </div>
            <div class="text-[16px] font-bold text-emerald-600 mt-0.5">
              {{ costStats.successRate > 0 ? `${(costStats.successRate * 100).toFixed(0)}%` : '—' }}
            </div>
          </div>
          <div class="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/50">
            <div class="flex items-center gap-1 text-[9px] text-zinc-400">
              <DollarSign class="w-2.5 h-2.5" /> 实际成本
            </div>
            <div class="text-[16px] font-bold text-amber-600 mt-0.5">{{ costStats.actualCostCNY > 0 ? formatCNY(costStats.actualCostCNY) : '—' }}</div>
          </div>
        </div>

        <!-- Token usage breakdown -->
        <div class="rounded-lg border border-zinc-200 p-3">
          <div class="text-[11px] font-medium text-zinc-600 mb-2">实际 Token 用量</div>
          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-[10px]">
              <span class="text-zinc-500">输入 Tokens（实际记录）</span>
              <span class="font-mono text-zinc-700">{{ formatTokens(costStats.inputTokens) }}</span>
            </div>
            <div class="flex items-center justify-between text-[10px]">
              <span class="text-zinc-500">输出 Tokens（实际记录）</span>
              <span class="font-mono text-zinc-700">{{ formatTokens(costStats.outputTokens) }}</span>
            </div>
            <div class="flex items-center justify-between text-[10px] pt-1.5 border-t border-zinc-100">
              <span class="text-zinc-500 font-medium">总计 Tokens</span>
              <span class="font-mono text-zinc-900 font-bold">
                {{ formatTokens(costStats.totalTokens) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Per-model breakdown -->
        <div class="rounded-lg border border-zinc-200 p-3">
          <div class="text-[11px] font-medium text-zinc-600 mb-2">模型响应分布</div>
          <div v-if="aiJobStore.jobs.length === 0" class="text-center py-3 text-[10px] text-zinc-400">
            暂无数据
          </div>
          <div v-else class="space-y-1.5">
            <div
              v-for="modelStat in modelStore.models.map(m => {
                const count = aiJobStore.jobs.filter(j => j.modelId === m.id).length
                return { model: m, count }
              }).filter(s => s.count > 0).sort((a, b) => b.count - a.count)"
              :key="modelStat.model.id"
              class="flex items-center gap-2"
            >
              <span class="text-[10px] text-zinc-600 w-24 truncate">{{ modelStat.model.name }}</span>
              <div class="flex-1 h-3 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-blue-400 to-indigo-400 transition-all duration-500"
                  :style="{ width: `${(modelStat.count / aiJobStore.stats.total) * 100}%` }"
                />
              </div>
              <span class="text-[10px] font-mono text-zinc-500 w-8 text-right tabular-nums">{{ modelStat.count }}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>
