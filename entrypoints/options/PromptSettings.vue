<template>
  <div class="space-y-6">
    <!-- Global default -->
    <div>
      <div class="flex items-center justify-between mb-1">
        <label class="block text-sm text-slate-600 dark:text-slate-400">全局默认系统提示词</label>
        <BaseButton
          variant="ghost"
          size="sm"
          @click="onResetDefault"
        >
          重置为默认
        </BaseButton>
      </div>
      <BaseTextarea
        v-model="defaultPromptDraft"
        :rows="6"
        placeholder="所有对话都会在 system 消息中使用这个提示词（除非被按模型配置覆盖）。"
      />
      <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">
        这个提示词会作为默认的系统提示词，用于所有新的对话。
      </p>
      <div class="flex gap-2 mt-3">
        <BaseButton
          variant="primary"
          :disabled="!defaultPromptDirty"
          @click="onSaveDefault"
        >
          保存
        </BaseButton>
      </div>
    </div>

    <!-- Template variable hints -->
    <div class="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm">
      <p class="font-medium text-slate-700 dark:text-slate-300 mb-2">
        可用模板变量（在提示词正文中使用）
      </p>
      <ul class="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
        <li v-for="v in TEMPLATE_VARIABLES" :key="v.token">
          <code class="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono">{{ v.token }}</code>
          <span class="ml-1">— {{ v.description }}</span>
        </li>
      </ul>
      <p class="text-xs text-slate-500 dark:text-slate-500 mt-2">
        变量会在每次发送前替换为实际值；未被识别的 token 保持原样。
      </p>
    </div>

    <!-- Per-model overrides -->
    <div>
      <h3 class="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">按模型单独配置</h3>

      <div v-if="modelStore.models.length === 0" class="text-sm text-slate-500 py-3">
        尚未配置任何模型。
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="model in modelStore.models"
          :key="model.id"
          class="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
        >
          <div class="flex items-center justify-between gap-2 mb-2">
            <div class="min-w-0">
              <div class="font-medium text-sm text-slate-800 dark:text-slate-100 truncate">
                {{ model.name }}
                <span v-if="model.isDefault" class="ml-1 text-xs text-brand-600 dark:text-brand-400">(默认)</span>
              </div>
              <div class="text-xs text-slate-500 truncate">{{ model.model }}</div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <BaseButton
                v-if="perModelDrafts[model.id] && perModelDrafts[model.id]!.length > 0"
                variant="ghost"
                size="sm"
                @click="onClearModelPrompt(model.id)"
              >
                清除
              </BaseButton>
              <BaseButton
                variant="primary"
                size="sm"
                :disabled="perModelDrafts[model.id] === modelStore.perModelPrompts[model.id] || perModelDrafts[model.id] === undefined"
                @click="onSaveModelPrompt(model.id)"
              >
                保存
              </BaseButton>
            </div>
          </div>
          <BaseTextarea
            v-model="perModelDrafts[model.id]"
            :rows="3"
            :placeholder="defaultSystemPrompt || '留空将使用全局默认系统提示词'"
          />
          <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">
            留空则继承全局默认提示词。
          </p>
        </div>
      </div>
    </div>

    <div v-if="saveMessage" class="text-sm" :class="saveError ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'">
      {{ saveMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive, watch } from 'vue'
import { useModelStore } from '@/core/models/store'
import { DEFAULT_SYSTEM_PROMPT } from '@shared/constants'
import { BaseButton, BaseTextarea } from '@/components/ui'

interface TemplateVariable {
  token: string
  description: string
}

const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { token: '{{date}}', description: '当前日期 (YYYY-MM-DD)' },
  { token: '{{datetime}}', description: '当前日期 + 时间' },
  { token: '{{url}}', description: '当前页 URL' },
  { token: '{{title}}', description: '当前文档标题' },
  { token: '{{language}}', description: '当前界面语言' },
]

const modelStore = useModelStore()

const defaultPromptDraft = ref('')
const perModelDrafts = reactive<Record<string, string | undefined>>({})
const saveMessage = ref<string | null>(null)
const saveError = ref(false)

const defaultSystemPrompt = computed(() => modelStore.settings.defaultSystemPrompt)

const defaultPromptDirty = computed(
  () => defaultPromptDraft.value !== (modelStore.settings.defaultSystemPrompt ?? DEFAULT_SYSTEM_PROMPT)
)

onMounted(async () => {
  await modelStore.loadAll()
  defaultPromptDraft.value = modelStore.settings.defaultSystemPrompt ?? DEFAULT_SYSTEM_PROMPT
  // Seed per-model drafts from persisted overrides.
  for (const m of modelStore.models) {
    perModelDrafts[m.id] = modelStore.perModelPrompts[m.id] ?? ''
  }
})

// When models load after the initial render (e.g. they were
// empty), make sure their draft slot exists.
watch(
  () => modelStore.models.map((m) => m.id),
  (ids) => {
    for (const id of ids) {
      if (!(id in perModelDrafts)) {
        perModelDrafts[id] = modelStore.perModelPrompts[id] ?? ''
      }
    }
  },
  { immediate: true }
)

async function onSaveDefault() {
  try {
    await modelStore.setDefaultSystemPrompt(defaultPromptDraft.value)
    saveError.value = false
    saveMessage.value = '已保存全局默认系统提示词'
    setTimeout(() => (saveMessage.value = null), 2000)
  } catch (err) {
    saveError.value = true
    saveMessage.value = err instanceof Error ? err.message : '保存失败'
  }
}

function onResetDefault() {
  defaultPromptDraft.value = DEFAULT_SYSTEM_PROMPT
}

async function onSaveModelPrompt(modelId: string) {
  try {
    const value = perModelDrafts[modelId] ?? ''
    if (value.length === 0) {
      await modelStore.clearModelPrompt(modelId)
    } else {
      await modelStore.setModelPrompt(modelId, value)
    }
    saveError.value = false
    saveMessage.value = '已保存该模型的系统提示词'
    setTimeout(() => (saveMessage.value = null), 2000)
  } catch (err) {
    saveError.value = true
    saveMessage.value = err instanceof Error ? err.message : '保存失败'
  }
}

async function onClearModelPrompt(modelId: string) {
  perModelDrafts[modelId] = ''
  await modelStore.clearModelPrompt(modelId)
}
</script>
