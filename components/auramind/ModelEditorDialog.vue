<script lang="ts" setup>
import dayjs from 'dayjs'
import { ref, watch, computed } from 'vue'
import { X, ChevronDown, Search, RefreshCw, Check } from '@lucide/vue'
import UButton from '@/components/ui/UButton.vue'
import UDialog from '@/components/ui/UDialog.vue'
import UInput from '@/components/ui/UInput.vue'
import UTextarea from '@/components/ui/UTextarea.vue'
import Select from '@/components/ui/Select.vue'
import Slider from '@/components/ui/Slider.vue'
import Switch from '@/components/ui/Switch.vue'
import type { ModelConfig, ThinkingConfig } from '@/types/model'
import { useModelStore } from '@/stores/model.store'
import { toast } from '@/utils/toast'

const props = defineProps<{
  open: boolean
  modelId?: string
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const modelStore = useModelStore()

const isEdit = computed(() => !!props.modelId)

const providerOptions = [
  { value: 'openai-compatible', label: 'OpenAI Compatible' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'ollama', label: 'Ollama' },
]

const reasoningEffortOptions = [
  { value: '__default__', label: '默认（不传）' },
  { value: 'minimal', label: 'minimal' },
  { value: 'low', label: 'low' },
  { value: 'medium', label: 'medium' },
  { value: 'high', label: 'high' },
  { value: 'xhigh', label: 'xhigh' },
]

// Form fields
const name = ref('')
const provider = ref<'openai-compatible' | 'anthropic' | 'ollama'>('openai-compatible')
const modelId = ref('')
const baseUrl = ref('')
const apiKey = ref('')
const contextWindow = ref<number | undefined>(undefined)
const temperature = ref(0.7)
const temperatureEnabled = ref(false)
const maxTokens = ref<number | undefined>(undefined)
const systemPrompt = ref('')
const enabled = ref(true)
const isDefault = ref(false)
const thinkingEnabled = ref(false)
const thinkingBudgetTokens = ref<number | undefined>(undefined)
const reasoningEffort = ref('xhigh')
const inputPricePer1M = ref<number | undefined>(undefined)
const outputPricePer1M = ref<number | undefined>(undefined)
const maxRetries = ref(2)

const errors = ref<Record<string, string>>({})
const submitting = ref(false)

// ── Fetch models from API ────────────────────────────────
const fetchingModels = ref(false)
const fetchedModels = ref<{ id: string; ownedBy?: string }[]>([])
const showModelPicker = ref(false)
const modelSearch = ref('')

const filteredModels = computed(() => {
  const q = modelSearch.value.trim().toLowerCase()
  if (!q) return fetchedModels.value
  return fetchedModels.value.filter((m) => m.id.toLowerCase().includes(q))
})

async function fetchModels() {
  const base = baseUrl.value.trim().replace(/\/+$/, '')
  if (!base) {
    toast.error('请先填写 Base URL')
    return
  }
  if (!apiKey.value.trim()) {
    toast.error('请先填写 API Key')
    return
  }
  fetchingModels.value = true
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    const res = await fetch(`${base}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey.value.trim()}`,
      },
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      toast.error(`获取失败: HTTP ${res.status} ${text.slice(0, 100)}`)
      return
    }
    const data = await res.json()
    const list: { id: string; ownedBy?: string }[] = (data.data || data.models || []).map((m: any) => ({
      id: m.id || m.name,
      ownedBy: m.owned_by || m.ownedBy,
    })).filter((m: { id: string }) => m.id)
    if (!list.length) {
      toast.info('未获取到模型列表')
      return
    }
    fetchedModels.value = list
    showModelPicker.value = true
    modelSearch.value = ''
    toast.success(`获取到 ${list.length} 个模型`)
  } catch (e: any) {
    toast.error(`获取失败: ${e?.message ?? String(e)}`)
  } finally {
    fetchingModels.value = false
  }
}

function selectModel(id: string) {
  modelId.value = id
  showModelPicker.value = false
}

const showBaseUrl = computed(() => provider.value === 'openai-compatible' || provider.value === 'ollama')

