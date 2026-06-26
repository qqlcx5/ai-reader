<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-slate-500 dark:text-slate-400">
        已配置 {{ modelStore.models.length }} 个模型
        <span v-if="modelStore.enabledModels.length > 0" class="ml-1">
          · 启用 {{ modelStore.enabledModels.length }}
        </span>
      </p>
      <button
        @click="openAdd"
        class="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors text-sm"
      >
        添加模型
      </button>
    </div>

    <div v-if="modelStore.models.length === 0" class="p-6 text-center text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
      尚未配置任何模型。点击右上角"添加模型"开始。
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="model in modelStore.models"
        :key="model.id"
        class="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h3 class="font-medium text-slate-800 dark:text-slate-100 truncate">{{ model.name }}</h3>
              <span v-if="model.isDefault" class="px-2 py-0.5 text-xs rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">默认</span>
              <span v-if="!model.enabled" class="px-2 py-0.5 text-xs rounded-full bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400">已禁用</span>
            </div>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1 truncate">
              {{ model.provider }} / {{ model.model }}
            </p>
            <p class="text-xs text-slate-400 dark:text-slate-500 mt-1 truncate">{{ model.baseUrl }}</p>

            <!-- Connection test row -->
            <div class="flex items-center gap-2 mt-3">
              <ConnectionLight :status="modelStore.connectionStatus[model.id] ?? 'idle'" />
              <span class="text-xs text-slate-500 dark:text-slate-400">
                <template v-if="(modelStore.connectionStatus[model.id] ?? 'idle') === 'testing'">测试中…</template>
                <template v-else-if="modelStore.connectionStatus[model.id] === 'ok'">
                  连接成功
                  <span v-if="modelStore.connectionLatency[model.id] !== undefined" class="ml-1 font-mono">
                    ({{ modelStore.connectionLatency[model.id] }} ms)
                  </span>
                </template>
                <template v-else-if="modelStore.connectionStatus[model.id] === 'failed'">
                  <span class="text-red-600 dark:text-red-400">
                    {{ modelStore.connectionError[model.id] || '连接失败' }}
                  </span>
                </template>
                <template v-else>未测试</template>
              </span>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <label class="inline-flex items-center cursor-pointer" :title="model.enabled ? '点击禁用' : '点击启用'">
              <input
                type="checkbox"
                :checked="model.enabled"
                @change="onToggleEnabled(model, ($event.target as HTMLInputElement).checked)"
                class="sr-only peer"
              />
              <span
                class="w-9 h-5 rounded-full bg-slate-300 peer-checked:bg-brand-500 dark:bg-slate-700 dark:peer-checked:bg-brand-500 relative transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4"
              />
            </label>
            <button
              @click="testConnection(model)"
              :disabled="modelStore.connectionStatus[model.id] === 'testing'"
              class="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              测试连接
            </button>
            <button
              @click="openEdit(model)"
              class="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              编辑
            </button>
            <button
              @click="onDelete(model.id)"
              class="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 transition-colors"
            >
              删除
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <div
      v-if="showAdd || editingId"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="closeModal"
    >
      <div class="w-full max-w-lg bg-white dark:bg-slate-800 rounded-xl p-6 max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
          {{ editingId ? '编辑模型' : '添加模型' }}
        </h3>

        <div class="space-y-4">
          <div>
            <label class="block text-sm text-slate-600 dark:text-slate-400 mb-1">名称</label>
            <input v-model="form.name" type="text" class="input" placeholder="例如：我的 OpenAI" />
          </div>

          <div>
            <label class="block text-sm text-slate-600 dark:text-slate-400 mb-1">提供商</label>
            <select v-model="form.providerId" @change="onProviderChange" class="input">
              <option v-for="provider in BUILTIN_PROVIDERS" :key="provider.id" :value="provider.id">
                {{ provider.name }}
              </option>
            </select>
          </div>

          <div>
            <label class="block text-sm text-slate-600 dark:text-slate-400 mb-1">模型 ID</label>
            <input v-model="form.model" type="text" class="input" placeholder="例如：gpt-4o-mini" list="model-suggestions" />
            <datalist v-if="suggestedModels.length" id="model-suggestions">
              <option v-for="m in suggestedModels" :key="m" :value="m" />
            </datalist>
          </div>

          <div>
            <label class="block text-sm text-slate-600 dark:text-slate-400 mb-1">Base URL</label>
            <input v-model="form.baseUrl" type="text" class="input" placeholder="https://api.openai.com/v1" />
          </div>

          <div>
            <label class="block text-sm text-slate-600 dark:text-slate-400 mb-1">API Key</label>
            <div class="flex gap-2">
              <input
                v-model="form.apiKey"
                :type="showKey ? 'text' : 'password'"
                class="input"
                placeholder="sk-..."
                autocomplete="off"
              />
              <button
                type="button"
                @click="showKey = !showKey"
                class="px-2 rounded-lg border border-slate-300 dark:border-slate-600 text-xs"
                :aria-label="showKey ? '隐藏 API Key' : '显示 API Key'"
              >
                {{ showKey ? '隐藏' : '显示' }}
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm text-slate-600 dark:text-slate-400 mb-1">Temperature</label>
              <input v-model.number="form.temperature" type="number" min="0" max="2" step="0.1" class="input" />
            </div>
            <div>
              <label class="block text-sm text-slate-600 dark:text-slate-400 mb-1">Max Tokens</label>
              <input v-model.number="form.maxTokens" type="number" min="1" class="input" placeholder="2048" />
            </div>
          </div>

          <label class="flex items-center gap-2">
            <input v-model="form.enabled" type="checkbox" class="rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
            <span class="text-sm text-slate-600 dark:text-slate-400">启用此模型</span>
          </label>

          <label class="flex items-center gap-2">
            <input v-model="form.isDefault" type="checkbox" class="rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
            <span class="text-sm text-slate-600 dark:text-slate-400">设为默认模型</span>
          </label>
        </div>

        <div v-if="formError" class="mt-4 text-sm text-red-600 dark:text-red-400">{{ formError }}</div>

        <div class="flex justify-end gap-3 mt-6">
          <button @click="closeModal" class="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            取消
          </button>
          <button
            @click="onSave"
            :disabled="!canSave"
            class="px-4 py-2 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors disabled:opacity-50"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, h } from 'vue'
