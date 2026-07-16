<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue'
import {
  Zap, Clock, Tag, Brain, Settings2, Plus, Trash2, Edit3,
  ChevronDown, ChevronRight, Play, Pause, CheckCircle2, XCircle,
  Loader2, AlertCircle, DollarSign, Timer, TrendingUp, Save,
} from '@lucide/vue'
import { useAiJobStore } from '@/stores/ai-job.store'
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
import type { PromptTemplate } from '@/types/prompt-template'

// ── Stores ──
const aiJobStore = useAiJobStore()
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

// ── Auto Analysis Rules ──
const autoRules = ref<AutoAnalysisSettings>({
  enabled: false,
  modelId: '',
  promptTemplateId: '',
  queuePaused: false,
})

// ── Rule conditions (advanced) ──
interface RuleCondition {
  id: string
  field: 'domain' | 'wordCount' | 'hasCode' | 'language'
  operator: 'contains' | 'gt' | 'lt' | 'equals'
  value: string
}

interface AnalysisRule {
  id: string
  name: string
  enabled: boolean
  conditions: RuleCondition[]
  modelId: string
  promptTemplateId: string
  priority: 'high' | 'normal' | 'low'
}

const analysisRules = ref<AnalysisRule[]>([])

function addRule() {
  analysisRules.value.push({
    id: `rule_${crypto.randomUUID()}`,
    name: `规则 ${analysisRules.value.length + 1}`,
    enabled: true,
    conditions: [{ id: `c_${crypto.randomUUID()}`, field: 'wordCount', operator: 'gt', value: '500' }],
    modelId: autoRules.value.modelId || modelStore.defaultModel?.id || '',
    promptTemplateId: autoRules.value.promptTemplateId || '',
    priority: 'normal',
  })
}

function removeRule(id: string) {
  analysisRules.value = analysisRules.value.filter((r) => r.id !== id)
}

// ── Workflow orchestration ──
interface WorkflowStep {
  id: string
  templateId: string
  modelId: string
  label: string
  /** Whether to wait for the previous step to finish before starting this one */
  waitForPrevious: boolean
}

interface Workflow {
  id: string
  name: string
  enabled: boolean
  steps: WorkflowStep[]
  description: string
}

const workflows = ref<Workflow[]>([
  {
    id: 'wf_default',
    name: '默认三步分析',
    enabled: false,
    description: '先摘要 → 再提取行动项 → 最后生成标签',
    steps: [
      { id: 's1', templateId: '', modelId: '', label: 'TL;DR 摘要', waitForPrevious: true },
      { id: 's2', templateId: '', modelId: '', label: '行动清单', waitForPrevious: true },
      { id: 's3', templateId: '', modelId: '', label: '智能标签', waitForPrevious: true },
    ],
  },
])

function addWorkflow() {
  workflows.value.push({
    id: `wf_${crypto.randomUUID()}`,
    name: `工作流 ${workflows.value.length + 1}`,
    enabled: false,
    description: '',
    steps: [{ id: `s_${crypto.randomUUID()}`, templateId: '', modelId: '', label: '步骤 1', waitForPrevious: true }],
  })
}

function removeWorkflow(id: string) {
  workflows.value = workflows.value.filter((w) => w.id !== id)
}

function addStep(wfId: string) {
  const wf = workflows.value.find((w) => w.id === wfId)
  if (!wf) return
  wf.steps.push({
    id: `s_${crypto.randomUUID()}`,
    templateId: '',
    modelId: '',
    label: `步骤 ${wf.steps.length + 1}`,
    waitForPrevious: true,
  })
}

function removeStep(wfId: string, stepId: string) {
  const wf = workflows.value.find((w) => w.id === wfId)
  if (!wf) return
  wf.steps = wf.steps.filter((s) => s.id !== stepId)
}

// ── Schedule ──
interface ScheduleConfig {
  id: string
  enabled: boolean
  cron: string
  label: string
  /** Which documents to process: today's captures, unread, all, specific collection */
  scope: 'today' | 'unread' | 'all' | 'collection'
  collectionId?: string
  modelId: string
  promptTemplateId: string
  priority: 'high' | 'normal' | 'low'
}

const schedules = ref<ScheduleConfig[]>([
  {
    id: 'sched_nightly',
    enabled: false,
    cron: '0 23 * * *',
    label: '每晚 23:00 自动分析当日收藏',
    scope: 'today',
    modelId: '',
    promptTemplateId: '',
    priority: 'low',
  },
])

function addSchedule() {
  schedules.value.push({
    id: `sched_${crypto.randomUUID()}`,
    enabled: false,
    cron: '0 9 * * 1-5',
    label: '新定时计划',
    scope: 'all',
    modelId: '',
    promptTemplateId: '',
    priority: 'normal',
  })
}

