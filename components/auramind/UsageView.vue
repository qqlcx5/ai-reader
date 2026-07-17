<script lang="ts" setup>
import dayjs from 'dayjs'
import { ref, computed, onMounted } from 'vue'
import { Gauge } from '@lucide/vue'
import { useModelStore } from '@/stores/model.store'
import { ChatRepository } from '@/db/repositories/chat.repository'
import { aggregateUsage, aggregateByDay, calcMessageCost, formatTokens, formatCNY, formatMs, type UsageAggregate } from '@/utils/cost'
import type { ConversationEntity } from '@/types/chat'

const modelStore = useModelStore()
const allConversations = ref<ConversationEntity[]>([])
const range = ref<'today' | 'week' | 'month' | 'all'>('all')

const fromMs = computed<number | undefined>(() => {
  if (range.value === 'today') return dayjs().startOf('day').valueOf()
  if (range.value === 'week') return dayjs().subtract(7, 'day').valueOf()
  if (range.value === 'month') return dayjs().subtract(30, 'day').valueOf()
  return undefined
})

const usage = computed<UsageAggregate>(() =>
  aggregateUsage(allConversations.value, modelStore.models, fromMs.value),
)

const daily = computed(() =>
  aggregateByDay(allConversations.value, modelStore.models, fromMs.value),
)

