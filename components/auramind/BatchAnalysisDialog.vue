<script lang="ts" setup>
import { ref, computed, watch, onMounted } from 'vue'
import { Zap, X, Loader2, Eye, FileText, Workflow as WorkflowIcon } from '@lucide/vue'
import {
  DialogRoot, DialogPortal, DialogOverlay, DialogContent,
  DialogTitle, DialogDescription, DialogClose,
} from 'reka-ui'
import Select from '@/components/ui/Select.vue'
import UButton from '@/components/ui/UButton.vue'
import { useModelStore } from '@/stores/model.store'
import { usePromptTemplateStore } from '@/stores/prompt-template.store'
import { useAiJobStore } from '@/stores/ai-job.store'
import { useWorkflowStore } from '@/stores/workflow.store'
import { useAppStore } from '@/stores/app.store'
import { useSettingsStore } from '@/stores/settings.store'
import { DocumentRepository } from '@/db/repositories/document.repository'
import { enqueueWorkflow } from '@/services/ai-job/queue'
import { buildAnalysisPrompt } from '@/services/prompt/analysis'
import { estimateTokens } from '@/utils/token'
import type { ModelConfig } from '@/types/model'
import type { DocumentEntity } from '@/types/document'

const props = defineProps<{
  open: boolean
  documentCount: number
  documentIds: string[]
}>()

const emit = defineEmits<{
  close: []
}>()

const modelStore = useModelStore()
const promptStore = usePromptTemplateStore()
const aiJobStore = useAiJobStore()
const workflowStore = useWorkflowStore()
const appStore = useAppStore()
const settingsStore = useSettingsStore()

type Mode = 'single' | 'workflow'
const mode = ref<Mode>('single')

const selectedModelId = ref('')
const selectedTemplateId = ref('__none__')
const selectedWorkflowId = ref('')
const selectedPriority = ref<'high' | 'normal' | 'low'>('normal')
const submitting = ref(false)

// ── Prompt preview ──
const showPreview = ref(false)
const firstDoc = ref<DocumentEntity | undefined>()
const previewLoading = ref(false)

const modelOptions = computed(() =>
  modelStore.models
    .filter((m) => m.enabled)
    .map((m) => ({ value: m.id, label: m.name })),
)

const templateOptions = computed(() => [
  { value: '__none__', label: '不使用模板（仅系统提示词）' },
  ...promptStore.templates.map((t) => ({ value: t.id, label: t.title })),
])

const workflowOptions = computed(() =>
  workflowStore.workflows
    .filter((w) => w.enabled && w.steps.length > 0 && w.steps.every((step) => step.modelId))
    .map((w) => ({
      value: w.id,
      label: `${w.name}（${w.steps.length} 步）`,
    }))
)

// The model that would actually be used for the first analysis step.
// In single mode it's the selected model; in workflow mode it's the
// workflow's first step's model (resolved to ModelConfig for preview).
const effectiveModel = computed<ModelConfig | undefined>(() => {
  if (mode.value === 'single') {
    return modelStore.models.find((m) => m.id === selectedModelId.value)
  }
  const wf = workflowStore.workflows.find((w) => w.id === selectedWorkflowId.value)
  if (!wf?.steps.length) return undefined
  return modelStore.models.find((m) => m.id === wf.steps[0].modelId)
})

const effectiveTemplateContent = computed<string | undefined>(() => {
  if (mode.value === 'single') {
    if (selectedTemplateId.value === '__none__') return undefined
    return promptStore.templates.find((t) => t.id === selectedTemplateId.value)?.content
  }
  const wf = workflowStore.workflows.find((w) => w.id === selectedWorkflowId.value)
  if (!wf?.steps.length) return undefined
  return promptStore.templates.find((t) => t.id === wf.steps[0].templateId)?.content
})

const preview = computed(() => {
  if (!effectiveModel.value || !firstDoc.value) return null
  try {
    return buildAnalysisPrompt({
      model: effectiveModel.value,
      fallbackSystemPrompt: settingsStore.settings?.globalSystemPrompt,
      promptTemplateContent: effectiveTemplateContent.value,
      contextSettings: settingsStore.settings?.context,
      page: firstDoc.value.markdown ? {
        title: firstDoc.value.title,
        url: firstDoc.value.url,
        markdown: firstDoc.value.markdown,
        wordCount: firstDoc.value.wordCount,
        tokenCount: firstDoc.value.tokenCount,
        siteName: firstDoc.value.siteName,
        capturedAt: firstDoc.value.capturedAt,
      } : undefined,
    })
  } catch {
    return null
  }
})

const previewTokenEstimate = computed(() => {
  if (!preview.value) return 0
  const allText = [preview.value.system ?? '', ...preview.value.messages.map((m) => m.content)].join('\n')
  return estimateTokens(allText)
})

