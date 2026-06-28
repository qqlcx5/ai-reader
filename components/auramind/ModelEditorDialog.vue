<script lang="ts" setup>
import { ref, watch, computed } from 'vue'
import { X } from '@lucide/vue'
import RekaButton from '@/components/ui/RekaButton.vue'
import RekaInput from '@/components/ui/RekaInput.vue'
import RekaTextarea from '@/components/ui/RekaTextarea.vue'
import Select from '@/components/ui/Select.vue'
import Slider from '@/components/ui/Slider.vue'
import Switch from '@/components/ui/Switch.vue'
import type { ModelConfig } from '@/types/model'
import { useModelStore } from '@/stores/model.store'

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

// Form fields
const name = ref('')
const provider = ref<'openai-compatible' | 'anthropic' | 'ollama'>('openai-compatible')
const modelId = ref('')
const baseUrl = ref('')
const apiKey = ref('')
const contextWindow = ref(1050000)
const temperature = ref(0.9)
const systemPrompt = ref('')
const enabled = ref(true)
const isDefault = ref(false)

const errors = ref<Record<string, string>>({})
const submitting = ref(false)

const showBaseUrl = computed(() => provider.value === 'openai-compatible' || provider.value === 'ollama')

function resetForm() {
  name.value = ''
  provider.value = 'openai-compatible'
  modelId.value = ''
  baseUrl.value = ''
  apiKey.value = ''
  contextWindow.value = 1050000
  temperature.value = 0.9
  systemPrompt.value = ''
  enabled.value = true
  isDefault.value = false
  errors.value = {}
}

function populateFromModel(model: ModelConfig) {
  name.value = model.name
  provider.value = model.provider
  modelId.value = model.modelId
  baseUrl.value = model.baseUrl || ''
  apiKey.value = model.apiKey || ''
  contextWindow.value = model.contextWindow
  temperature.value = model.temperature
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
  if (temperature.value < 0 || temperature.value > 2) {
    e.temperature = '温度范围 0-2'
  }
  if (contextWindow.value <= 0) {
    e.contextWindow = '上下文窗口必须大于 0'
  }

  errors.value = e
  return Object.keys(e).length === 0
}

async function handleSubmit() {
  if (!validate()) return
  submitting.value = true

  try {
    const now = new Date().toISOString()

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
        temperature: temperature.value,
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
        temperature: temperature.value,
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
  <div
    v-if="open"
    class="absolute inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-end"
    @click.self="onClose"
  >
    <div class="w-full bg-white rounded-t-2xl border-t border-zinc-200 shadow-2xl p-4 animate-[slideUp_.2s_ease-out] max-h-[85vh] flex flex-col">
      <div class="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h3 class="text-[15px] font-semibold">{{ isEdit ? '编辑模型' : '添加模型节点' }}</h3>
          <p class="text-[11px] text-zinc-400 mt-0.5">支持 OpenAI Compatible / Anthropic / Ollama</p>
        </div>
        <RekaButton variant="ghost" @click="onClose">
          <X class="w-4 h-4" />
        </RekaButton>
      </div>

      <div class="space-y-3 text-[13px] overflow-y-auto flex-1">
        <!-- Name -->
        <div>
          <label class="text-[11px] text-zinc-500 font-medium">模型名称 <span class="text-red-400">*</span></label>
          <RekaInput v-model="name" class="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3" placeholder="例如 DeepSeek Chat" />
          <p v-if="errors.name" class="text-[10px] text-red-400 mt-0.5">{{ errors.name }}</p>
        </div>

        <!-- Provider -->
        <div>
          <label class="text-[11px] text-zinc-500 font-medium">服务商类型 <span class="text-red-400">*</span></label>
          <Select v-model="provider" :options="providerOptions" class="mt-1" />
        </div>

        <!-- Model ID -->
        <div>
          <label class="text-[11px] text-zinc-500 font-medium">模型 ID <span class="text-red-400">*</span></label>
          <RekaInput v-model="modelId" class="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3" placeholder="例如 gpt-4o" />
          <p v-if="errors.modelId" class="text-[10px] text-red-400 mt-0.5">{{ errors.modelId }}</p>
        </div>

        <!-- Base URL (conditional) -->
        <div v-if="showBaseUrl">
          <label class="text-[11px] text-zinc-500 font-medium">Base URL</label>
          <RekaInput v-model="baseUrl" class="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3 font-mono text-[12px]" placeholder="https://api.example.com/v1" />
          <p v-if="errors.baseUrl" class="text-[10px] text-red-400 mt-0.5">{{ errors.baseUrl }}</p>
        </div>

        <!-- API Key -->
        <div>
          <label class="text-[11px] text-zinc-500 font-medium">API Key</label>
          <RekaInput v-model="apiKey" type="password" class="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3 font-mono text-[12px]" placeholder="sk-..." />
        </div>

        <!-- Context Window + Temperature -->
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[11px] text-zinc-500 font-medium">上下文窗口</label>
            <RekaInput
              :model-value="String(contextWindow)"
              type="number"
              class="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3 font-mono text-[12px]"
              placeholder="1050000"
              @update:model-value="contextWindow = Number($event)"
            />
            <p v-if="errors.contextWindow" class="text-[10px] text-red-400 mt-0.5">{{ errors.contextWindow }}</p>
          </div>
          <div>
            <label class="text-[11px] text-zinc-500 font-medium">温度 {{ temperature.toFixed(1) }}</label>
            <Slider v-model="temperature" :min="0" :max="2" :step="0.1" class="mt-1" />
            <p v-if="errors.temperature" class="text-[10px] text-red-400 mt-0.5">{{ errors.temperature }}</p>
          </div>
        </div>

        <!-- System Prompt -->
        <div>
          <label class="text-[11px] text-zinc-500 font-medium">模型 System Prompt</label>
          <RekaTextarea
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

      <div class="flex gap-2 mt-5 shrink-0">
        <RekaButton variant="secondary" size="lg" class="flex-1" @click="onClose">
          取消
        </RekaButton>
        <RekaButton variant="primary" size="lg" class="flex-1" :disabled="submitting" @click="handleSubmit">
          {{ submitting ? '保存中...' : (isEdit ? '保存修改' : '添加模型') }}
        </RekaButton>
      </div>
    </div>
  </div>
</template>

<style>
@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
</style>
