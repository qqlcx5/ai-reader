<script lang="ts" setup>
import { ref, computed, watch, onMounted } from 'vue'
import { Zap, X, Loader2 } from '@lucide/vue'
import {
  DialogRoot, DialogPortal, DialogOverlay, DialogContent,
  DialogTitle, DialogDescription, DialogClose,
} from 'reka-ui'
import Select from '@/components/ui/Select.vue'
import UButton from '@/components/ui/UButton.vue'
import { useModelStore } from '@/stores/model.store'
import { usePromptTemplateStore } from '@/stores/prompt-template.store'
import { useAiJobStore } from '@/stores/ai-job.store'
import { useAppStore } from '@/stores/app.store'

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
const appStore = useAppStore()

const selectedModelId = ref('')
const selectedTemplateId = ref('__none__')
const selectedPriority = ref<'high' | 'normal' | 'low'>('normal')
const submitting = ref(false)

const modelOptions = computed(() =>
  modelStore.models
    .filter((m) => m.enabled)
    .map((m) => ({ value: m.id, label: m.name })),
)

const templateOptions = computed(() => [
  { value: '__none__', label: '不使用模板（仅系统提示词）' },
  ...promptStore.templates.map((t) => ({ value: t.id, label: t.title })),
])

// Default to the first enabled model when options load
watch(modelOptions, (opts) => {
  if (!selectedModelId.value && opts.length) {
    selectedModelId.value = opts[0].value
  }
}, { immediate: true })

onMounted(() => {
  if (!modelStore.models.length) modelStore.loadModels()
  if (!promptStore.templates.length) promptStore.initTemplates()
})

const canSubmit = computed(() => !!selectedModelId.value && props.documentIds.length > 0 && !submitting.value)

async function handleSubmit() {
  if (!selectedModelId.value) return
  submitting.value = true
  try {
    const result = await aiJobStore.enqueueBatchJobs({
      documentIds: props.documentIds,
      modelId: selectedModelId.value,
      promptTemplateId: selectedTemplateId.value === '__none__' ? undefined : selectedTemplateId.value,
      priority: selectedPriority.value,
    })

    const parts: string[] = []
    if (result.enqueued) parts.push(`${result.enqueued} 篇已入队`)
    if (result.skipped) parts.push(`${result.skipped} 篇已跳过`)
    appStore.showToast(parts.join('，') || '未入队', result.skipped > 0 ? 'info' : 'success')

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
        class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] bg-white rounded-2xl shadow-xl z-50 outline-none"
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

          <!-- Model select -->
          <div class="mb-2.5">
            <label class="text-[11px] text-zinc-500 font-medium mb-1 block">模型</label>
            <Select
              v-model="selectedModelId"
              :options="modelOptions"
              placeholder="选择模型"
            />
          </div>

          <!-- Template select -->
          <div class="mb-2.5">
            <label class="text-[11px] text-zinc-500 font-medium mb-1 block">提示词模板</label>
            <Select
              v-model="selectedTemplateId"
              :options="templateOptions"
              placeholder="不选则使用系统提示词"
            />
          </div>

          <!-- Priority select -->
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
