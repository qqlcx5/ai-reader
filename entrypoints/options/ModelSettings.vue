<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-slate-500 dark:text-slate-400">
        已配置 {{ modelStore.models.length }} 个模型
        <span v-if="modelStore.enabledModels.length > 0" class="ml-1">
          · 启用 {{ modelStore.enabledModels.length }}
        </span>
      </p>
      <BaseButton variant="primary" @click="openAdd">
        添加模型
      </BaseButton>
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
            <BaseSwitch
              :model-value="model.enabled"
              :disabled="false"
              :title="model.enabled ? '点击禁用' : '点击启用'"
              @update:model-value="onToggleEnabled(model, $event)"
            />
            <BaseButton
              variant="secondary"
              size="sm"
              :disabled="modelStore.connectionStatus[model.id] === 'testing'"
              @click="testConnection(model)"
            >
              测试连接
            </BaseButton>
            <BaseButton variant="ghost" size="sm" @click="openEdit(model)">
              编辑
            </BaseButton>
            <BaseButton variant="danger" size="sm" @click="onDelete(model.id)">
              删除
            </BaseButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <BaseDialog v-model:open="dialogOpen" :title="editingId ? '编辑模型' : '添加模型'">
      <div class="space-y-4">
        <BaseInput v-model="form.name" label="名称" placeholder="例如：我的 OpenAI" />

        <div>
          <label class="block text-sm text-slate-600 dark:text-slate-400 mb-1">提供商</label>
          <select v-model="form.providerId" @change="onProviderChange" class="input">
            <option v-for="provider in BUILTIN_PROVIDERS" :key="provider.id" :value="provider.id">
              {{ provider.name }}
            </option>
          </select>
        </div>

        <div>
          <BaseInput v-model="form.model" label="模型 ID" placeholder="例如：gpt-4o-mini" />
          <datalist v-if="suggestedModels.length" id="model-suggestions">
            <option v-for="m in suggestedModels" :key="m" :value="m" />
          </datalist>
        </div>

        <BaseInput v-model="form.baseUrl" label="Base URL" placeholder="https://api.openai.com/v1" />

        <div>
          <BaseInput
            v-model="form.apiKey"
            label="API Key"
            :type="showKey ? 'text' : 'password'"
            placeholder="sk-..."
          />
          <BaseButton
            variant="ghost"
            size="sm"
            class="mt-1"
            @click="showKey = !showKey"
          >
            {{ showKey ? '隐藏' : '显示' }}
          </BaseButton>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <BaseInput v-model="form.temperatureStr" label="Temperature" type="number" />
          <BaseInput v-model="form.maxTokensStr" label="Max Tokens" type="number" />
        </div>

        <BaseSwitch v-model="form.enabled" label="启用此模型" />
        <BaseSwitch v-model="form.isDefault" label="设为默认模型" />
      </div>

      <div v-if="formError" class="mt-4 text-sm text-red-600 dark:text-red-400">{{ formError }}</div>

      <div class="flex justify-end gap-3 mt-6">
        <BaseButton variant="secondary" @click="closeModal">
          取消
        </BaseButton>
        <BaseButton variant="primary" :disabled="!canSave" @click="onSave">
          保存
        </BaseButton>
      </div>
    </BaseDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, h, watch } from 'vue'
import { useModelStore } from '@/core/models/store'
import { BUILTIN_PROVIDERS } from '@shared/constants'
import { generateId } from '@/shared/utils'
import type { ModelProviderConfig } from '@db/schema'
import type { ConnectionStatus } from '@/core/models/store'
import { BaseButton, BaseInput, BaseSwitch, BaseDialog } from '@/components/ui'

const modelStore = useModelStore()
const showAdd = ref(false)
const editingId = ref<string | null>(null)
const showKey = ref(false)
const formError = ref<string | null>(null)

const dialogOpen = computed({
  get: () => editingId.value !== null || showAdd.value,
  set: (val: boolean) => {
    if (!val) closeModal()
  },
})

interface ModelForm {
  name: string
  providerId: string
  model: string
  baseUrl: string
  apiKey: string
  temperatureStr: string
  maxTokensStr: string
  enabled: boolean
  isDefault: boolean
}

const form = reactive<ModelForm>({
  name: '',
  providerId: 'openai',
  model: '',
  baseUrl: '',
  apiKey: '',
  temperatureStr: '0.7',
  maxTokensStr: '2048',
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
  form.temperatureStr = '0.7'
  form.maxTokensStr = '2048'
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
  form.temperatureStr = String(model.temperature ?? 0.7)
  form.maxTokensStr = String(model.maxTokens ?? 2048)
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
      temperature: parseFloat(form.temperatureStr) || 0.7,
      maxTokens: parseInt(form.maxTokensStr) || 2048,
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