function resetForm() {
  name.value = ''
  provider.value = 'openai-compatible'
  modelId.value = ''
  baseUrl.value = ''
  apiKey.value = ''
  contextWindow.value = undefined
  temperature.value = 0.7
  temperatureEnabled.value = false
  maxTokens.value = undefined
  systemPrompt.value = ''
  enabled.value = true
  isDefault.value = false
  thinkingEnabled.value = false
  thinkingBudgetTokens.value = undefined
  reasoningEffort.value = 'xhigh'
  inputPricePer1M.value = undefined
  outputPricePer1M.value = undefined
  maxRetries.value = 2
  errors.value = {}
  fetchedModels.value = []
  showModelPicker.value = false
  modelSearch.value = ''
}

function populateFromModel(model: ModelConfig) {
  name.value = model.name
  provider.value = model.provider
  modelId.value = model.modelId
  baseUrl.value = model.baseUrl || ''
  apiKey.value = model.apiKey || ''
  contextWindow.value = model.contextWindow
  temperatureEnabled.value = model.temperature != null
  temperature.value = model.temperature ?? 0.7
  maxTokens.value = model.maxTokens
  thinkingEnabled.value = !!model.thinking?.enabled
  thinkingBudgetTokens.value = model.thinking?.budgetTokens
  reasoningEffort.value = model.reasoningEffort || '__default__'
  inputPricePer1M.value = model.inputPricePer1M
  outputPricePer1M.value = model.outputPricePer1M
  maxRetries.value = model.maxRetries ?? 2
  systemPrompt.value = model.systemPrompt || ''
  enabled.value = model.enabled
  isDefault.value = model.isDefault
}

function generateUUID(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function isValidUrl(url: string): boolean {
  if (!url) return true // empty is allowed
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:' || url.startsWith('http://localhost')
  } catch {
    return false
  }
}

function validate(): boolean {
  const e: Record<string, string> = {}

  if (!name.value.trim()) {
    e.name = '模型名称不能为空'
  }
  if (!modelId.value.trim()) {
    e.modelId = '模型 ID 不能为空'
  }
  if (baseUrl.value && !isValidUrl(baseUrl.value)) {
    e.baseUrl = '请输入合法的 URL（允许 localhost）'
  }
  if (temperatureEnabled.value && (temperature.value < 0 || temperature.value > 2)) {
    e.temperature = '温度范围 0-2'
  }
  if (contextWindow.value != null && contextWindow.value <= 0) {
    e.contextWindow = '上下文窗口必须大于 0'
  }
  if (maxTokens.value != null && maxTokens.value <= 0) {
    e.maxTokens = '最大 Token 必须大于 0'
  }
  if (thinkingEnabled.value && thinkingBudgetTokens.value != null && thinkingBudgetTokens.value <= 0) {
    e.thinkingBudget = '思考预算必须大于 0'
  }
  if (isNaN(maxRetries.value) || maxRetries.value < 0 || maxRetries.value > 10) {
    e.maxRetries = '重试次数范围 0-10'
  }

  errors.value = e
  return Object.keys(e).length === 0
}

function buildThinkingConfig(): ThinkingConfig | undefined {
  if (!thinkingEnabled.value) return undefined
  return {
    enabled: true,
    ...(thinkingBudgetTokens.value ? { budgetTokens: thinkingBudgetTokens.value } : {}),
  }
}