// Default selections when options load
watch(modelOptions, (opts) => {
  if (!selectedModelId.value && opts.length) selectedModelId.value = opts[0].value
}, { immediate: true })

watch(workflowOptions, (opts) => {
  if (!selectedWorkflowId.value && opts.length) selectedWorkflowId.value = opts[0].value
}, { immediate: true })

// Load first doc for preview when dialog opens
watch(() => props.open, async (open) => {
  if (open && props.documentIds.length) {
    previewLoading.value = true
    try {
      firstDoc.value = await DocumentRepository.findById(props.documentIds[0])
    } finally {
      previewLoading.value = false
    }
  } else {
    firstDoc.value = undefined
  }
}, { immediate: true })

onMounted(async () => {
  await Promise.all([
    modelStore.models.length ? Promise.resolve() : modelStore.loadModels(),
    promptStore.templates.length ? Promise.resolve() : promptStore.initTemplates(),
    workflowStore.workflows.length ? Promise.resolve() : workflowStore.load(),
    settingsStore.settings ? Promise.resolve() : settingsStore.loadSettings(),
  ])
})

const canSubmit = computed(() => {
  if (submitting.value || !props.documentIds.length) return false
  if (mode.value === 'single') return !!selectedModelId.value
  return !!selectedWorkflowId.value
})