function removeSchedule(id: string) {
  schedules.value = schedules.value.filter((s) => s.id !== id)
}

const cronPresets = [
  { label: '每天 23:00', value: '0 23 * * *' },
  { label: '每天 09:00', value: '0 9 * * *' },
  { label: '工作日 09:00', value: '0 9 * * 1-5' },
  { label: '每周日 20:00', value: '0 20 * * 0' },
  { label: '每 6 小时', value: '0 */6 * * *' },
]

// ── Cost stats ──
const costStats = computed(() => {
  const jobs = aiJobStore.jobs.filter((j) => j.status === 'success')
  const totalJobs = jobs.length
  // Would need actual token usage data from conversations
  // For now, estimate from job count
  return {
    totalJobs,
    estimatedInputTokens: totalJobs * 3500, // avg 3500 tokens per doc
    estimatedOutputTokens: totalJobs * 800,  // avg 800 tokens per response
    estimatedCostCNY: totalJobs * 0.015,     // avg ¥0.015 per analysis
    avgDurationMs: aiJobStore.stats.avgDurationMs,
    successRate: aiJobStore.stats.successRate,
  }
})

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

// ── Save handler ──
const saving = ref(false)

async function saveAutoRules() {
  saving.value = true
  try {
    await settingsStore.updateAutoAnalysis({ ...autoRules.value })
    appStore.showToast('自动分析规则已保存', 'success')
  } catch (e) {
    appStore.showToast('保存失败', 'error')
  } finally {
    saving.value = false
  }
}

async function toggleQueuePause() {
  await aiJobStore.toggleQueuePause()
  autoRules.value.queuePaused = aiJobStore.queuePaused
}