import { useModelStore } from '@/core/models/store'
import { BUILTIN_PROVIDERS } from '@shared/constants'
import { generateId } from '@/shared/utils'
import type { ModelProviderConfig } from '@db/schema'
import type { ConnectionStatus } from '@/core/models/store'

const modelStore = useModelStore()
const showAdd = ref(false)
const editingId = ref<string | null>(null)
const showKey = ref(false)
const formError = ref<string | null>(null)

interface ModelForm {
  name: string
  providerId: string
  model: string
  baseUrl: string
  apiKey: string
  temperature: number
  maxTokens?: number
  enabled: boolean
  isDefault: boolean
}

const form = reactive<ModelForm>({
  name: '',
  providerId: 'openai',
  model: '',
  baseUrl: '',
  apiKey: '',
  temperature: 0.7,
  maxTokens: 2048,
  enabled: true,
  isDefault: false,
})

const suggestedModels = computed<string[]>(() => {
  const provider = BUILTIN_PROVIDERS.find((p) => p.id === form.providerId)
  return provider ? [...provider.models] : []
})

const canSave = computed(
  () => form.name.trim().length > 0 && form.model.trim().length > 0 && form.baseUrl.trim().length > 0
)

onMounted(async () => {
  if (modelStore.models.length === 0) {
    await modelStore.loadAll()
  }
  if (!modelStore.isReady) await modelStore.loadAll()
  // Pre-fill the base URL with the active provider's default if the
  // user hasn't picked anything yet.
  onProviderChange()
})