async function handleSubmit() {
  submitting.value = true
  try {
    if (mode.value === 'workflow' && selectedWorkflowId.value) {
      const res = await enqueueWorkflow({
        documentIds: props.documentIds,
        workflowId: selectedWorkflowId.value,
        priority: selectedPriority.value,
      })
      // Kick off draining so the user sees progress
      if (!aiJobStore.queuePaused) void aiJobStore.drain()
      const parts: string[] = []
      if (res.enqueuedDocs) parts.push(`${res.enqueuedDocs} 篇已入队工作流`)
      if (res.skippedDocs) parts.push(`${res.skippedDocs} 篇跳过`)
      appStore.showToast(parts.join('，') || '未入队', res.skippedDocs > 0 ? 'info' : 'success')
    } else {
      if (!selectedModelId.value) return
      const result = await aiJobStore.enqueueBatchJobs({
        documentIds: props.documentIds,
        modelId: selectedModelId.value,
        promptTemplateId: selectedTemplateId.value === '__none__' ? undefined : selectedTemplateId.value,
        priority: selectedPriority.value,
      })
      const parts: string[] = []
      if (result.enqueued) parts.push(`${result.enqueued} 篇已入队`)
      if (result.skipped) parts.push(`${result.skipped} 篇跳过`)
      appStore.showToast(parts.join('，') || '未入队', result.skipped > 0 ? 'info' : 'success')
    }
    emit('close')
  } catch (e) {
    appStore.showToast(`入队失败: ${e instanceof Error ? e.message : String(e)}`, 'error')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <DialogRoot :open="open" @update:open="(v: boolean) => { if (!v) emit('close') }">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 bg-black/30 z-50" />
      <DialogContent
        class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl z-50 outline-none"
      >
        <div class="p-4">
          <!-- Header -->
          <div class="flex items-center justify-between mb-3">
            <DialogTitle class="text-[14px] font-semibold text-zinc-800 flex items-center gap-1.5">
              <Zap class="w-4 h-4 text-brand" />
              批量 AI 分析
            </DialogTitle>
            <DialogClose as-child>
              <button class="p-1 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition">
                <X class="w-3.5 h-3.5" />
              </button>
            </DialogClose>
          </div>

          <DialogDescription class="text-[12px] text-zinc-500 mb-3">
            将对 <span class="font-semibold text-brand">{{ documentCount }}</span> 篇文档批量执行 AI 分析，结果存为每篇文档的会话记录。
          </DialogDescription>

          <!-- Mode switcher -->
          <div class="flex items-center gap-1 mb-3 p-0.5 bg-zinc-100 rounded-lg">
            <button
              class="flex-1 py-1.5 rounded-md text-[11px] font-medium transition-colors flex items-center justify-center gap-1"
              :class="mode === 'single' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'"
              @click="mode = 'single'"
            >
              <Zap class="w-3 h-3" /> 单次分析
            </button>
            <button
              class="flex-1 py-1.5 rounded-md text-[11px] font-medium transition-colors flex items-center justify-center gap-1"
              :class="mode === 'workflow' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'"
              :disabled="workflowOptions.length === 0"
              :title="workflowOptions.length === 0 ? '请先在「AI 分析配置 → 工作流编排」启用并配置完整工作流' : ''"
              @click="mode = 'workflow'"
            >
              <WorkflowIcon class="w-3 h-3" /> 工作流
            </button>
          </div>

          <!-- ── Single mode ── -->
          <template v-if="mode === 'single'">
            <div class="mb-2.5">
              <label class="text-[11px] text-zinc-500 font-medium mb-1 block">模型</label>
              <Select
                v-model="selectedModelId"
                :options="modelOptions"
                placeholder="选择模型"
              />
            </div>
            <div class="mb-2.5">
              <label class="text-[11px] text-zinc-500 font-medium mb-1 block">提示词模板</label>
              <Select
                v-model="selectedTemplateId"
                :options="templateOptions"
                placeholder="不选则使用系统提示词"
              />
            </div>
          </template>

          <!-- ── Workflow mode ── -->
          <template v-else>
            <div class="mb-2.5">
              <label class="text-[11px] text-zinc-500 font-medium mb-1 block">工作流</label>
              <Select
                v-model="selectedWorkflowId"
                :options="workflowOptions"
                placeholder="选择工作流"
              />
              <p v-if="workflowOptions.length === 0" class="text-[10px] text-amber-600 mt-1">
                暂无已启用且配置完整的工作流。请到「AI 分析配置 → 工作流编排」启用并配置每一步模型。
              </p>
            </div>
          </template>

          <!-- Priority (both modes) -->
          <div class="mb-3">
            <label class="text-[11px] text-zinc-500 font-medium mb-1 block">优先级</label>
            <div class="flex items-center gap-1.5">
              <button
                v-for="opt in [
                  { value: 'high', label: '高' },
                  { value: 'normal', label: '中' },
                  { value: 'low', label: '低' },
                ]"
                :key="opt.value"
                class="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex-1"
                :class="selectedPriority === opt.value
                  ? 'bg-zinc-900 text-white'
                  : 'bg-white text-zinc-500 border border-zinc-200 hover:bg-zinc-50'"
                @click="selectedPriority = opt.value as any"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

          <!-- Prompt preview -->
          <div class="mb-3 rounded-lg border border-zinc-200 overflow-hidden">
            <button
              class="w-full px-2.5 py-1.5 flex items-center justify-between text-[11px] font-medium text-zinc-600 bg-zinc-50 hover:bg-zinc-100 transition-colors"
              :disabled="previewLoading || !preview"
              @click="showPreview = !showPreview"
            >
              <span class="flex items-center gap-1.5">
                <Eye class="w-3 h-3" />
                预览 Prompt
                <span v-if="preview" class="text-[9px] text-zinc-400 tabular-nums">~{{ previewTokenEstimate }} tokens</span>
                <span v-else-if="previewLoading" class="text-[9px] text-zinc-400">加载中…</span>
                <span v-else class="text-[9px] text-zinc-400">选好模型/模板后可预览</span>
              </span>
              <span class="text-[9px] text-zinc-400">{{ showPreview ? '收起' : '展开' }}</span>
            </button>
            <div v-if="showPreview && preview" class="p-2.5 space-y-1.5 max-h-[180px] overflow-y-auto">
              <div v-if="preview.system" class="text-[10px]">
                <div class="text-zinc-400 mb-0.5">system</div>
                <pre class="whitespace-pre-wrap text-zinc-600 bg-zinc-50 rounded p-1.5">{{ preview.system }}</pre>
              </div>
              <div
                v-for="(msg, i) in preview.messages"
                :key="i"
                class="text-[10px]"
              >
                <div class="text-zinc-400 mb-0.5">{{ msg.role }}</div>
                <pre class="whitespace-pre-wrap text-zinc-600 bg-zinc-50 rounded p-1.5 max-h-[80px] overflow-y-auto">{{ msg.content.slice(0, 600) }}{{ msg.content.length > 600 ? '…' : '' }}</pre>
              </div>
              <div v-if="!preview.messages.length && !preview.system" class="text-[10px] text-zinc-400 italic">
                空 prompt（未选模板且无系统提示词）
              </div>
            </div>
          </div>

          <!-- Sample document badge -->
          <div v-if="firstDoc" class="flex items-center gap-1.5 text-[10px] text-zinc-400 mb-3">
            <FileText class="w-3 h-3 shrink-0" />
            <span class="truncate">样本: {{ firstDoc.title || firstDoc.url }}</span>
          </div>

          <p class="text-[10px] text-zinc-400 leading-relaxed mb-3">
            入队后自动开始处理。可在「AI 分析」面板查看进度与结果。
          </p>

          <!-- Actions -->
          <div class="flex items-center justify-end gap-2">
            <UButton variant="ghost" size="sm" @click="emit('close')">
              取消
            </UButton>
            <UButton
              variant="primary"
              size="sm"
              :disabled="!canSubmit"
              @click="handleSubmit"
            >
              <Loader2 v-if="submitting" class="w-3.5 h-3.5 animate-spin mr-1" />
              开始分析
            </UButton>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