async function handleSubmit() {
  if (!validate()) return
  submitting.value = true

  try {
    const now = dayjs().toISOString()

    if (isEdit.value && props.modelId) {
      const existing = modelStore.models.find(m => m.id === props.modelId)
      if (!existing) return

      const updated: ModelConfig = {
        ...existing,
        name: name.value.trim(),
        provider: provider.value,
        modelId: modelId.value.trim(),
        baseUrl: baseUrl.value.trim() || undefined,
        apiKey: apiKey.value || undefined,
        contextWindow: contextWindow.value,
        temperature: temperatureEnabled.value ? temperature.value : undefined,
        maxTokens: maxTokens.value,
        thinking: buildThinkingConfig(),
        reasoningEffort: reasoningEffort.value !== '__default__' ? reasoningEffort.value : undefined,
        inputPricePer1M: inputPricePer1M.value,
        outputPricePer1M: outputPricePer1M.value,
        maxRetries: maxRetries.value,
        systemPrompt: systemPrompt.value || undefined,
        enabled: enabled.value,
        isDefault: isDefault.value,
        updatedAt: now,
      }
      await modelStore.editModel(updated)
    } else {
      const newModel: ModelConfig = {
        id: generateUUID(),
        name: name.value.trim(),
        provider: provider.value,
        modelId: modelId.value.trim(),
        baseUrl: baseUrl.value.trim() || undefined,
        apiKey: apiKey.value || undefined,
        contextWindow: contextWindow.value,
        temperature: temperatureEnabled.value ? temperature.value : undefined,
        maxTokens: maxTokens.value,
        thinking: buildThinkingConfig(),
        reasoningEffort: reasoningEffort.value !== '__default__' ? reasoningEffort.value : undefined,
        inputPricePer1M: inputPricePer1M.value,
        outputPricePer1M: outputPricePer1M.value,
        maxRetries: maxRetries.value,
        systemPrompt: systemPrompt.value || undefined,
        enabled: enabled.value,
        isDefault: isDefault.value || modelStore.models.length === 0,
        createdAt: now,
        updatedAt: now,
      }
      await modelStore.addModel(newModel)
    }

    emit('saved')
    emit('close')
  } finally {
    submitting.value = false
  }
}

function onClose() {
  resetForm()
  emit('close')
}

// Watch open to populate form
watch(() => props.open, (val) => {
  if (!val) return
  resetForm()

  if (props.modelId) {
    const existing = modelStore.models.find(m => m.id === props.modelId)
    if (existing) {
      populateFromModel(existing)
    }
  }
})
</script>