/** SVG polyline points for the daily-token trend (viewBox 300×50). */
const trendPoints = computed(() => {
  const data = daily.value
  if (data.length < 2) return ''
  const max = Math.max(...data.map((d) => d.tokens), 1)
  const W = 300
  const H = 50
  return data
    .map((d, i) => {
      const x = data.length === 1 ? 0 : (i / (data.length - 1)) * W
      const y = H - (d.tokens / max) * H
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})

const hasData = computed(() => usage.value.totalMessages > 0)

const rangeOptions = [
  { key: 'today', label: '今天' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'all', label: '全部' },
] as const

onMounted(async () => {
  await modelStore.loadModels()
  allConversations.value = await ChatRepository.findAllSorted()
})

function formatRate(r: number): string {
  return (r * 100).toFixed(1) + '%'
}

const expandedId = ref<string | null>(null)

interface ModelMessage {
  createdAt: string
  tokens: number
  cost: number
  durationMs: number
  status: string
}

/** Recent assistant messages for a model, within the current time range. */
function messagesForModel(modelId: string): ModelMessage[] {
  const f = fromMs.value
  const list: ModelMessage[] = []
  for (const conv of allConversations.value) {
    for (const msg of conv.messages) {
      if (msg.role !== 'assistant' || msg.modelId !== modelId) continue
      if (f != null && msg.createdAt) {
        const t = dayjs(msg.createdAt).valueOf()
        if (!Number.isNaN(t) && t < f) continue
      }
      const model = modelStore.models.find((m) => m.modelId === modelId)
      const cost = msg.tokenUsage && model ? (calcMessageCost(msg.tokenUsage, model) ?? 0) : 0
      list.push({
        createdAt: msg.createdAt || '',
        tokens: (msg.tokenUsage?.promptTokens ?? 0) + (msg.tokenUsage?.completionTokens ?? 0),
        cost,
        durationMs: msg.durationMs ?? 0,
        status: msg.status || '',
      })
    }
  }
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20)
}

function formatTime(iso: string): string {
  if (!iso) return '—'
  const date = dayjs(iso)
  return date.isValid() ? date.format('MM-DD HH:mm') : iso
}

function exportCsv() {
  const rows: string[][] = [['时间', '模型', '输入token', '输出token', '成本', '耗时ms', '状态']]
  const f = fromMs.value
  for (const conv of allConversations.value) {
    for (const msg of conv.messages) {
      if (msg.role !== 'assistant') continue
      if (f != null && msg.createdAt) {
        const t = dayjs(msg.createdAt).valueOf()
        if (!Number.isNaN(t) && t < f) continue
      }
      const model = modelStore.models.find((m) => m.modelId === msg.modelId)
      const cost = msg.tokenUsage && model ? (calcMessageCost(msg.tokenUsage, model) ?? 0) : 0
      rows.push([
        msg.createdAt || '',
        msg.modelId || '',
        String(msg.tokenUsage?.promptTokens ?? 0),
        String(msg.tokenUsage?.completionTokens ?? 0),
        cost.toFixed(4),
        msg.durationMs != null ? String(msg.durationMs) : '',
        msg.status === 'failed' ? '失败' : msg.status === 'success' ? '成功' : (msg.status || ''),
      ])
    }
  }
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `usage-${dayjs().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="flex-1 min-h-0 flex-col bg-surface flex">
    <!-- Header -->
    <div class="h-12 shrink-0 px-4 flex items-center border-b border-zinc-200/70 bg-surface/90 backdrop-blur-md">
      <div class="text-[14px] font-semibold flex items-center gap-2">
        <Gauge class="w-4 h-4 text-brand" />
        模型用量
        <template v-if="hasData">
          <span class="text-[11px] font-normal text-zinc-400">{{ usage.totalMessages }} 条对话 · {{ formatCNY(usage.totalCost) }}</span>
        </template>
      </div>
    </div>

    <main class="flex-1 min-h-0 overflow-y-auto px-4 py-5 flex flex-col gap-5">
      <!-- Time range filter -->
      <div class="flex items-center gap-1.5 text-[11px]">
        <button
          v-for="r in rangeOptions"
          :key="r.key"
          class="px-2.5 py-1 rounded-md transition-colors"
          :class="range === r.key ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-500 border border-zinc-200 hover:bg-zinc-50'"
          @click="range = r.key"
        >{{ r.label }}</button>
        <button
          class="ml-auto px-2.5 py-1 rounded-md text-zinc-500 border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 transition-colors"
          :disabled="!hasData"
          @click="exportCsv"
        >导出 CSV</button>
      </div>

      <!-- Empty state -->
      <div v-if="!hasData" class="text-center text-[13px] text-zinc-400 py-16">
        暂无用量数据，发起对话后这里会显示统计
      </div>

      <template v-else>
        <!-- Metric cards -->
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-white rounded-xl border border-zinc-200 shadow-sm p-3.5">
            <div class="text-[10px] text-zinc-400">Token 用量</div>
            <div class="text-[20px] font-semibold text-zinc-900 mt-1">{{ formatTokens(usage.totalTokens) }}</div>
            <div class="text-[10px] text-zinc-400 mt-1">↑{{ formatTokens(usage.totalPrompt) }} 输入 · ↓{{ formatTokens(usage.totalCompletion) }} 输出</div>
          </div>
          <div class="bg-white rounded-xl border border-zinc-200 shadow-sm p-3.5">
            <div class="text-[10px] text-zinc-400">累计花费</div>
            <div class="text-[20px] font-semibold text-zinc-900 mt-1">{{ formatCNY(usage.totalCost) }}</div>
            <div class="text-[10px] text-zinc-400 mt-1">参考价（手填优先）</div>
          </div>
          <div class="bg-white rounded-xl border border-zinc-200 shadow-sm p-3.5">
            <div class="text-[10px] text-zinc-400">平均延迟</div>
            <div class="text-[20px] font-semibold text-zinc-900 mt-1">{{ formatMs(usage.avgDurationMs) }}</div>
            <div class="text-[10px] text-zinc-400 mt-1">生成耗时（发送→完成）</div>
          </div>
          <div class="bg-white rounded-xl border border-zinc-200 shadow-sm p-3.5">
            <div class="text-[10px] text-zinc-400">首字时延</div>
            <div class="text-[20px] font-semibold text-zinc-900 mt-1">{{ formatMs(usage.avgFirstTokenMs) }}</div>
            <div class="text-[10px] text-zinc-400 mt-1">发送 → 首个 token</div>
          </div>
          <div class="bg-white rounded-xl border border-zinc-200 shadow-sm p-3.5">
            <div class="text-[10px] text-zinc-400">生成速度</div>
            <div class="text-[20px] font-semibold text-zinc-900 mt-1">{{ usage.tokensPerSec }} <span class="text-[12px] text-zinc-400 font-normal">t/s</span></div>
            <div class="text-[10px] text-zinc-400 mt-1">输出 token / 秒</div>
          </div>
          <div class="bg-white rounded-xl border border-zinc-200 shadow-sm p-3.5">
            <div class="text-[10px] text-zinc-400">错误率</div>
            <div class="text-[20px] font-semibold mt-1" :class="usage.errorRate > 0 ? 'text-red-500' : 'text-zinc-900'">{{ formatRate(usage.errorRate) }}</div>
            <div class="text-[10px] text-zinc-400 mt-1">{{ usage.failedMessages }} / {{ usage.totalMessages }} 次失败</div>
          </div>
        </div>

        <!-- Daily token trend -->
        <section v-if="daily.length >= 2" class="flex flex-col gap-2.5">
          <h2 class="text-[12px] font-medium text-zinc-400 pl-1">每日 Token 趋势</h2>
          <div class="bg-white rounded-xl border border-zinc-200 shadow-sm p-3.5">
            <svg viewBox="0 0 300 50" class="w-full h-14 text-brand" preserveAspectRatio="none">
              <polyline
                :points="trendPoints"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linejoin="round"
                stroke-linecap="round"
              />
            </svg>
            <div class="flex justify-between text-[9px] text-zinc-400 mt-1">
              <span>{{ daily[0]?.date.slice(5) }}</span>
              <span>{{ daily[daily.length - 1]?.date.slice(5) }}</span>
            </div>
          </div>
        </section>

        <!-- Per model -->
        <section v-if="usage.byModel.length > 0" class="flex flex-col gap-2.5">
          <h2 class="text-[12px] font-medium text-zinc-400 pl-1">按模型</h2>
          <div class="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
            <template v-for="m in usage.byModel" :key="m.modelId">
              <div
                class="flex items-center justify-between px-3.5 py-3 border-b border-zinc-100 cursor-pointer hover:bg-zinc-50"
                @click="expandedId = expandedId === m.modelId ? null : m.modelId"
              >
                <div class="min-w-0">
                  <div class="text-[13px] font-medium text-zinc-900 truncate">{{ m.name }}</div>
                  <div class="text-[10px] text-zinc-400 mt-0.5">
                    {{ m.total }} 次 · ↑{{ formatTokens(m.promptTokens) }} ↓{{ formatTokens(m.completionTokens) }}
                  </div>
                </div>
                <div class="text-right shrink-0 ml-3">
                  <div class="text-[13px] font-medium text-zinc-900 tabular-nums">{{ formatCNY(m.cost) }}</div>
                  <div class="text-[10px] text-zinc-400 mt-0.5 tabular-nums">首字 {{ formatMs(m.avgFirstTokenMs) }} · {{ m.tokensPerSec }} t/s · {{ formatRate(m.errorRate) }}</div>
                </div>
              </div>
              <div v-if="expandedId === m.modelId" class="px-3.5 py-2 bg-zinc-50/60 border-b border-zinc-100 flex flex-col gap-0.5">
                <div v-for="(msg, i) in messagesForModel(m.modelId)" :key="i" class="flex justify-between text-[11px]">
                  <span class="text-zinc-500">{{ formatTime(msg.createdAt) }}</span>
                  <span class="text-zinc-400 tabular-nums">{{ msg.tokens }}t · {{ formatMs(msg.durationMs) }} · <span :class="msg.status === 'failed' ? 'text-red-500' : 'text-emerald-500'">{{ msg.status === 'failed' ? '失败' : '成功' }}</span></span>
                </div>
                <div v-if="messagesForModel(m.modelId).length === 0" class="text-[11px] text-zinc-400">无明细</div>
              </div>
            </template>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>
