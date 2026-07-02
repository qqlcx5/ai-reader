<script lang="ts" setup>
import { computed } from 'vue'
import { X, Check, Plus } from '@lucide/vue'
import UButton from '@/components/ui/UButton.vue'
import { useCollectionStore } from '@/stores/collection.store'

const props = defineProps<{
  open: boolean
  documentId: string | null
  documentIds?: string[]
  documentTitle?: string
}>()

const emit = defineEmits<{
  close: []
  create: []
}>()

const collectionStore = useCollectionStore()

const isBatch = computed(() => props.documentIds && props.documentIds.length > 0)
const batchCount = computed(() => props.documentIds?.length ?? 0)

interface Row {
  id: string
  name: string
  count: number
  member: boolean
}

const rows = computed<Row[]>(() =>
  collectionStore.collections.map((c) => {
    let member = false
    if (isBatch.value && props.documentIds) {
      // In batch mode, show "checked" only when ALL selected docs are members
      const ids = props.documentIds
      member = ids.length > 0 && ids.every((docId) => collectionStore.isMember(c.id, docId))
    } else if (props.documentId) {
      member = collectionStore.isMember(c.id, props.documentId)
    }
    return {
      id: c.id,
      name: c.name,
      count: collectionStore.counts[c.id] ?? 0,
      member,
    }
  }),
)

async function toggle(row: Row) {
  if (isBatch.value && props.documentIds) {
    for (const docId of props.documentIds) {
      if (row.member) await collectionStore.removeDocument(row.id, docId)
      else await collectionStore.addDocument(row.id, docId)
    }
  } else if (props.documentId) {
    if (row.member) await collectionStore.removeDocument(row.id, props.documentId)
    else await collectionStore.addDocument(row.id, props.documentId)
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center p-6"
      @click.self="emit('close')"
    >
      <div class="w-full max-w-xs bg-white rounded-2xl border border-zinc-200 shadow-2xl p-3">
        <div class="flex items-center justify-between px-1 mb-1">
          <h3 class="text-[13px] font-semibold">加入合集</h3>
          <UButton variant="ghost" @click="emit('close')">
            <X class="w-4 h-4" />
          </UButton>
        </div>
        <p v-if="isBatch" class="px-1 mb-2 text-[11px] text-zinc-400">已选 {{ batchCount }} 篇文档</p>
        <p v-else-if="documentTitle" class="px-1 mb-2 text-[11px] text-zinc-400 truncate">{{ documentTitle }}</p>

        <div class="max-h-60 overflow-y-auto -mx-1 px-1">
          <button
            v-for="row in rows"
            :key="row.id"
            type="button"
            class="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-zinc-50 text-[12px] text-zinc-700"
            @click="toggle(row)"
          >
            <span class="truncate flex items-center gap-1.5">
              <span class="truncate">{{ row.name }}</span>
              <span class="text-zinc-400 shrink-0">{{ row.count }}</span>
            </span>
            <span
              :class="[
                'w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors',
                row.member ? 'bg-brand border-brand text-white' : 'border-zinc-300 text-transparent',
              ]"
            >
              <Check class="w-3 h-3" />
            </span>
          </button>
          <div v-if="!rows.length" class="text-center py-4 text-[11px] text-zinc-400">还没有合集，先新建一个</div>
        </div>

        <UButton variant="dashed" size="lg" class="w-full mt-2" @click="emit('create')">
          <Plus class="w-3.5 h-3.5" />
          新建合集
        </UButton>
      </div>
    </div>
  </Teleport>
</template>
