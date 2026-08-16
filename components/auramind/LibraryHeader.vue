<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { Database, RefreshCw, Target } from '@lucide/vue'
import { DocumentRepository } from '@/db/repositories/document.repository'
import { MetaRepository } from '@/db/repositories/meta.repository'
import { computeReadingGoal, DEFAULT_GOAL_WORDS } from '@/utils/reading-goal'

defineProps<{
  docCount: number
}>()

const emit = defineEmits<{
  refresh: []
}>()

const goalWords = ref(DEFAULT_GOAL_WORDS)
const todayWords = ref(0)
const streak = ref(0)
const progress = ref(0)

const R = 9
const CIRC = 2 * Math.PI * R

async function load() {
  const docs = await DocumentRepository.findAll()
  const goal = (await MetaRepository.get<number>('reading-goal')) ?? DEFAULT_GOAL_WORDS
  goalWords.value = goal > 0 ? goal : DEFAULT_GOAL_WORDS
  const stats = computeReadingGoal(docs, goalWords.value)
  todayWords.value = stats.todayWords
  streak.value = stats.streak
  progress.value = stats.progress
}

function fmt(n: number): string {
  return n >= 10000 ? `${(n / 10000).toFixed(1)}万` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

async function changeGoal() {
  const input = window.prompt('每日阅读目标（词数，0 关闭）：', String(goalWords.value))
  if (input == null) return
  const n = Math.max(0, Math.floor(Number(input) || 0))
  await MetaRepository.set('reading-goal', n)
  await load()
}

onMounted(load)
defineExpose({ load })
</script>

<template>
  <div class="flex items-center gap-2">
    <div class="text-[14px] font-semibold text-zinc-900 flex items-center gap-2">
      <Database class="w-4 h-4 text-brand" />
      记忆库
      <span class="text-[11px] font-normal text-zinc-400">{{ docCount }} 篇</span>
    </div>

    <!-- Daily reading goal ring -->
    <button
      class="flex items-center gap-1.5 group"
      :title="`今日阅读 ${todayWords} / ${goalWords} 词（点击修改目标）`"
      @click="changeGoal"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" class="-rotate-90">
        <circle cx="12" cy="12" :r="R" fill="none" stroke="#e4e4e7" stroke-width="3" />
        <circle
          cx="12" cy="12" :r="R" fill="none"
          :stroke="progress >= 1 ? '#10b981' : '#6366f1'"
          stroke-width="3" stroke-linecap="round"
          :stroke-dasharray="CIRC"
          :stroke-dashoffset="CIRC * (1 - progress)"
        />
      </svg>
      <span class="text-[10px] text-zinc-400 group-hover:text-brand transition-colors tabular-nums">
        {{ fmt(todayWords) }}/{{ fmt(goalWords) }}
        <span v-if="streak > 0" class="text-orange-500 ml-0.5" title="连续达标天数">🔥{{ streak }}</span>
      </span>
    </button>

    <button
      class="p-1.5 rounded-md text-zinc-500 hover:bg-zinc-100"
      title="刷新记忆库"
      @click="emit('refresh')"
    >
      <RefreshCw class="w-4 h-4" />
    </button>
    <span class="text-zinc-300 self-stretch my-1 w-px bg-zinc-200" />
    <Target class="w-3.5 h-3.5 text-zinc-300" />
  </div>
</template>