// ── Lifecycle ──
onMounted(async () => {
  await Promise.all([
    modelStore.loadModels(),
    promptStore.initTemplates(),
    settingsStore.loadSettings(),
    aiJobStore.loadJobs(),
  ])
  // Sync autoRules from settings
  const s = settingsStore.settings
  if (s?.autoAnalysis) {
    autoRules.value = { ...s.autoAnalysis }
  }
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
        @click="saveAutoRules"
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
              :model-value="autoRules.enabled"
              @update:model-value="(v: boolean) => { autoRules.enabled = v; saveAutoRules() }"
            />
          </div>
          <div v-if="expandedSections.has('auto-enable')" class="px-3 pb-3 space-y-2.5 border-t border-zinc-100 pt-2.5">
            <p class="text-[10px] text-zinc-400 leading-relaxed">
              开启后，每篇新捕获的网页将自动入队 AI 分析。可在下方指定默认模型和提示词模板。
            </p>
            <!-- Default model -->
            <div>
              <label class="text-[10px] text-zinc-500 font-medium mb-1 block">默认模型</label>
              <Select
                :model-value="autoRules.modelId ?? ''"
                :options="modelOptions"
                placeholder="选择默认模型（留空则使用全局默认）"
                @update:model-value="(v: string) => autoRules.modelId = v"
              />
            </div>
            <!-- Default template -->
            <div>
              <label class="text-[10px] text-zinc-500 font-medium mb-1 block">默认提示词模板</label>
              <Select
                :model-value="autoRules.promptTemplateId ?? ''"
                :options="templateOptions"
                placeholder="选择模板（留空则仅使用系统提示词）"
                @update:model-value="(v: string) => autoRules.promptTemplateId = v"
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
                :model-value="autoRules.queuePaused ?? false"
                @update:model-value="() => toggleQueuePause()"
              />
            </div>
          </div>
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
                  @update:model-value="(v: boolean) => { rule.enabled = v }"
                />
                <UInput
                  v-model="rule.name"
                  class="flex-1 text-[11px]"
                  placeholder="规则名称"
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
                >
                  <option value="domain">域名</option>
                  <option value="wordCount">字数</option>
                  <option value="hasCode">包含代码</option>
                  <option value="language">语言</option>
                </select>
                <select
                  v-model="rule.conditions[0].operator"
                  class="text-[10px] bg-white border border-zinc-200 rounded px-1.5 py-0.5 outline-none"
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
                />
              </div>
              <!-- Rule actions -->
              <div class="grid grid-cols-3 gap-1.5">
                <div>
                  <label class="text-[9px] text-zinc-400 block mb-0.5">模型</label>
                  <select
                    v-model="rule.modelId"
                    class="w-full text-[10px] bg-white border border-zinc-200 rounded px-1.5 py-1 outline-none"
                  >
                    <option v-for="opt in modelOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  </select>
                </div>
                <div>
                  <label class="text-[9px] text-zinc-400 block mb-0.5">模板</label>
                  <select
                    v-model="rule.promptTemplateId"
                    class="w-full text-[10px] bg-white border border-zinc-200 rounded px-1.5 py-1 outline-none"
                  >
                    <option v-for="opt in templateOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  </select>
                </div>
                <div>
                  <label class="text-[9px] text-zinc-400 block mb-0.5">优先级</label>
                  <select
                    v-model="rule.priority"
                    class="w-full text-[10px] bg-white border border-zinc-200 rounded px-1.5 py-1 outline-none"
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
                @update:model-value="(v: boolean) => { wf.enabled = v }"
              />
              <UInput
                v-model="wf.name"
                class="flex-1 text-[12px] font-medium"
                placeholder="工作流名称"
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
              />
              <!-- Template -->
              <select
                v-model="step.templateId"
                class="flex-1 text-[10px] bg-white border border-zinc-200 rounded px-1.5 py-1 outline-none"
              >
                <option value="">不使用模板</option>
                <option v-for="opt in templateOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
              <!-- Model -->
              <select
                v-model="step.modelId"
                class="w-28 text-[10px] bg-white border border-zinc-200 rounded px-1.5 py-1 outline-none"
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
                @update:model-value="(v: boolean) => { sched.enabled = v }"
              />
              <Clock class="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <UInput
                v-model="sched.label"
                class="flex-1 text-[11px] font-medium"
                placeholder="计划名称"
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
                  @click="sched.cron = preset.value"
                >
                  {{ preset.label }}
                </button>
              </div>
              <UInput
                v-model="sched.cron"
                class="w-28 text-[10px] font-mono"
                placeholder="自定义 Cron"
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
                  @click="sched.scope = opt.value as any"
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
              <TrendingUp class="w-2.5 h-2.5" /> 总分析
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
              <DollarSign class="w-2.5 h-2.5" /> 估算成本
            </div>
            <div class="text-[16px] font-bold text-amber-600 mt-0.5">¥{{ costStats.estimatedCostCNY.toFixed(2) }}</div>
          </div>
        </div>

        <!-- Token usage breakdown -->
        <div class="rounded-lg border border-zinc-200 p-3">
          <div class="text-[11px] font-medium text-zinc-600 mb-2">Token 用量估算</div>
          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-[10px]">
              <span class="text-zinc-500">输入 Tokens（正文+上下文）</span>
              <span class="font-mono text-zinc-700">{{ costStats.estimatedInputTokens.toLocaleString() }}</span>
            </div>
            <div class="flex items-center justify-between text-[10px]">
              <span class="text-zinc-500">输出 Tokens（AI 生成）</span>
              <span class="font-mono text-zinc-700">{{ costStats.estimatedOutputTokens.toLocaleString() }}</span>
            </div>
            <div class="flex items-center justify-between text-[10px] pt-1.5 border-t border-zinc-100">
              <span class="text-zinc-500 font-medium">总计 Tokens</span>
              <span class="font-mono text-zinc-900 font-bold">
                {{ (costStats.estimatedInputTokens + costStats.estimatedOutputTokens).toLocaleString() }}
              </span>
            </div>
          </div>
        </div>

        <!-- Per-model breakdown -->
        <div class="rounded-lg border border-zinc-200 p-3">
          <div class="text-[11px] font-medium text-zinc-600 mb-2">模型使用分布</div>
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

        <!-- Cost trend placeholder -->
        <div class="rounded-lg border border-zinc-200 p-3">
          <div class="text-[11px] font-medium text-zinc-600 mb-2">成本趋势</div>
          <div class="flex items-end gap-1 h-16">
            <div
              v-for="(val, i) in Array.from({ length: 14 }, (_, i) => {
                const d = new Date()
                d.setDate(d.getDate() - (13 - i))
                const dayJobs = aiJobStore.jobs.filter(j => {
                  const jd = new Date(j.createdAt)
                  return jd.toDateString() === d.toDateString() && j.status === 'success'
                }).length
                return Math.min(100, dayJobs * 15)
              })"
              :key="i"
              class="flex-1 rounded-t transition-all duration-300 hover:opacity-80"
              :class="val > 0 ? 'bg-gradient-to-t from-blue-400 to-indigo-300' : 'bg-zinc-100'"
              :style="{ height: `${Math.max(4, val)}%` }"
              :title="`${14 - i} 天前`"
            />
          </div>
          <div class="flex justify-between text-[8px] text-zinc-400 mt-1">
            <span>14 天前</span>
            <span>今天</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
