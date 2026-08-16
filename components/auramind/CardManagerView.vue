<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { Search, PauseCircle, PlayCircle, Trash2, Pencil, Check, X } from '@lucide/vue'
import UButton from '@/components/ui/UButton.vue'
import UEmptyState from '@/components/ui/UEmptyState.vue'
import { FlashcardRepository } from '@/db/repositories/flashcard.repository'
import { useAppStore } from '@/stores/app.store'
import { useReviewStore } from '@/stores/review.store'
import { isDue } from '@/utils/sm2'
import { formatRelative } from '@/utils/date'
import type { FlashcardEntity } from '@/types/flashcard'

/**
 * All-cards manager: browse / search / edit / suspend / delete,
 * outside the review queue.
 */

const appStore = useAppStore()
const reviewStore = useReviewStore()

const cards = ref<FlashcardEntity[]>([])
const query = ref('')
const loading = ref(false)
const onlySuspended = ref(false)
const documentFilter = ref<string>('')

const documentOptions = computed(() => {
  const titles = new Map<string, string>()
  for (const c of cards.value) titles.set(c.documentId, c.documentId)
  return [...titles.keys()]
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return cards.value.filter((c) => {
    if (onlySuspended.value && !c.suspended) return false
    if (documentFilter.value && c.documentId !== documentFilter.value) return false
    if (!q) return true
    return c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q)
  })
})

async function load() {
  loading.value = true
  try {
    cards.value = await FlashcardRepository.findAll()
    // Resolve document titles for the filter dropdown.
    const { DocumentRepository } = await import('@/db/repositories/document.repository')
    const ids = [...new Set(cards.value.map((c) => c.documentId))]
    for (const id of ids) {
      const doc = await DocumentRepository.findById(id)
      if (doc) titleById.set(id, doc.title || '(无标题)')
    }
  } finally {
    loading.value = false
  }
}

const titleById = new Map<string, string>()
function docTitle(id: string): string {
  return titleById.get(id) || id.slice(0, 12)
}

// ── inline edit ──
const editingId = ref<string | null>(null)
const editFront = ref('')
const editBack = ref('')

function startEdit(card: FlashcardEntity) {
  editingId.value = card.id
  editFront.value = card.front
  editBack.value = card.back
}

async function saveEdit(card: FlashcardEntity) {
  if (!editFront.value.trim() || !editBack.value.trim()) return
  const updated = { ...card, front: editFront.value.trim(), back: editBack.value.trim(), updatedAt: new Date().toISOString() }
  await FlashcardRepository.save(updated)
  editingId.value = null
  await load()
  await reviewStore.loadQueue()
}

async function toggleSuspend(card: FlashcardEntity) {
  await FlashcardRepository.save({ ...card, suspended: card.suspended ? undefined : true, updatedAt: new Date().toISOString() })
  await load()
  await reviewStore.loadQueue()
}

async function remove(card: FlashcardEntity) {
  await FlashcardRepository.delete(card.id)
  await load()
  await reviewStore.loadQueue()
}

onMounted(load)
</script>

<template>
  <div class="flex-1 min-h-0 overflow-y-auto">
    <div class="max-w-xl mx-auto px-4 py-4 flex flex-col gap-3">
      <!-- Controls -->
      <div class="flex items-center gap-2">
        <div class="flex-1 flex items-center gap-1.5 bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5">
          <Search class="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <input v-model="query" placeholder="搜索全部闪卡…" class="flex-1 text-[12px] outline-none bg-transparent">
        </div>
        <button
          class="shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors"
          :class="onlySuspended ? 'bg-amber-50 text-amber-600 border-amber-200' : 'text-zinc-500 bg-white border-zinc-200 hover:bg-zinc-50'"
          @click="onlySuspended = !onlySuspended"
        >
          只看挂起
        </button>
      </div>

      <div v-if="!loading && filtered.length > 0" class="text-[11px] text-zinc-400 px-1 flex items-center gap-2">
        <span>{{ filtered.length }} 张</span>
        <select
          v-model="documentFilter"
          class="bg-white border border-zinc-200 rounded-md text-[10px] text-zinc-500 px-1 py-0.5 outline-none max-w-40"
          title="按来源文档过滤"
        >
          <option value="">全部文档</option>
          <option v-for="id in documentOptions" :key="id" :value="id">{{ docTitle(id) }}</option>
        </select>
      </div>

      <!-- Cards -->
      <div
        v-for="card in filtered"
        :key="card.id"
        class="bg-white border rounded-xl p-3 flex flex-col gap-1.5"
        :class="card.suspended ? 'border-amber-200 bg-amber-50/40' : 'border-zinc-200'"
      >
        <template v-if="editingId !== card.id">
          <div class="flex items-start gap-2">
            <div class="flex-1 min-w-0">
              <div class="text-[12.5px] text-zinc-800 line-clamp-2">{{ card.front }}</div>
              <div class="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">{{ card.back }}</div>
            </div>
            <div class="flex items-center gap-0.5 shrink-0">
              <button class="p-1.5 rounded-md text-zinc-300 hover:text-brand hover:bg-brand/50 transition-colors" title="编辑" @click="startEdit(card)">
                <Pencil class="w-3.5 h-3.5" />
              </button>
              <button
                class="p-1.5 rounded-md transition-colors"
                :class="card.suspended ? 'text-amber-500 hover:bg-amber-100' : 'text-zinc-300 hover:text-amber-500 hover:bg-amber-50'"
                :title="card.suspended ? '恢复' : '挂起'"
                @click="toggleSuspend(card)"
              >
                <component :is="card.suspended ? PlayCircle : PauseCircle" class="w-3.5 h-3.5" />
              </button>
              <button class="p-1.5 rounded-md text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="删除" @click="remove(card)">
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div class="flex items-center gap-2 text-[10px] text-zinc-400">
            <span v-if="card.type === 'cloze'" class="px-1 py-px bg-brand/10 text-brand rounded">填空</span>
            <span v-if="card.suspended" class="px-1 py-px bg-amber-100 text-amber-600 rounded">已挂起</span>
            <span v-else-if="isDue(card.sm2)" class="text-brand/70">待复习</span>
            <span>复习 {{ card.sm2.reps }} 次</span>
            <span>{{ formatRelative(card.createdAt) }}</span>
          </div>
        </template>
        <template v-else>
          <div class="flex flex-col gap-2" @click.stop>
            <textarea v-model="editFront" rows="2" class="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-[12px] focus:border-brand outline-none resize-y" placeholder="正面" />
            <textarea v-model="editBack" rows="2" class="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-[12px] focus:border-brand outline-none resize-y" placeholder="背面" />
            <div class="flex justify-end gap-2">
              <UButton size="sm" variant="ghost" @click="editingId = null"><X class="w-3.5 h-3.5" />取消</UButton>
              <UButton size="sm" variant="primary" :disabled="!editFront.trim() || !editBack.trim()" @click="saveEdit(card)"><Check class="w-3.5 h-3.5" />保存</UButton>
            </div>
          </div>
        </template>
      </div>

      <UEmptyState
        v-if="!loading && filtered.length === 0"
        :title="cards.length === 0 ? '还没有闪卡' : '没有匹配的闪卡'"
        description="回到复习页生成或导入闪卡"
        dense
      />
    </div>
  </div>
</template>
