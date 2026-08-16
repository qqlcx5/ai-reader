<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { Newspaper, Zap } from '@lucide/vue'
import UButton from '@/components/ui/UButton.vue'
import { useAppStore } from '@/stores/app.store'
import { loadDigestConfig, saveDigestConfig, maybeRunDailyDigest } from '@/services/digest/daily'

const appStore = useAppStore()

const enabled = ref(false)
const hour = ref(8)
const webhookUrl = ref('')
const webhookFormat = ref<'feishu' | 'generic'>('feishu')
const loaded = ref(false)
const testing = ref(false)

const hourOptions = Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: `${String(h).padStart(2, '0')}:00` }))

const hourValue = computed({
  get: () => String(hour.value),
  set: (v: string) => {
    hour.value = Number(v)
    persist()
  },
})

async function persist() {
  if (!loaded.value) return
  await saveDigestConfig({ enabled: enabled.value, hour: hour.value, webhookUrl: webhookUrl.value.trim() || undefined, webhookFormat: webhookFormat.value })
}

async function toggleEnabled() {
  enabled.value = !enabled.value
  await persist()
}

async function runNow() {
  testing.value = true
  try {
    // Temporarily bypass the hour gate for a manual run: pretend it's evening.
    const evening = new Date()
    evening.setHours(23)
    const r = await maybeRunDailyDigest(evening)
    if (r.ran) appStore.showToast('简报已生成，在记忆库查看「每日简报」', 'success')
    else appStore.showToast(`未生成：${r.reason === 'no-model' ? '请先配置默认模型' : r.reason}`, r.reason === 'no-model' ? 'error' : 'info')
  } finally {
    testing.value = false
  }
}

onMounted(async () => {
  const config = await loadDigestConfig()
  enabled.value = config.enabled
  hour.value = config.hour
  webhookUrl.value = config.webhookUrl ?? ''
  webhookFormat.value = config.webhookFormat ?? 'feishu'
  loaded.value = true
})
</script>

<template>
  <div class="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden text-[13px]">
    <div class="p-3 border-b border-zinc-100 flex items-center justify-between">
      <div class="flex flex-col gap-0.5">
        <span class="text-zinc-700 flex items-center gap-1.5"><Newspaper class="w-4 h-4 text-zinc-400" />每日 AI 简报</span>
        <span class="text-[11px] text-zinc-400">每天用默认模型生成晨报：昨日剪藏要点 + 复习看板 + 今日建议，自动入库</span>
      </div>
      <button
        class="shrink-0 w-9 h-5 rounded-full transition-colors relative"
        :class="enabled ? 'bg-brand' : 'bg-zinc-200'"
        role="switch"
        :aria-checked="enabled"
        @click="toggleEnabled"
      >
        <span
          class="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
          :class="enabled ? 'left-[18px]' : 'left-0.5'"
        />
      </button>
    </div>
    <div class="p-3 flex items-center justify-between">
      <label class="text-[11px] text-zinc-500 flex items-center gap-2">
        生成时间
        <select
          v-model="hourValue"
          class="bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 text-[12px] focus:border-brand outline-none"
        >
          <option v-for="o in hourOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <span class="text-zinc-400">之后</span>
      </label>
      <UButton size="sm" variant="secondary" :disabled="testing" @click="runNow">
        <Zap class="w-3.5 h-3.5" />
        {{ testing ? '生成中…' : '立即生成' }}
      </UButton>
    </div>
    <div class="p-3 flex items-center justify-between border-t border-zinc-100">
      <label class="text-[11px] text-zinc-500 flex-1 flex flex-col gap-1 mr-3">
        推送到 Webhook（可选）
        <input
          v-model="webhookUrl"
          placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/…"
          class="bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1.5 text-[11px] font-mono focus:border-brand outline-none"
          @change="persist"
        >
      </label>
      <select
        v-model="webhookFormat"
        class="mt-4 bg-zinc-50 border border-zinc-200 rounded-lg text-[11px] px-1.5 py-1.5 outline-none"
        title="Webhook 格式"
        @change="persist"
      >
        <option value="feishu">飞书/钉钉</option>
        <option value="generic">通用 JSON</option>
      </select>
    </div>
  </div>
</template>
