<script lang="ts" setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { Search, FileText, ArrowRight, Zap, Languages, GraduationCap, Moon } from '@lucide/vue'
import { useAppStore, type AppView } from '@/stores/app.store'
import { useDocumentStore } from '@/stores/document.store'
import { useChatStore } from '@/stores/chat.store'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { useModelStore } from '@/stores/model.store'
import { useReviewStore } from '@/stores/review.store'
import { useSettingsStore } from '@/stores/settings.store'
import { searchDocuments } from '@/services/search'
import { DocumentRepository } from '@/db/repositories/document.repository'
import type { DocumentEntity } from '@/types/document'

/**
 * Ctrl/Cmd+K command palette: fuzzy document search + view shortcuts,
 * overlaying the whole panel.
 */

const appStore = useAppStore()
const documentStore = useDocumentStore()
const chatStore = useChatStore()
const workspaceStore = useWorkspaceStore()
const modelStore = useModelStore()
const reviewStore = useReviewStore()
const settingsStore = useSettingsStore()

const open = ref(false)
const query = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const activeIndex = ref(0)
const docHits = ref<DocumentEntity[]>([])

const VIEW_ACTIONS: Array<{ key: AppView; label: string }> = [
  { key: 'workspace', label: '跳转：工作区' },
  { key: 'library', label: '跳转：记忆库' },
  { key: 'review', label: '跳转：复习' },
  { key: 'cards', label: '跳转：卡片库' },
  { key: 'graph', label: '跳转：图谱' },
  { key: 'feeds', label: '跳转：订阅' },
  { key: 'usage', label: '跳转：用量' },
  { key: 'settings', label: '跳转：设置' },
]

interface ActionItem {
  key: string
  label: string
  icon: unknown
  run: () => void | Promise<void>
}

const ACTIONS: ActionItem[] = [
  {
    key: 'capture',
    label: '动作：抓取当前页面',
    icon: Zap,
    run: () => {
      // The capture trigger lives in App.vue; delegate via a DOM event.
      window.dispatchEvent(new CustomEvent('auramind:palette-action', { detail: { type: 'capture' } }))
    },
  },
  {
    key: 'flashcards',
    label: '动作：为当前文档生成闪卡',
    icon: GraduationCap,
    run: async () => {
      const doc = documentStore.currentDocument
      const model = modelStore.defaultModel
      if (!doc || !model) {
        appStore.showToast(doc ? '请先在设置中添加模型' : '工作区还没有文档', 'error')
        return
      }
      const n = await reviewStore.generateForDocument(doc, model)
      appStore.showToast(n > 0 ? `已生成 ${n} 张闪卡` : '没有生成新卡片', n > 0 ? 'success' : 'info')
    },
  },
  {
    key: 'translate',
    label: '动作：翻译当前文档',
    icon: Languages,
    run: () => {
      workspaceStore.setContextTab('translation')
      appStore.setCurrentView('workspace')
    },
  },
  {
    key: 'theme',
    label: '动作：切换亮色 / 暗色',
    icon: Moon,
    run: () => {
      const dark = document.documentElement.classList.contains('dark')
      settingsStore.updateTheme(dark ? 'light' : 'dark')
    },
  },
]

const viewActions = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return VIEW_ACTIONS.slice(0, 3)
  return VIEW_ACTIONS.filter((a) => a.label.toLowerCase().includes(q) || a.key.includes(q)).slice(0, 3)
})

const commandActions = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return ACTIONS.slice(0, 2)
  return ACTIONS.filter((a) => a.label.toLowerCase().includes(q))
})

const items = computed(() => [
  ...docHits.value.slice(0, 7).map((doc) => ({ kind: 'doc' as const, doc })),
  ...viewActions.value.map((a) => ({ kind: 'view' as const, a })),
  ...commandActions.value.map((a) => ({ kind: 'action' as const, a })),
])

watch(query, async () => {
  activeIndex.value = 0
  const q = query.value.trim()
  if (!q) {
    docHits.value = []
    return
  }
  const hits = searchDocuments(q).slice(0, 7)
  const docs: DocumentEntity[] = []
  for (const h of hits) {
    const doc = await DocumentRepository.findById(h.id)
    if (doc) docs.push(doc)
  }
  docHits.value = docs
})

watch(open, async (v) => {
  if (v) {
    query.value = ''
    activeIndex.value = 0
    await nextTick()
    inputRef.value?.focus()
  }
})

function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    open.value = !open.value
    return
  }
  if (!open.value) return
  if (e.key === 'Escape') {
    open.value = false
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = Math.min(items.value.length - 1, activeIndex.value + 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = Math.max(0, activeIndex.value - 1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    activate(items.value[activeIndex.value])
  }
}

async function activate(item: { kind: 'doc'; doc: DocumentEntity } | { kind: 'view'; a: { key: AppView; label: string } } | { kind: 'action'; a: ActionItem } | undefined) {
  if (!item) return
  open.value = false
  if (item.kind === 'view') {
    appStore.setCurrentView(item.a.key, { resetHistory: true })
    return
  }
  if (item.kind === 'action') {
    await item.a.run()
    return
  }
  const doc = item.doc
  documentStore.setCurrentDocument(doc)
  documentStore.markOpened(doc.id)
  workspaceStore.setDocumentSource('library')
  try {
    await chatStore.loadConversations(doc.id)
  } catch {
    // non-critical
  }
  appStore.setCurrentView('workspace')
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('auramind:omnibox', onOmnibox as EventListener)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('auramind:omnibox', onOmnibox as EventListener)
})

function onOmnibox(e: Event) {
  const q = (e as CustomEvent).detail?.query || ''
  open.value = true
  query.value = q
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 bg-black/30 flex items-start justify-center pt-16"
      @click.self="open = false"
    >
      <div class="w-[420px] max-w-[92vw] bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden">
        <div class="flex items-center gap-2 px-3.5 py-3 border-b border-zinc-100">
          <Search class="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            ref="inputRef"
            v-model="query"
            placeholder="搜索文档或跳转…（Esc 关闭）"
            class="flex-1 text-[13px] outline-none bg-transparent"
          >
          <kbd class="text-[10px] text-zinc-400 border border-zinc-200 rounded px-1.5 py-0.5">Ctrl K</kbd>
        </div>

        <div class="max-h-72 overflow-y-auto p-1.5">
          <div v-if="items.length === 0" class="py-8 text-center text-[12px] text-zinc-400">
            没有匹配的文档或动作
          </div>
          <button
            v-for="(item, i) in items"
            :key="item.kind === 'doc' ? item.doc.id : item.kind === 'view' ? item.a.key : item.a.key"
            class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors"
            :class="i === activeIndex ? 'bg-brand/10 text-brand' : 'text-zinc-600 hover:bg-zinc-50'"
            @mouseenter="activeIndex = i"
            @click="activate(item)"
          >
            <FileText v-if="item.kind === 'doc'" class="w-3.5 h-3.5 shrink-0 opacity-60" />
            <ArrowRight v-else-if="item.kind === 'view'" class="w-3.5 h-3.5 shrink-0 opacity-60" />
            <component :is="item.a.icon" v-else class="w-3.5 h-3.5 shrink-0 opacity-60" />
            <span class="truncate text-[12.5px]">{{ item.kind === 'doc' ? (item.doc.title || '(无标题)') : item.a.label }}</span>
            <span v-if="item.kind === 'doc' && item.doc.siteName" class="ml-auto text-[10px] text-zinc-400 shrink-0 truncate max-w-24">{{ item.doc.siteName }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
