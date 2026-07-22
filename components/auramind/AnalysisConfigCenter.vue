<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { Settings2, Zap, Brain, Clock, DollarSign } from '@lucide/vue'
import { useAiJobStore } from '@/stores/ai-job.store'
import { useModelStore } from '@/stores/model.store'
import { usePromptTemplateStore } from '@/stores/prompt-template.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useWorkflowStore } from '@/stores/workflow.store'
import { useScheduleStore } from '@/stores/schedule.store'
import { useAnalysisRuleStore } from '@/stores/analysis-rule.store'
import { useCollectionStore } from '@/stores/collection.store'
import RulesTab from './config/RulesTab.vue'
import WorkflowTab from './config/WorkflowTab.vue'
import ScheduleTab from './config/ScheduleTab.vue'
import CostTab from './config/CostTab.vue'
import QueueStatusBar from './config/QueueStatusBar.vue'
import type { SelectOption } from './config/select-option'

type TabId = 'rules' | 'workflow' | 'schedule' | 'cost'
const activeTab = ref<TabId>('rules')

const tabs: { id: TabId; label: string; icon: typeof Zap }[] = [
  { id: 'rules', label: '自动规则', icon: Zap },
  { id: 'workflow', label: '工作流编排', icon: Brain },
  { id: 'schedule', label: '定时计划', icon: Clock },
  { id: 'cost', label: '成本统计', icon: DollarSign },
]

const aiJobStore = useAiJobStore()
const modelStore = useModelStore()
const promptStore = usePromptTemplateStore()
const settingsStore = useSettingsStore()
const workflowStore = useWorkflowStore()
const scheduleStore = useScheduleStore()
const analysisRuleStore = useAnalysisRuleStore()
const collectionStore = useCollectionStore()

const modelOptions = computed<SelectOption[]>(() =>
  modelStore.models
    .filter((m) => m.enabled)
    .map((m) => ({ value: m.id, label: m.name })),
)

const templateOptions = computed<SelectOption[]>(() => [
  { value: '', label: '不使用模板（仅系统提示词）' },
  ...promptStore.templates.map((t) => ({ value: t.id, label: t.title })),
])

onMounted(async () => {
  await Promise.all([
    modelStore.models.length ? Promise.resolve() : modelStore.loadModels(),
    promptStore.templates.length ? Promise.resolve() : promptStore.initTemplates(),
    settingsStore.settings ? Promise.resolve() : settingsStore.loadSettings(),
    aiJobStore.loadJobs(),
    workflowStore.load(),
    scheduleStore.load(),
    analysisRuleStore.load(),
    collectionStore.loadCollections(),
  ])
})
</script>

<template>
  <div class="w-full min-w-0 flex flex-col bg-white rounded-xl border border-zinc-200 overflow-hidden">
    <!-- Header -->
    <div class="px-4 py-3 shrink-0 flex items-center gap-2 border-b border-zinc-100">
      <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shrink-0">
        <Settings2 class="w-4 h-4 text-white" />
      </div>
      <div class="min-w-0">
        <div class="text-[13px] font-semibold text-zinc-900">AI 分析配置中心</div>
        <div class="text-[10px] text-zinc-400">规则 · 工作流 · 定时 · 成本</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex items-center gap-1 px-3 py-2 shrink-0 overflow-x-auto border-b border-zinc-100 bg-zinc-50/50">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="shrink-0 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap"
        :class="activeTab === tab.id
          ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200'
          : 'text-zinc-500 hover:text-zinc-700 hover:bg-white/60'"
        @click="activeTab = tab.id"
      >
        <component :is="tab.icon" class="w-3 h-3" />
        {{ tab.label }}
      </button>
    </div>

    <!-- Queue status: global runtime state, visible across all tabs -->
    <div class="px-3 pt-3 shrink-0">
      <QueueStatusBar />
    </div>

    <!-- Tab content (no inner scroll — let the parent page scroll) -->
    <div class="min-h-50 p-4 overflow-visible">
      <RulesTab
        v-if="activeTab === 'rules'"
        :model-options="modelOptions"
        :template-options="templateOptions"
      />
      <WorkflowTab
        v-else-if="activeTab === 'workflow'"
        :model-options="modelOptions"
        :template-options="templateOptions"
      />
      <ScheduleTab
        v-else-if="activeTab === 'schedule'"
        :model-options="modelOptions"
        :template-options="templateOptions"
      />
      <CostTab v-else-if="activeTab === 'cost'" />
    </div>
  </div>
</template>
