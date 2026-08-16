<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { Sparkles, Database, RefreshCw } from '@lucide/vue'
import UButton from '@/components/ui/UButton.vue'
import UInput from '@/components/ui/UInput.vue'
import { useAppStore } from '@/stores/app.store'
import {
  loadEmbeddingConfig, saveEmbeddingConfig, buildEmbeddingIndex, embeddingIndexStats,
  type EmbeddingConfig,
} from '@/services/search/embedding'

const appStore = useAppStore()

const baseUrl = ref('')
const apiKey = ref('')
const model = ref('')
const stats = ref<{ fresh: number; total: number } | null>(null)
const building = ref(false)
const progress = ref('')
const loaded = ref(false)

const configured = computed(() => Boolean(baseUrl.value && apiKey.value && model.value))
const indexComplete = computed(() => stats.value ? stats.value.fresh === stats.value.total : false)

async function persist() {
  if (!loaded.value) return
  await saveEmbeddingConfig({ baseUrl: baseUrl.value, apiKey: apiKey.value, model: model.value })
}

async function refreshStats() {
  stats.value = await embeddingIndexStats()
}

async function rebuild() {
  if (building.value || !configured.value) return
  building.value = true
  progress.value = ''
  try {
    const n = await buildEmbeddingIndex(
      { baseUrl: baseUrl.value, apiKey: apiKey.value, model: model.value },
      (p) => (progress.value = `${p.embedded}/${p.total}`),
    )
    await refreshStats()
    appStore.showToast(n > 0 ? `已建立 ${n} 篇文档的语义索引` : '索引已是最新', 'success')
  } catch (e: any) {
    appStore.showToast(e?.message || '索引构建失败', 'error')
  } finally {
    building.value = false
    progress.value = ''
  }
}

onMounted(async () => {
  const config: EmbeddingConfig = await loadEmbeddingConfig()
  baseUrl.value = config.baseUrl
  apiKey.value = config.apiKey
  model.value = config.model
  loaded.value = true
  await refreshStats()
})
</script>

<template>
  <div class="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden text-[13px]">
    <div class="p-3 border-b border-zinc-100 flex items-center gap-2">
      <Sparkles class="w-4 h-4 text-zinc-400" />
      <span class="text-zinc-700">语义检索（Embedding）</span>
    </div>
    <div class="p-3 flex flex-col gap-2.5">
      <div class="flex flex-col gap-1">
        <span class="text-[11px] text-zinc-500">API 地址（OpenAI 兼容 /embeddings）</span>
        <UInput v-model="baseUrl" placeholder="https://api.openai.com/v1" class="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-2 font-mono text-[12px] focus:border-brand" @update:model-value="persist" />
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-[11px] text-zinc-500">API Key</span>
        <UInput v-model="apiKey" type="password" placeholder="sk-..." class="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-2 font-mono text-[12px] focus:border-brand" @update:model-value="persist" />
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-[11px] text-zinc-500">模型</span>
        <UInput v-model="model" placeholder="text-embedding-3-small" class="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-2 font-mono text-[12px] focus:border-brand" @update:model-value="persist" />
      </div>
      <div class="flex items-center justify-between">
        <span class="flex items-center gap-1.5 text-[11px]" :class="configured ? (indexComplete ? 'text-emerald-600' : 'text-amber-600') : 'text-zinc-400'">
          <Database class="w-3 h-3" />
          <template v-if="!configured">未配置（知识库问答将只用关键词检索）</template>
          <template v-else-if="stats">{{ stats.fresh }}/{{ stats.total }} 已索引{{ indexComplete ? ' ✓' : '' }}</template>
        </span>
        <UButton size="sm" variant="secondary" :disabled="building || !configured" @click="rebuild">
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': building }" />
          {{ building ? `构建中 ${progress}` : '构建索引' }}
        </UButton>
      </div>
      <div class="text-[11px] text-zinc-400">
        配置后，知识库问答会在关键词检索之上融合语义排名（RRF），文档改动会自动重建向量。
      </div>
    </div>
  </div>
</template>
