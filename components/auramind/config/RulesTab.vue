<script lang="ts" setup>
import { computed } from 'vue'
import { Plus, Trash2, XCircle, ArrowRight } from '@lucide/vue'
import Switch from '@/components/ui/Switch.vue'
import UInput from '@/components/ui/UInput.vue'
import { useAnalysisRuleStore } from '@/stores/analysis-rule.store'
import { useModelStore } from '@/stores/model.store'
import type { AnalysisRuleEntity } from '@/types/analysis-rule'
import type { SelectOption } from './select-option'

const props = defineProps<{
  modelOptions: SelectOption[]
  templateOptions: SelectOption[]
}>()

const analysisRuleStore = useAnalysisRuleStore()
const modelStore = useModelStore()
const analysisRules = computed(() => analysisRuleStore.rules)

// ponytail: modelStore imported only to fall back to the global default when a
// new rule is created, matching pre-refactor behaviour.
function addRule() {
  const draft = analysisRuleStore.createDraft()
  draft.modelId = modelStore.defaultModel?.id || ''
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

const fieldOptions: SelectOption[] = [
  { value: 'domain', label: '域名' },
  { value: 'siteName', label: '站点名' },
  { value: 'wordCount', label: '字数' },
]
const operatorOptions: SelectOption[] = [
  { value: 'contains', label: '包含' },
  { value: 'gt', label: '大于' },
  { value: 'lt', label: '小于' },
  { value: 'equals', label: '等于' },
]
const priorityOptions: SelectOption[] = [
  { value: 'high', label: '高' },
  { value: 'normal', label: '中' },
  { value: 'low', label: '低' },
]

// include the "默认模型" empty option for the model override on rules.
// (template already comes with an empty "system prompt only" option from parent.)
const ruleModelOptions = computed<SelectOption[]>(() => [
  { value: '', label: '默认模型' },
  ...props.modelOptions,
])

function optionLabel(options: SelectOption[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? ''
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-2">
      <div class="text-[11px] text-zinc-500 leading-relaxed">
        根据文档特征自动路由到不同模型 / 模板。规则按创建顺序匹配，命中即停。
      </div>
      <button
        class="shrink-0 text-[10px] text-brand hover:text-brand-dark flex items-center gap-0.5 px-2 py-1 rounded hover:bg-brand/5"
        @click="addRule"
      >
        <Plus class="w-3 h-3" /> 新增规则
      </button>
    </div>

    <div v-if="analysisRules.length === 0" class="text-center py-8 text-[11px] text-zinc-400 border border-dashed border-zinc-200 rounded-lg">
      暂无规则，点击「新增规则」创建
    </div>

    <div
      v-for="rule in analysisRules"
      :key="rule.id"
      class="rounded-lg border border-zinc-200 bg-white overflow-hidden"
      :class="!rule.enabled && 'opacity-60'"
    >
      <!-- 规则头部：开关 + 名称 + 删除 -->
      <div class="flex items-center gap-2 px-3 py-2 bg-zinc-50/80 border-b border-zinc-100">
        <Switch
          :model-value="rule.enabled"
          @update:model-value="(v: boolean) => { rule.enabled = v; persistRule(rule) }"
        />
        <UInput
          v-model="rule.name"
          class="flex-1 text-[12px] font-medium"
          placeholder="规则名称"
          @change="persistRule(rule)"
        />
        <button
          class="p-1 rounded text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
          title="删除规则"
          @click="removeRule(rule.id)"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- 条件区 -->
      <div class="px-3 py-2.5 space-y-1.5">
        <div class="text-[9px] text-zinc-400 font-medium uppercase tracking-wide">匹配条件（全部满足）</div>
        <div
          v-for="(condition, conditionIndex) in rule.conditions"
          :key="conditionIndex"
          class="flex items-center gap-1.5 flex-wrap"
        >
          <span class="text-[9px] text-zinc-400 w-4 shrink-0">{{ conditionIndex === 0 ? '当' : '且' }}</span>
          <select
            v-model="condition.field"
            class="text-[10px] bg-white border border-zinc-200 rounded px-1.5 py-1 outline-none focus:border-brand"
            @change="persistRule(rule)"
          >
            <option v-for="opt in fieldOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <select
            v-model="condition.operator"
            class="text-[10px] bg-white border border-zinc-200 rounded px-1.5 py-1 outline-none focus:border-brand"
            @change="persistRule(rule)"
          >
            <option v-for="opt in operatorOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <UInput
            v-model="condition.value"
            class="flex-1 min-w-[80px] text-[10px]"
            placeholder="值"
            @change="persistRule(rule)"
          />
          <button
            v-if="rule.conditions.length > 1"
            class="p-1 text-zinc-300 hover:text-red-500 shrink-0"
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
          <Plus class="w-3 h-3" /> 添加条件
        </button>
      </div>

      <!-- 输出区：条件命中 → 使用这些配置 -->
      <div class="px-3 py-2.5 border-t border-zinc-100 bg-zinc-50/40 space-y-1.5">
        <div class="flex items-center gap-1 text-[9px] text-zinc-400 font-medium uppercase tracking-wide">
          <ArrowRight class="w-2.5 h-2.5" /> 命中后使用
        </div>
        <div class="grid grid-cols-3 gap-1.5">
          <div>
            <label class="text-[9px] text-zinc-400 block mb-0.5">模型</label>
            <select
              v-model="rule.modelId"
              class="w-full text-[10px] bg-white border border-zinc-200 rounded px-1.5 py-1 outline-none focus:border-brand truncate"
              :title="optionLabel(ruleModelOptions, rule.modelId)"
              @change="persistRule(rule)"
            >
              <option v-for="opt in ruleModelOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
          <div>
            <label class="text-[9px] text-zinc-400 block mb-0.5">模板</label>
            <select
              v-model="rule.promptTemplateId"
              class="w-full text-[10px] bg-white border border-zinc-200 rounded px-1.5 py-1 outline-none focus:border-brand truncate"
              :title="optionLabel(props.templateOptions, rule.promptTemplateId)"
              @change="persistRule(rule)"
            >
              <option v-for="opt in props.templateOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
          <div>
            <label class="text-[9px] text-zinc-400 block mb-0.5">优先级</label>
            <select
              v-model="rule.priority"
              class="w-full text-[10px] bg-white border border-zinc-200 rounded px-1.5 py-1 outline-none focus:border-brand"
              @change="persistRule(rule)"
            >
              <option v-for="opt in priorityOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