<template>
  <UDialog :open="open" @close="onClose">
    <template #header>
      <div class="flex items-center justify-between shrink-0 pb-0 p-4">
        <div>
          <div class="text-[15px] font-semibold">{{ isEdit ? '编辑模型' : '添加模型节点' }}</div>
          <div class="text-[11px] text-zinc-400 mt-0.5">支持 OpenAI Compatible / Anthropic / Ollama</div>
        </div>
        <UButton variant="ghost" @click="onClose">
          <X class="w-4 h-4" />
        </UButton>
      </div>
    </template>

    <div class="min-h-0 flex-1 overflow-y-auto px-4 text-[13px]">
      <div class="space-y-5">
        <section>
          <h4 class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">基础配置</h4>
          <div class="space-y-3">
        <!-- Name -->
        <div>
          <label class="text-[11px] text-zinc-500 font-medium">模型名称 <span class="text-red-400">*</span></label>
          <UInput v-model="name" class="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3" placeholder="例如 DeepSeek Chat" />
          <div v-if="errors.name" class="text-[10px] text-red-400 mt-0.5">{{ errors.name }}</div>
        </div>

        <!-- Provider -->
        <div>
          <label class="text-[11px] text-zinc-500 font-medium">服务商类型 <span class="text-red-400">*</span></label>
          <Select v-model="provider" :options="providerOptions" class="mt-1" />
        </div>

        <!-- Model ID -->
        <div>
          <div class="flex items-center justify-between">
            <label class="text-[11px] text-zinc-500 font-medium">模型 ID <span class="text-red-400">*</span></label>
            <button
              v-if="showBaseUrl"
              class="flex items-center gap-1 text-[10px] text-brand hover:text-brand/80 transition-colors disabled:opacity-40"
              :disabled="fetchingModels"
              @click="fetchModels"
            >
              <RefreshCw class="w-2.5 h-2.5" :class="{ 'animate-spin': fetchingModels }" />
              {{ fetchingModels ? '获取中...' : '从 API 获取' }}
            </button>
          </div>

          <!-- Model picker dropdown -->
          <div v-if="showModelPicker" class="mt-1 border border-zinc-200 rounded-lg bg-white shadow-sm max-h-48 overflow-hidden flex flex-col">
            <div class="p-1.5 border-b border-zinc-100 flex items-center gap-1.5">
              <Search class="w-3 h-3 text-zinc-400 shrink-0" />
              <input
                v-model="modelSearch"
                class="flex-1 text-[11px] outline-none bg-transparent"
                placeholder="搜索模型..."
                autofocus
              >
              <button class="text-[10px] text-zinc-400 hover:text-zinc-600" @click="showModelPicker = false">✕</button>
            </div>
            <div class="overflow-y-auto flex-1">
              <button
                v-for="m in filteredModels"
                :key="m.id"
                class="w-full px-2.5 py-1.5 text-left text-[11px] hover:bg-brand/5 flex items-center justify-between gap-2"
                :class="{ 'bg-brand/10 text-brand': modelId === m.id }"
                @click="selectModel(m.id)"
              >
                <span class="font-mono truncate">{{ m.id }}</span>
                <span v-if="modelId === m.id" class="shrink-0"><Check class="w-3 h-3" /></span>
                <span v-else-if="m.ownedBy" class="text-[9px] text-zinc-400 shrink-0">{{ m.ownedBy }}</span>
              </button>
              <p v-if="!filteredModels.length" class="px-2.5 py-2 text-[10px] text-zinc-400 text-center">无匹配模型</p>
            </div>
          </div>

          <UInput v-model="modelId" class="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3" placeholder="例如 gpt-4o" />
          <p v-if="errors.modelId" class="text-[10px] text-red-400 mt-0.5">{{ errors.modelId }}</p>
        </div>

        <!-- Base URL (conditional) -->
        <div v-if="showBaseUrl">
          <label class="text-[11px] text-zinc-500 font-medium">Base URL</label>
          <UInput v-model="baseUrl" class="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3 font-mono text-[12px]" placeholder="https://api.example.com/v1" />
          <p v-if="errors.baseUrl" class="text-[10px] text-red-400 mt-0.5">{{ errors.baseUrl }}</p>
        </div>

        </div>
        </section>
        <section>
          <h4 class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Token 与生成</h4>
          <div class="space-y-3">
        <!-- API Key -->
        <div>
          <label class="text-[11px] text-zinc-500 font-medium">API Key</label>
          <UInput v-model="apiKey" type="password" class="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3 font-mono text-[12px]" placeholder="sk-..." />
        </div>

        <!-- Context Window + Max Output Tokens -->
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[11px] text-zinc-500 font-medium">上下文窗口</label>
            <UInput
              :model-value="contextWindow != null ? String(contextWindow) : ''"
              type="number"
              class="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3 font-mono text-[12px]"
              placeholder="统一由全局上下文设置控制"
              @update:model-value="contextWindow = $event === '' ? undefined : Number($event)"
            />
            <p v-if="errors.contextWindow" class="text-[10px] text-red-400 mt-0.5">{{ errors.contextWindow }}</p>
            <p class="text-[10px] text-zinc-400 mt-0.5">不参与请求限制；上下文长度统一由全局设置控制</p>
          </div>
          <div>
            <label class="text-[11px] text-zinc-500 font-medium">最大输出 Token</label>
            <UInput
              :model-value="maxTokens != null ? String(maxTokens) : ''"
              type="number"
              class="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3 font-mono text-[12px]"
              placeholder="可选，如 4096"
              @update:model-value="maxTokens = $event === '' ? undefined : Number($event)"
            />
            <p v-if="errors.maxTokens" class="text-[10px] text-red-400 mt-0.5">{{ errors.maxTokens }}</p>
            <p class="text-[10px] text-zinc-400 mt-0.5">发送请求时限制模型的最大输出长度</p>
          </div>
        </div>

        </div>
        </section>
        <section>
          <h4 class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">计费</h4>
        <!-- Pricing (per 1M tokens, CNY) -->
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[11px] text-zinc-500 font-medium">输入价 ¥/1M</label>
            <UInput
              :model-value="inputPricePer1M != null ? String(inputPricePer1M) : ''"
              type="number"
              class="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3 font-mono text-[12px]"
              placeholder="留空用内置价"
              @update:model-value="inputPricePer1M = $event === '' ? undefined : Number($event)"
            />
          </div>
          <div>
            <label class="text-[11px] text-zinc-500 font-medium">输出价 ¥/1M</label>
            <UInput
              :model-value="outputPricePer1M != null ? String(outputPricePer1M) : ''"
              type="number"
              class="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3 font-mono text-[12px]"
              placeholder="留空用内置价"
              @update:model-value="outputPricePer1M = $event === '' ? undefined : Number($event)"
            />
          </div>
        </div>

        </section>
        <section>
          <h4 class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">高级设置</h4>
          <div class="space-y-3">
        <!-- Max Retries -->
        <div>
          <label class="text-[11px] text-zinc-500 font-medium">失败重试次数</label>
          <UInput
            :model-value="String(maxRetries)"
            type="number"
            class="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3 font-mono text-[12px]"
            placeholder="0-10，默认 2"
            @update:model-value="maxRetries = $event === '' ? 0 : Number($event)"
          />
          <p class="text-[10px] text-zinc-400 mt-0.5">模型调用失败时自动重试，0 = 不重试</p>
          <p v-if="errors.maxRetries" class="text-[10px] text-red-400 mt-0.5">{{ errors.maxRetries }}</p>
        </div>

        <!-- Temperature -->
        <div>
          <div class="flex items-center justify-between">
            <label class="text-[11px] text-zinc-500 font-medium">温度 {{ temperatureEnabled ? temperature.toFixed(1) : '默认' }}</label>
            <Switch v-model="temperatureEnabled" />
          </div>
          <Slider v-if="temperatureEnabled" v-model="temperature" :min="0" :max="2" :step="0.1" class="mt-1" />
          <p v-if="errors.temperature" class="text-[10px] text-red-400 mt-0.5">{{ errors.temperature }}</p>
        </div>

        <!-- Thinking (Anthropic) -->
        <div v-if="provider === 'anthropic'">
          <div class="flex items-center justify-between">
            <label class="text-[11px] text-zinc-500 font-medium">扩展思考 (Thinking)</label>
            <Switch v-model="thinkingEnabled" />
          </div>
          <div v-if="thinkingEnabled" class="mt-1">
            <UInput
              :model-value="thinkingBudgetTokens != null ? String(thinkingBudgetTokens) : ''"
              type="number"
              class="w-full h-9 rounded-lg border border-zinc-200 px-3 font-mono text-[12px]"
              placeholder="思考预算 Token，如 31744"
              @update:model-value="thinkingBudgetTokens = $event === '' ? undefined : Number($event)"
            />
            <p v-if="errors.thinkingBudget" class="text-[10px] text-red-400 mt-0.5">{{ errors.thinkingBudget }}</p>
          </div>
        </div>

        <!-- Reasoning Effort (OpenAI-style) -->
        <div v-if="provider === 'openai-compatible'">
          <label class="text-[11px] text-zinc-500 font-medium">推理强度 (reasoning_effort)</label>
          <Select v-model="reasoningEffort" :options="reasoningEffortOptions" class="mt-1" />
        </div>

        <!-- System Prompt -->
        <div>
          <label class="text-[11px] text-zinc-500 font-medium">模型 System Prompt</label>
          <UTextarea
            v-model="systemPrompt"
            :rows="3"
            class="mt-1 w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-[11px] text-zinc-600 focus:border-brand font-mono"
            placeholder="（可选，优先级高于全局 System Prompt）"
          />
        </div>

        <!-- Switches -->
        <div class="flex items-center justify-between">
          <span class="text-[11px] text-zinc-500 font-medium">启用</span>
          <Switch v-model="enabled" />
        </div>

        <div class="flex items-center justify-between">
          <span class="text-[11px] text-zinc-500 font-medium">设为默认</span>
          <Switch v-model="isDefault" />
        </div>
          </div>
        </section>
      </div>
    </div>

    <template #footer>
      <div class="flex gap-2 mt-5 px-4 pb-4 shrink-0">
        <UButton variant="secondary" size="lg" class="flex-1" @click="onClose">取消</UButton>
        <UButton variant="primary" size="lg" class="flex-1" :disabled="submitting" @click="handleSubmit">
          {{ submitting ? '保存中...' : (isEdit ? '保存修改' : '添加模型') }}
        </UButton>
      </div>
    </template>
  </UDialog>
</template>