function onProviderChange() {
  const provider = BUILTIN_PROVIDERS.find((p) => p.id === form.providerId)
  if (provider) {
    form.baseUrl = provider.baseUrl
    if (!form.model && provider.defaultModel) {
      form.model = provider.defaultModel
    }
  }
}

function resetForm() {
  form.name = ''
  form.providerId = 'openai'
  form.model = ''
  form.baseUrl = ''
  form.apiKey = ''
  form.temperature = 0.7
  form.maxTokens = 2048
  form.enabled = true
  form.isDefault = false
  formError.value = null
  showKey.value = false
  onProviderChange()
}

function openAdd() {
  editingId.value = null
  resetForm()
  showAdd.value = true
}

function openEdit(model: ModelProviderConfig) {
  editingId.value = model.id
  form.name = model.name
  // Map stored `provider` back to a known providerId when possible.
  form.providerId = matchProviderId(model)
  form.model = model.model
  form.baseUrl = model.baseUrl
  form.apiKey = model.apiKey
  form.temperature = model.temperature ?? 0.7
  form.maxTokens = model.maxTokens
  form.enabled = model.enabled
  form.isDefault = !!model.isDefault
  formError.value = null
}

function matchProviderId(model: ModelProviderConfig): string {
  const known = BUILTIN_PROVIDERS.find((p) => {
    try {
      return new URL(p.baseUrl).host === new URL(model.baseUrl).host
    } catch {
      return false
    }
  })
  return known?.id ?? 'custom'
}

function closeModal() {
  showAdd.value = false
  editingId.value = null
  resetForm()
}

async function onSave() {
  if (!canSave.value) {
    formError.value = '请填写名称、模型 ID 和 Base URL'
    return
  }
  try {
    const record: Omit<ModelProviderConfig, 'createdAt' | 'updatedAt'> = {
      id: editingId.value ?? generateId(),
      name: form.name.trim(),
      provider: 'openai-compatible',
      enabled: form.enabled,
      apiKey: form.apiKey,
      baseUrl: form.baseUrl.trim().replace(/\/+$/, ''),
      model: form.model.trim(),
      temperature: form.temperature,
      maxTokens: form.maxTokens,
      isDefault: form.isDefault,
    }
    if (editingId.value) {
      await modelStore.updateModel(editingId.value, record)
    } else {
      await modelStore.addModel(record)
    }
    if (record.isDefault) {
      await modelStore.setDefaultModel(record.id)
    }
    closeModal()
  } catch (err) {
    formError.value = err instanceof Error ? err.message : '保存失败'
  }
}

async function onDelete(id: string) {
  if (!confirm('确定要删除这个模型配置吗？')) return
  await modelStore.deleteModel(id)
}

async function onToggleEnabled(model: ModelProviderConfig, enabled: boolean) {
  await modelStore.toggleEnabled(model.id, enabled)
}

async function testConnection(model: ModelProviderConfig) {
  await modelStore.testConnection(model)
}

/* ============== Inline component: ConnectionLight ============== */
/**
 * Tiny presentational component that renders a coloured dot
 * corresponding to a `ConnectionStatus`. Kept inline (rather than
 * a separate .vue file) because it is only used by this page.
 */
const ConnectionLight = {
  props: {
    status: {
      type: String as () => ConnectionStatus,
      required: true,
    },
  },
  setup(props: { status: ConnectionStatus }) {
    return () => {
      const palette: Record<ConnectionStatus, { bg: string; ring: string; title: string }> = {
        idle: { bg: 'bg-slate-300 dark:bg-slate-600', ring: '', title: '未测试' },
        testing: { bg: 'bg-amber-400', ring: 'animate-pulse', title: '测试中' },
        ok: { bg: 'bg-green-500', ring: '', title: '连接成功' },
        failed: { bg: 'bg-red-500', ring: '', title: '连接失败' },
      }
      const p = palette[props.status]
      return h('span', {
        class: `inline-block w-2.5 h-2.5 rounded-full ${p.bg} ${p.ring}`,
        title: p.title,
        'aria-label': p.title,
      })
    }
  },
}
</script>
