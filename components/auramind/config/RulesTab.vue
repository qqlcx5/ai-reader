<script lang="ts" setup>
import { ref, computed } from 'vue'
import {
  Zap, Brain, Plus, Trash2, XCircle, ChevronDown, ChevronRight,
  AlertCircle, Pause, Play, Loader2, RefreshCw,
} from '@lucide/vue'
import Switch from '@/components/ui/Switch.vue'
import UInput from '@/components/ui/UInput.vue'
import Select from '@/components/ui/Select.vue'
import { useSettingsStore } from '@/stores/settings.store'
import { useAiJobStore } from '@/stores/ai-job.store'
import { useAnalysisRuleStore } from '@/stores/analysis-rule.store'
import { useModelStore } from '@/stores/model.store'
import { usePromptTemplateStore } from '@/stores/prompt-template.store'
import type { AutoAnalysisSettings } from '@/types/settings'
import type { AnalysisRuleEntity } from '@/types/analysis-rule'
import type { AiJobPriority } from '@/types/ai-job'
import type { SelectOption } from './select-option'

defineProps<{
  modelOptions: SelectOption[]
  templateOptions: SelectOption[]
}>()

const settingsStore = useSettingsStore()
const aiJobStore = useAiJobStore()
const analysisRuleStore = useAnalysisRuleStore()
const modelStore = useModelStore()
const promptStore = usePromptTemplateStore()

const autoCfg = computed(() => settingsStore.settings.autoAnalysis)
const analysisRules = computed(() => analysisRuleStore.rules)

// ── Collapsible sections ──
const expandedSections = ref<Set<string>>(new Set(['auto-enable']))
function toggleSection(id: string) {
  const next = new Set(expandedSections.value)
  next.has(id) ? next.delete(id) : next.add(id)
  expandedSections.value = next
}

function updateAutoCfg(patch: Partial<AutoAnalysisSettings>) {
  settingsStore.updateAutoAnalysis(patch)
}

async function toggleQueuePause() {
  await aiJobStore.toggleQueuePause()
}

const autoCfgWarnings = computed<string[]>(() => {
  const warns: string[] = []
  if (!autoCfg.value.enabled) return warns
  if (!autoCfg.value.modelId && !modelStore.defaultModel) {
    warns.push('未配置默认模型，自动分析将无法执行')
  }
  return warns
})

// ── Rule CRUD ──
function addRule() {
  const draft = analysisRuleStore.createDraft()
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

function addRuleCondition(rule: AnalysisRuleEntity) {
  rule.conditions.push({ field: 'wordCount', operator: 'gt', value: '500' })
  void persistRule(rule)
}

function removeRuleCondition(rule: AnalysisRuleEntity, index: number) {
  if (rule.conditions.length <= 1) return
  rule.conditions.splice(index, 1)
  void persistRule(rule)
}
</script>

<template>
  <div class="space-y-3">
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

        <div
          v-for="w in autoCfgWarnings"
          :key="w"
          class="flex items-start gap-1.5 p-2 rounded-md bg-amber-50 border border-amber-200 text-[10px] text-amber-700"
        >
          <AlertCircle class="w-3 h-3 mt-px shrink-0" />
          <span>{{ w }}</span>
        </div>

        <div>
          <label class="text-[10px] text-zinc-500 font-medium mb-1 block">默认模型</label>
          <Select
            :model-value="autoCfg.modelId ?? ''"
            :options="modelOptions"
            placeholder="选择默认模型（留空则使用全局默认）"
            @update:model-value="(v: string) => updateAutoCfg({ modelId: v || undefined })"
          />
        </div>
        <div>
          <label class="text-[10px] text-zinc-500 font-medium mb-1 block">默认提示词模板</label>
          <Select
            :model-value="autoCfg.promptTemplateId ?? ''"
            :options="templateOptions"
            placeholder="选择模板（留空则仅使用系统提示词）"
            @update:model-value="(v: string) => updateAutoCfg({ promptTemplateId: v || undefined })"
          />
        </div>
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
    <div class="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-zinc-50 border border-zinc-200">
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
        v-if="aiJobStore.stats.failed > 0 || aiJobStore.stats.cancelled > 0"
        class="px-2 py-0.5 rounded text-[9px] font-medium text-red-500 bg-red-50 hover:bg-red-100 transition-colors flex items-center gap-0.5"
        @click="aiJobStore.retryAllFailed()"
      >
        <RefreshCw class="w-2.5 h-2.5" /> 重试失败/取消
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
          根据文档特征（域名、站点名、字数）自动选择不同的模型和模板。规则按创建顺序匹配，命中即停。
        </p>
        <div v-if="analysisRules.length === 0" class="text-center py-4 text-[11px] text-zinc-400">
          暂无规则，点击右上角「新增规则」创建
        </div>
        <div
          v-for="rule in analysisRules"
          :key="rule.id"
          class="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/50 space-y-2"
        >
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
          <div class="space-y-1.5">
            <div
              v-for="(condition, conditionIndex) in rule.conditions"
              :key="conditionIndex"
              class="flex items-center gap-1.5 flex-wrap"
            >
              <span class="text-[9px] text-zinc-400">{{ conditionIndex === 0 ? '当' : '且' }}</span>
              <select
                v-model="condition.field"
                class="text-[10px] bg-white border border-zinc-200 rounded px-1.5 py-0.5 outline-none"
                @change="persistRule(rule)"
              >
                <option value="domain">域名</option>
                <option value="siteName">站点名</option>
                <option value="wordCount">字数</option>
              </select>
              <select
                v-model="condition.operator"
                class="text-[10px] bg-white border border-zinc-200 rounded px-1.5 py-0.5 outline-none"
                @change="persistRule(rule)"
              >
                <option value="contains">包含</option>
                <option value="gt">大于</option>
                <option value="lt">小于</option>
                <option value="equals">等于</option>
              </select>
              <UInput
                v-model="condition.value"
                class="flex-1 text-[10px]"
                placeholder="值"
                @change="persistRule(rule)"
              />
              <button
                v-if="rule.conditions.length > 1"
                class="p-0.5 text-zinc-300 hover:text-red-500"
                title="删除条件"
                @click="removeRuleCondition(rule, conditionIndex)"
              >
                <XCircle class="w-3 h-3" />
              </button>
            </div>
            <button
              class="text-[10px] text-brand hover:text-brand-dark flex items-center gap-0.5"
              @click="addRuleCondition(rule)"
            >
              <Plus class="w-3 h-3" /> 添加条件（全部满足）
            </button>
          </div>
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
</template>
