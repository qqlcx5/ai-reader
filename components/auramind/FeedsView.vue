<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Plus, RefreshCw, Trash2, ExternalLink, Globe, Upload, Download, ChevronLeft, ChevronDown, ChevronRight, Zap, FolderInput, Check, X, Ellipsis, ArrowUp, Database, Bot, RotateCcw, MessageSquare, BookOpen } from '@lucide/vue'
import UButton from '@/components/ui/UButton.vue'
import UInput from '@/components/ui/UInput.vue'
import ScrollFab from '@/components/ui/ScrollFab.vue'
import {
  DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal,
  DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from 'reka-ui'
import { useFeedStore } from '@/stores/feed.store'
import { useAppStore } from '@/stores/app.store'
import { useDocumentStore } from '@/stores/document.store'
import { useChatStore } from '@/stores/chat.store'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { exportOpml, parseOpml } from '@/utils/feed/opml'
import { sanitizeHtml, enhanceCodeBlocks, renderMarkdown } from '@/utils/markdown'
import { toast } from '@/utils/toast'
import type { FeedEntity } from '@/types/feed'

const feedStore = useFeedStore()

const newUrl = ref('')
const newFolder = ref('')
const selectedItemId = ref<string | null>(null)
const collecting = ref(false)
const opmlInput = ref<HTMLInputElement | null>(null)
const collapsed = ref<Set<string>>(new Set())
const showCollectPanel = ref(false)

// Responsive layout: wide (≥760px) = 3 panes side-by-side; compact = a single
// pane with back-style navigation — timeline ↔ reader, feed list behind "源".
const rootRef = ref<HTMLElement | null>(null)
const compact = ref(false)
const showFeeds = ref(false) // compact only: feed-picker pane open
const showReader = computed(() => !!selectedItemId.value)
const currentFeedTitle = computed(() => {
  const id = feedStore.selectedFeedId
  if (id == null) return '全部'
  return feedStore.feeds.find((f) => f.id === id)?.title || '全部'
})
watch(compact, (c) => {
  if (!c) showFeeds.value = false
})

function toggleFolder(folder: string) {
  const next = new Set(collapsed.value)
  if (next.has(folder)) next.delete(folder)
  else next.add(folder)
  collapsed.value = next
}

const STALE_MS = 30 * 60 * 1000

function isStale(): boolean {
  if (!feedStore.feeds.length) return false
  const latest = feedStore.feeds.reduce((max, f) => {
    const t = f.lastFetchedAt ? new Date(f.lastFetchedAt).getTime() : 0
    return Math.max(max, t)
  }, 0)
  return Date.now() - latest > STALE_MS
}

const selectedItem = computed(
  () => feedStore.items.find((i) => i.id === selectedItemId.value) ?? null,
)

const readerRef = ref<HTMLElement | null>(null)

const safeContent = computed(() => {
  const html = selectedItem.value?.contentHtml || selectedItem.value?.summary || ''
  return sanitizeHtml(html)
})

const readerScrollRef = ref<HTMLElement | null>(null)
const showBackToTop = ref(false)

// ── Reading progress tracking (FeedsView reader) ──
let lastReportedProgress = -1
let progressThrottle: ReturnType<typeof setTimeout> | null = null

function reportReaderProgress() {
  const item = selectedItem.value
  if (!item?.documentId) return
  const el = readerScrollRef.value
  if (!el) return
  const { scrollTop, scrollHeight, clientHeight } = el
  // Short article: no scroll needed → mark as fully read
  if (scrollHeight <= clientHeight) {
    documentStore.updateReadProgress(item.documentId, 1)
    lastReportedProgress = 1
    return
  }
  const maxScroll = scrollHeight - clientHeight
  if (maxScroll <= 0) return
  const p = Math.min(1, scrollTop / maxScroll)
  if (p - lastReportedProgress < 0.03 && p < 1) return
  lastReportedProgress = p
  documentStore.updateReadProgress(item.documentId, p)
}

function onReaderScroll() {
  const el = readerScrollRef.value
  if (!el) return
  showBackToTop.value = el.scrollTop > 400
  if (progressThrottle) return
  progressThrottle = setTimeout(() => {
    progressThrottle = null
    reportReaderProgress()
  }, 200)
}

function backToTop() {
  readerScrollRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

// Same code-block UX (highlight + copy button) as the library reader. Also
// reset scroll on item change so a new article always opens at the top.
watch(safeContent, async () => {
  await nextTick()
  if (readerScrollRef.value) {
    // Restore reading position if available
    const docId = selectedItem.value?.documentId
    const doc = docId ? documentStore.documents.find((d) => d.id === docId) : null
    const progress = doc?.readProgress ?? 0
    if (progress > 0 && progress < 1) {
      const maxScroll = readerScrollRef.value.scrollHeight - readerScrollRef.value.clientHeight
      readerScrollRef.value.scrollTop = maxScroll * progress
      lastReportedProgress = progress
    } else {
      readerScrollRef.value.scrollTop = 0
      lastReportedProgress = -1
    }
  }
  showBackToTop.value = false
  if (readerRef.value) enhanceCodeBlocks(readerRef.value)
})

onMounted(async () => {
  await feedStore.loadFeeds()
})

function displayDate(iso?: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

async function onSubscribe() {
  const url = newUrl.value.trim()
  if (!url) return
  try {
    await feedStore.subscribe(url, newFolder.value.trim() || undefined)
    newUrl.value = ''
    toast.success('已订阅', { category: 'rss' })
  } catch {
    toast.error('订阅失败', { category: 'rss' })
  }
}

async function onOpenItem(itemId: string) {
  selectedItemId.value = itemId
  await feedStore.markRead(itemId)
}

function onSelectFeed(id: string | null) {
  feedStore.selectFeed(id)
  showFeeds.value = false
  selectedItemId.value = null
}

// Inline "move to folder" editor: click the folder icon on a feed row, then
// type/pick a folder (datalist offers existing folders; blank = 未分组).
const editingFolderFeedId = ref<string | null>(null)
const folderDraft = ref('')
const knownFolders = computed(() => {
  const s = new Set<string>()
  for (const f of feedStore.feeds) if (f.folder) s.add(f.folder)
  return [...s]
})

function startMoveFolder(f: FeedEntity) {
  editingFolderFeedId.value = f.id
  folderDraft.value = f.folder || ''
}
function cancelMoveFolder() {
  editingFolderFeedId.value = null
}
async function commitMoveFolder(f: FeedEntity) {
  const name = folderDraft.value.trim()
  if (name === (f.folder || '')) {
    editingFolderFeedId.value = null
    return
  }
  await feedStore.moveFolder(f.id, name || undefined)
  editingFolderFeedId.value = null
  toast.success(name ? `已移动到「${name}」` : '已移出分组', { category: 'rss' })
}

async function onOpenOriginal(url: string) {
  if (!url) return
  const tabs = (globalThis as any).browser?.tabs
  if (tabs) await tabs.create({ url })
}

/** Trigger refresh via background store method (handles toast + fallback). */
async function triggerRefresh() {
  await feedStore.refreshViaBackground()
}

async function onCollect() {
  if (!selectedItem.value || collecting.value) return
  if (selectedItem.value.documentId) {
    toast.info('已在记忆库中', { category: 'rss' })
    return
  }
  collecting.value = true
  try {
    await feedStore.collect(selectedItem.value.id)
    toast.success('已收藏到记忆库', { category: 'rss' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '收藏失败'
    toast.error(msg, { category: 'rss' })
  } finally {
    collecting.value = false
  }
}

const uncollecting = ref(false)
async function onUncollect() {
  if (!selectedItem.value?.documentId || uncollecting.value) return
  uncollecting.value = true
  try {
    await feedStore.uncollect(selectedItem.value.id)
    toast.success('已从记忆库移除', { category: 'rss' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '移除失败'
    toast.error(msg, { category: 'rss' })
  } finally {
    uncollecting.value = false
  }
}

/** Jump to workspace to view this article's document & conversations. */
async function goToLibrary(documentId: string) {
  const appStore = useAppStore()
  const documentStore = useDocumentStore()
  const chatStore = useChatStore()
  const workspaceStore = useWorkspaceStore()
  await documentStore.loadDocument(documentId)
  documentStore.markOpened(documentId)
  workspaceStore.setDocumentSource('library')
  try {
    await chatStore.loadConversations(documentId)
  } catch {
    // non-critical
  }
  appStore.setCurrentView('workspace')
}

// Background alarm now runs refresh independently. Panel only needs to:
// 1. Listen for FEEDS_REFRESHED to reload the feed list
// 2. Request TRIGGER_FEED_REFRESH on stale check (panel just opened)
function onBackgroundMessage(message: any) {
  feedStore.onBackgroundEvent(message)
}
let removeMsgListener: (() => void) | null = null
function onExportOpml() {
  if (!feedStore.feeds.length) {
    toast.info('暂无订阅源', { category: 'rss' })
    return
  }
  const xml = exportOpml(feedStore.feeds)
  const blob = new Blob([xml], { type: 'text/xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'auramind-subscriptions.opml'
  a.click()
  URL.revokeObjectURL(url)
}

async function onImportOpml(file: File) {
  try {
    const subs = parseOpml(await file.text())
    if (!subs.length) {
      toast.error('OPML 中没有订阅源', { category: 'rss' })
      return
    }
    for (const s of subs) {
      await feedStore.subscribe(s.xmlUrl, s.folder)
    }
    toast.success(`已导入 ${subs.length} 个订阅源`, { category: 'rss' })
  } catch {
    toast.error('OPML 解析失败', { category: 'rss' })
  }
}

function onOpmlFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) onImportOpml(file)
}

onMounted(async () => {
  await feedStore.loadFeeds()
  if (isStale()) {
    // Ask background to refresh (runs via offscreen, no panel dependency)
    const runtime = (globalThis as any).browser?.runtime
    runtime?.sendMessage({ type: 'TRIGGER_FEED_REFRESH' }).catch(() => {})
  }
  const runtime = (globalThis as any).browser?.runtime
  runtime?.onMessage.addListener(onBackgroundMessage)
  removeMsgListener = () => runtime?.onMessage.removeListener(onBackgroundMessage)
})

// Track container width → switch between wide (3-pane) and compact (1-pane).
// ResizeObserver (not matchMedia): the sidepanel's own width is what matters,
// and window.innerWidth reflects the whole browser, not this panel.
let ro: ResizeObserver | null = null
onMounted(() => {
  ro = new ResizeObserver((entries) => {
    const w = entries[0]?.contentRect.width ?? 0
    compact.value = w < 760
  })
  if (rootRef.value) ro.observe(rootRef.value)
})

// AI job polling: refresh when there are pending/processing jobs
let aiPollTimer: ReturnType<typeof setInterval> | null = null
watch(() => feedStore.aiSummary, (s) => {
  const needPoll = s.pending > 0 || s.processing > 0
  if (needPoll && !aiPollTimer) {
    aiPollTimer = setInterval(() => feedStore.loadAiJobs(), 3000)
  } else if (!needPoll && aiPollTimer) {
    clearInterval(aiPollTimer)
    aiPollTimer = null
  }
}, { deep: true })

// Also refresh when ai-job store finishes draining (e.g. from Settings page)
onMounted(() => {
  ;(globalThis as any).__aiJobsChanged = () => feedStore.loadAiJobs()
})

onUnmounted(() => {
  removeMsgListener?.()
  ro?.disconnect()
  if (aiPollTimer) clearInterval(aiPollTimer)
  delete (globalThis as any).__aiJobsChanged
  // Flush reading progress
  if (progressThrottle) clearTimeout(progressThrottle)
  reportReaderProgress()
})
</script>

<template>
  <div ref="rootRef" class="flex-1 min-h-0 flex flex-col bg-surface">
    <!-- Compact top bar: back when reading, else feed-picker toggle + refresh -->
    <header v-if="compact" class="flex items-center gap-2 h-9 px-2.5 border-b border-zinc-100 shrink-0 bg-white">
      <template v-if="showReader">
        <button class="flex items-center gap-0.5 text-[12px] text-zinc-600 hover:text-brand transition-colors" @click="selectedItemId = null">
          <ChevronLeft class="w-3.5 h-3.5" /> 返回
        </button>
        <span class="text-[12px] truncate flex-1 text-zinc-400">{{ currentFeedTitle }}</span>
      </template>
      <template v-else>
        <button
          class="flex items-center gap-1 text-[12px] px-1.5 py-0.5 rounded transition-colors"
          :class="showFeeds ? 'text-brand bg-brand/10' : 'text-zinc-500 hover:bg-zinc-100'"
          @click="showFeeds = !showFeeds"
        >
          <Globe class="w-3.5 h-3.5" /> 源
        </button>
        <span class="text-[12px] truncate flex-1 text-zinc-700 font-medium">{{ showFeeds ? '订阅源' : currentFeedTitle }}</span>
        <button
          class="p-1 rounded text-zinc-400 hover:text-brand hover:bg-zinc-100 transition-colors"
          :disabled="feedStore.refreshing"
          title="全部刷新"
          @click="triggerRefresh()"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': feedStore.refreshing }" />
        </button>
      </template>
    </header>

    <div class="flex-1 min-h-0 flex">
      <!-- Feed list -->
      <aside
        class="w-[180px] shrink-0 border-r border-zinc-100 flex flex-col min-h-0"
        :class="compact ? (showFeeds ? 'w-full' : 'hidden') : ''"
      >
      <div class="p-2.5 border-b border-zinc-100">
        <UInput v-model="newUrl" placeholder="订阅源 URL" class="w-full h-8 rounded-md border border-zinc-200 px-2 text-[12px]" />
        <UInput v-model="newFolder" placeholder="分组（可选）" class="mt-1.5 w-full h-8 rounded-md border border-zinc-200 px-2 text-[12px]" />
        <UButton variant="primary" size="sm" class="w-full mt-1.5" :disabled="!newUrl.trim()" @click="onSubscribe">
          <Plus class="w-3 h-3" />订阅
        </UButton>
        <div class="flex gap-1.5 mt-1.5">
          <UButton variant="secondary" size="sm" class="flex-1" title="导入 OPML" @click="opmlInput?.click()">
            <Upload class="w-3 h-3" />导入
          </UButton>
          <UButton variant="secondary" size="sm" class="flex-1" title="导出 OPML" @click="onExportOpml">
            <Download class="w-3 h-3" />导出
          </UButton>
        </div>
        <input
          ref="opmlInput"
          type="file"
          accept=".opml,.xml,application/xml,text/xml"
          class="hidden"
          @change="onOpmlFileChange"
        />
      </div>

      <div class="px-2 py-1.5 flex items-center justify-between">
        <span class="text-[10px] text-zinc-400 font-medium">订阅源</span>
        <div class="flex items-center gap-0.5">
          <!-- 入库状态按钮 -->
          <button
            class="p-1 rounded transition-colors relative"
            :class="showCollectPanel ? 'text-brand bg-brand/10' : 'text-zinc-400 hover:text-brand hover:bg-zinc-100'"
            title="入库状态"
            @click="showCollectPanel = !showCollectPanel"
          >
            <Database class="w-3 h-3" />
            <span v-if="feedStore.totalPending > 0" class="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
          </button>
          <button
            class="p-1 rounded text-zinc-400 hover:text-brand hover:bg-zinc-100 transition-colors"
            title="全部刷新"
            :disabled="feedStore.refreshing"
            @click="triggerRefresh()"
          >
            <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': feedStore.refreshing }" />
          </button>
        </div>
      </div>

      <!-- 入库状态面板 -->
      <div v-if="showCollectPanel" class="px-2 py-2 border-b border-zinc-100 bg-zinc-50/50">
        <!-- 概览 -->
        <div class="flex items-center justify-between mb-2">
          <div class="text-[11px] text-zinc-500">
            <span class="font-medium text-zinc-700">{{ feedStore.autoCollectFeeds.length }}</span> 个源已开启
            <span class="text-zinc-300 mx-0.5">·</span>
            <span class="text-amber-500 font-medium">{{ feedStore.autoPending }}</span> 待入库
            <span class="text-zinc-300 mx-0.5">·</span>
            <span class="text-emerald-500 font-medium">{{ feedStore.autoCollected }}</span> 已入库
            <template v-if="feedStore.autoFailed > 0">
              <span class="text-zinc-300 mx-0.5">·</span>
              <span class="text-red-500 font-medium">{{ feedStore.autoFailed }}</span> 收集失败
            </template>
          </div>
        </div>

        <!-- 一键收集 -->
        <button
          class="w-full flex items-center justify-center gap-1 py-1.5 rounded-md text-[11px] font-medium transition-colors mb-2"
          :class="feedStore.autoPending > 0
            ? 'bg-brand/10 text-brand hover:bg-brand/20'
            : 'bg-zinc-100 text-zinc-400 cursor-default'"
          :disabled="feedStore.autoPending === 0 || feedStore.anyCollecting"
          @click="feedStore.collectAllPending()"
        >
          <template v-if="feedStore.anyCollecting">
            <RefreshCw class="w-3 h-3 animate-spin" /> 收集中…
          </template>
          <template v-else-if="feedStore.autoPending > 0">
            <Zap class="w-3 h-3" /> 收集待入库 ({{ feedStore.autoPending }})
          </template>
          <template v-else>
            <Check class="w-3 h-3" /> 全部已入库
          </template>
        </button>

        <!-- 每个 feed 的状态 -->
        <div class="space-y-1 max-h-[180px] overflow-y-auto no-scrollbar">
          <div
            v-for="f in feedStore.autoCollectFeeds"
            :key="f.id"
            class="flex items-center gap-1.5 px-1 py-0.5 rounded text-[11px]"
          >
            <span class="truncate flex-1 text-zinc-600">{{ f.title }}</span>
            <template v-if="feedStore.collectStatusOf(f.id).phase === 'collecting'">
              <RefreshCw class="w-2.5 h-2.5 animate-spin text-brand shrink-0" />
            </template>
            <template v-else-if="feedStore.collectStatusOf(f.id).phase === 'done'">
              <Check class="w-2.5 h-2.5 text-emerald-500 shrink-0" />
            </template>
            <template v-else-if="feedStore.collectStatusOf(f.id).phase === 'error'">
              <X class="w-2.5 h-2.5 text-red-400 shrink-0" />
            </template>
            <template v-else>
              <span class="shrink-0 flex items-center gap-1">
                <span v-if="feedStore.feedItemStats[f.id]?.pending > 0" class="text-amber-500 font-medium">{{ feedStore.feedItemStats[f.id].pending }}</span>
                <span v-if="feedStore.feedItemStats[f.id]?.collected > 0" class="text-zinc-300">/{{ feedStore.feedItemStats[f.id].collected }}</span>
              </span>
            </template>
          </div>
          <div v-if="!feedStore.autoCollectFeeds.length" class="text-center text-[11px] text-zinc-400 py-2">
            暂未开启自动入库
          </div>
        </div>

        <!-- 最近收集逐条结果 -->
        <div v-if="feedStore.lastCollectDetails" class="mt-2 pt-2 border-t border-zinc-100">
          <div class="flex items-center justify-between mb-1">
            <span class="text-[10px] text-zinc-400 font-medium">最近收集结果</span>
            <span class="text-[10px] text-zinc-300">{{ feedStore.lastCollectDetails.collected }}/{{ feedStore.lastCollectDetails.total }}</span>
          </div>
          <div class="space-y-0.5 max-h-[120px] overflow-y-auto no-scrollbar">
            <div
              v-for="item in feedStore.lastCollectDetails.items"
              :key="item.itemId"
              class="flex items-start gap-1 px-1 py-1 text-[10px] leading-tight rounded transition-colors"
              :class="[
                !item.ok ? 'bg-red-50/50' : '',
                item.link ? 'cursor-pointer hover:bg-zinc-100' : '',
              ]"
              @click="item.link && onOpenOriginal(item.link)"
            >
              <Check v-if="item.ok" class="w-2.5 h-2.5 text-emerald-400 shrink-0 mt-px" />
              <X v-else class="w-2.5 h-2.5 text-red-400 shrink-0 mt-px" />
              <span class="flex-1 min-w-0">
                <span class="text-zinc-700 truncate block font-medium">{{ item.title }}</span>
                <span class="flex items-center gap-1 mt-0.5">
                  <span class="px-1 rounded bg-zinc-100 text-zinc-500 shrink-0 max-w-[80px] truncate">{{ item.feedTitle }}</span>
                  <span v-if="!item.ok && item.reason" class="text-red-400 truncate">{{ item.reason }}</span>
                  <span v-else-if="item.ok && item.wordCount" class="text-zinc-300">{{ item.wordCount }} 词</span>
                </span>
              </span>
              <ExternalLink v-if="item.link" class="w-2.5 h-2.5 text-zinc-300 shrink-0 mt-px" />
            </div>
          </div>
        </div>

        <!-- AI 分析状态区块 -->
        <div class="mt-2 pt-2 border-t border-zinc-100">
          <div class="flex items-center justify-between mb-1">
            <span class="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
              <Bot class="w-3 h-3" />
              AI 分析
            </span>
            <span class="text-[10px] text-zinc-300">
              <template v-if="feedStore.aiSummary.total === 0">无</template>
              <template v-else>
                <span v-if="feedStore.aiSummary.pending" class="text-amber-500">{{ feedStore.aiSummary.pending }} 等</span>
                <span v-if="feedStore.aiSummary.processing" class="text-brand">{{ feedStore.aiSummary.processing }} 析</span>
                <span v-if="feedStore.aiSummary.success" class="text-emerald-500">{{ feedStore.aiSummary.success }} 成</span>
                <span v-if="feedStore.aiSummary.failed" class="text-red-400">{{ feedStore.aiSummary.failed }} 败</span>
              </template>
            </span>
          </div>
          <!-- 正在处理 spin -->
          <div v-if="feedStore.aiAnyProcessing" class="flex items-center gap-1 text-[10px] text-brand py-0.5">
            <RefreshCw class="w-2.5 h-2.5 animate-spin" />
            正在分析…
          </div>
          <!-- 失败项 + 重试 -->
          <div v-if="feedStore.aiSummary.failed" class="space-y-0.5 mt-0.5">
            <div
              v-for="(job, docId) in feedStore.aiJobMap"
              :key="docId"
              v-show="job.status === 'failed'"
              class="flex items-center gap-1 px-1 text-[10px] leading-tight"
              :title="job.error"
            >
              <X class="w-2.5 h-2.5 text-red-400 shrink-0" />
              <span class="flex-1 min-w-0 text-zinc-500 truncate">{{ job.documentTitle || docId }}</span>
              <button
                class="p-0.5 rounded text-brand hover:bg-zinc-100 shrink-0"
                title="重试"
                @click="feedStore.retryAiJob(job.id)"
              >
                <RotateCcw class="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto px-1.5 pb-2 no-scrollbar">
        <button
          class="w-full text-left px-2 py-1.5 rounded-md text-[12px] flex items-center justify-between transition-colors"
          :class="feedStore.selectedFeedId === null ? 'bg-brand/10 text-brand font-medium' : 'text-zinc-600 hover:bg-zinc-100'"
          @click="onSelectFeed(null)"
        >
          <span>全部</span>
          <span v-if="feedStore.totalUnread" class="text-[10px] font-semibold bg-brand text-white rounded-full px-1.5 leading-4">{{ feedStore.totalUnread }}</span>
        </button>

        <div v-for="g in feedStore.folders" :key="g.folder" class="mt-1">
          <button
            class="w-full flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-zinc-500 hover:bg-zinc-100 transition-colors"
            @click="toggleFolder(g.folder)"
          >
            <ChevronDown v-if="!collapsed.has(g.folder)" class="w-3 h-3 shrink-0" />
            <ChevronRight v-else class="w-3 h-3 shrink-0" />
            <span class="truncate flex-1 text-left font-medium">{{ g.folder }}</span>
            <span v-if="g.unread" class="text-[10px] text-zinc-400">{{ g.unread }}</span>
          </button>
          <template v-for="f in g.list" :key="f.id">
            <div
              v-if="editingFolderFeedId === f.id"
              v-show="!collapsed.has(g.folder)"
              class="flex items-center gap-1 pl-7 pr-1 py-1.5"
            >
              <UInput
                v-model="folderDraft"
                list="feed-folders"
                placeholder="分组名（留空=未分组）"
                class="flex-1 min-w-0 h-7 text-[12px] rounded-md border border-zinc-200 px-2 bg-white"
                @keydown.enter.prevent="commitMoveFolder(f)"
                @keydown.esc="cancelMoveFolder"
              />
              <button class="p-0.5 rounded text-brand hover:bg-zinc-100 shrink-0" title="确定" @click="commitMoveFolder(f)">
                <Check class="w-3 h-3" />
              </button>
              <button class="p-0.5 rounded text-zinc-400 hover:bg-zinc-100 shrink-0" title="取消" @click="cancelMoveFolder">
                <X class="w-3 h-3" />
              </button>
            </div>
            <button
              v-else
              v-show="!collapsed.has(g.folder)"
              class="w-full text-left pr-2 py-1.5 rounded-md text-[12px] flex items-center gap-1.5 transition-colors"
              :class="feedStore.selectedFeedId === f.id ? 'bg-brand/10 text-brand font-medium' : 'text-zinc-600 hover:bg-zinc-100'"
              :title="f.title"
              @click="onSelectFeed(f.id)"
            >
              <Globe class="w-3 h-3 shrink-0 opacity-60" />
              <span class="truncate flex-1">{{ f.title }}</span>
              <!-- auto-collect status badge -->
              <template v-if="f.autoCollect">
                <span v-if="feedStore.collectStatusOf(f.id).phase === 'collecting'"
                  class="text-[9px] font-semibold text-brand shrink-0 flex items-center gap-0.5" title="正在收集…">
                  <RefreshCw class="w-2.5 h-2.5 animate-spin" />auto
                </span>
                <span v-else-if="feedStore.collectStatusOf(f.id).phase === 'done'"
                  class="text-[9px] font-semibold text-emerald-500 shrink-0" title="收集完成">
                  ✓auto
                </span>
                <span v-else-if="feedStore.collectStatusOf(f.id).phase === 'error'"
                  class="text-[9px] font-semibold text-red-400 shrink-0" title="收集失败">
                  ⚠auto
                </span>
                <span v-else
                  class="text-[9px] font-semibold text-brand shrink-0" title="自动入库">auto</span>
              </template>
              <span v-if="feedStore.unreadOf(f.id)" class="text-[10px] font-semibold text-brand shrink-0">{{ feedStore.unreadOf(f.id) }}</span>
              <DropdownMenuRoot>
                <DropdownMenuTrigger as-child>
                  <button
                    class="p-0.5 rounded shrink-0 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                    title="更多操作"
                    @click.stop
                  >
                    <Ellipsis class="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuContent
                    class="min-w-[148px] bg-white border border-zinc-200 rounded-lg shadow-lg py-1 z-50"
                    align="end"
                    :side-offset="4"
                  >
                    <DropdownMenuItem
                      class="flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-zinc-700 outline-none cursor-pointer data-[highlighted]:bg-zinc-100"
                      @select="feedStore.setAutoCollect(f.id, !f.autoCollect)"
                    >
                      <Zap class="w-3 h-3" :class="f.autoCollect ? 'text-brand' : 'text-zinc-400'" />
                      {{ f.autoCollect ? '关闭自动入库' : '开启自动入库' }}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      class="flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-zinc-700 outline-none cursor-pointer data-[highlighted]:bg-zinc-100"
                      @select="startMoveFolder(f)"
                    >
                      <FolderInput class="w-3 h-3 text-zinc-400" />
                      移动到分组…
                    </DropdownMenuItem>
                    <DropdownMenuSeparator class="h-px bg-zinc-100 my-1" />
                    <DropdownMenuItem
                      class="flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-red-500 outline-none cursor-pointer data-[highlighted]:bg-red-50"
                      @select="feedStore.unsubscribe(f.id)"
                    >
                      <Trash2 class="w-3 h-3" />
                      取消订阅
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenuPortal>
              </DropdownMenuRoot>
            </button>
          </template>
        </div>

        <div v-if="!feedStore.feeds.length" class="text-center text-[11px] text-zinc-400 py-4">
          暂无订阅
        </div>

        <datalist id="feed-folders">
          <option v-for="name in knownFolders" :key="name" :value="name" />
        </datalist>
      </div>
    </aside>

    <!-- Items timeline -->
    <section
      class="w-[230px] shrink-0 border-r border-zinc-100 overflow-y-auto no-scrollbar"
      :class="compact ? (showFeeds || showReader ? 'hidden' : 'w-full flex-1 border-r-0') : ''"
    >
      <button
        v-for="it in feedStore.items"
        :key="it.id"
        class="w-full text-left p-2.5 border-b border-zinc-100 hover:bg-white transition-colors"
        :class="selectedItemId === it.id ? 'bg-white' : ''"
        @click="onOpenItem(it.id)"
      >
        <div class="flex items-center gap-1.5">
          <span v-if="!it.readAt" class="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
          <span v-else-if="it.documentId" class="w-1.5 h-1.5 shrink-0" />
          <span class="text-[12px] font-medium text-zinc-800 line-clamp-2 flex-1" :class="{ 'text-zinc-500': it.readAt }">{{ it.title }}</span>
          <Check v-if="it.documentId" class="w-3 h-3 text-emerald-400 shrink-0" title="已入库" />
          <!-- AI analysis status icon -->
          <template v-if="it.documentId">
            <RefreshCw v-if="feedStore.aiJobOf(it.documentId)?.status === 'processing'"
              class="w-2.5 h-2.5 text-brand shrink-0 animate-spin" title="AI 分析中" />
            <Bot v-else-if="feedStore.aiJobOf(it.documentId)?.status === 'pending'"
              class="w-2.5 h-2.5 text-amber-400 shrink-0" title="AI 等待分析" />
            <MessageSquare v-else-if="feedStore.aiJobOf(it.documentId)?.status === 'success'"
              class="w-2.5 h-2.5 text-brand shrink-0" title="AI 分析完成" />
            <X v-else-if="feedStore.aiJobOf(it.documentId)?.status === 'failed'"
              class="w-2.5 h-2.5 text-red-400 shrink-0" title="AI 分析失败" />
          </template>
        </div>
        <div class="text-[10px] text-zinc-400 mt-1 flex items-center gap-1.5">
          <span class="truncate">{{ feedStore.feeds.find(f => f.id === it.feedId)?.title }}</span>
          <span v-if="it.publishedAt">· {{ displayDate(it.publishedAt) }}</span>
        </div>
      </button>
      <div v-if="!feedStore.items.length" class="text-center text-[12px] text-zinc-400 py-8">
        {{ feedStore.feeds.length ? '选中订阅源后刷新' : '先添加订阅源' }}
      </div>
    </section>

    <!-- Reader -->
    <div
      class="flex-1 min-w-0 min-h-0 flex flex-col relative"
      :class="compact && !showReader ? 'hidden' : ''"
    >
    <section
      ref="readerScrollRef"
      class="flex-1 min-h-0 overflow-y-auto"
      @scroll.passive="onReaderScroll"
    >
      <article v-if="selectedItem" class="p-5 mx-auto">
        <!-- AI 分析结果（文章上方） -->
        <div v-if="selectedItem?.documentId" class="mb-4 rounded-lg border border-zinc-200 overflow-hidden">
          <div class="flex items-center justify-between px-3 py-2 bg-zinc-50 border-b border-zinc-100">
            <span class="text-[13px] font-medium text-zinc-700 flex items-center gap-1.5">
              <Bot class="w-4 h-4 text-brand" />
              AI 分析
            </span>
            <!-- status badge -->
            <span v-if="feedStore.aiJobOf(selectedItem.documentId)?.status === 'processing'"
              class="text-[10px] px-2 py-0.5 rounded-full bg-brand/10 text-brand flex items-center gap-1">
              <RefreshCw class="w-2.5 h-2.5 animate-spin" />
              {{ feedStore.aiJobOf(selectedItem.documentId)?.error ? '重试中…' : '分析中…' }}
            </span>
            <span v-else-if="feedStore.aiJobOf(selectedItem.documentId)?.status === 'pending'"
              class="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-500">等待分析</span>
            <span v-else-if="feedStore.aiJobOf(selectedItem.documentId)?.status === 'failed'"
              class="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-500 flex items-center gap-1">
              失败
              <button class="p-0.5 rounded hover:bg-red-100" title="重试" @click="feedStore.retryAiJob(feedStore.aiJobOf(selectedItem.documentId)!.id)">
                <RotateCcw class="w-2.5 h-2.5" />
              </button>
            </span>
            <button
              v-else-if="feedStore.aiConvOf(selectedItem.documentId)"
              class="text-[10px] text-brand hover:underline"
              @click="goToLibrary(selectedItem.documentId!)"
            >
              查看完整对话 →
            </button>
          </div>

          <!-- processing -->
          <div v-if="feedStore.aiJobOf(selectedItem.documentId)?.status === 'processing'"
            class="px-3 py-2 text-[12px] text-zinc-400 italic">
            {{ feedStore.aiJobOf(selectedItem.documentId)?.error || '正在分析，请稍候…' }}
          </div>
          <!-- pending -->
          <div v-else-if="feedStore.aiJobOf(selectedItem.documentId)?.status === 'pending'"
            class="px-3 py-2 text-[12px] text-zinc-400 italic">
            已排队，等待处理…
          </div>
          <!-- failed error -->
          <div v-else-if="feedStore.aiJobOf(selectedItem.documentId)?.status === 'failed'"
            class="px-3 py-2 text-[12px] text-red-400">
            {{ feedStore.aiJobOf(selectedItem.documentId)?.error || '分析失败' }}
          </div>
          <!-- success: preview assistant reply -->
          <div v-else-if="feedStore.aiJobOf(selectedItem.documentId)?.status === 'success' && feedStore.aiConvOf(selectedItem.documentId)"
            class="px-3 py-2.5 text-[13px] text-zinc-700 leading-relaxed max-h-[280px] overflow-y-auto no-scrollbar md-render">
            <template v-for="msg in feedStore.aiConvOf(selectedItem.documentId)?.messages" :key="msg.id">
              <div v-if="msg.role === 'assistant'" v-html="renderMarkdown(msg.content)"></div>
            </template>
          </div>
          <!-- has conversation but no successful AI job (e.g. manual chat) -->
          <div v-else-if="feedStore.aiConvOf(selectedItem.documentId)"
            class="px-3 py-2.5 text-[13px] text-zinc-700 leading-relaxed max-h-[280px] overflow-y-auto no-scrollbar md-render">
            <template v-for="msg in feedStore.aiConvOf(selectedItem.documentId)?.messages" :key="msg.id">
              <div v-if="msg.role === 'assistant'" v-html="renderMarkdown(msg.content)"></div>
            </template>
          </div>
          <!-- no job -->
          <div v-else class="px-3 py-2 text-[11px] text-zinc-400 italic">
            未触发 AI 分析（检查设置 → 自动 AI 分析是否开启）
          </div>
        </div>

        <!-- 标题 + 元信息 -->
        <h1 class="text-[18px] font-bold text-zinc-900 leading-snug">{{ selectedItem.title }}</h1>
        <div class="text-[11px] text-zinc-400 mt-1.5 flex items-center gap-2">
          <span v-if="selectedItem.author">{{ selectedItem.author }}</span>
          <span v-if="selectedItem.publishedAt">· {{ displayDate(selectedItem.publishedAt) }}</span>
        </div>

        <!-- 操作按钮 -->
        <div class="flex items-center gap-2 mt-3 mb-4">
          <!-- 未收藏：收藏按钮 -->
          <UButton
            v-if="!selectedItem.documentId"
            variant="primary"
            size="sm"
            :disabled="collecting"
            @click="onCollect"
          >
            <Plus class="w-3 h-3" />
            {{ collecting ? '收藏中…' : '收藏到记忆库' }}
          </UButton>
          <!-- 已收藏：跳转记忆库 + 取消收藏 -->
          <template v-else>
            <UButton variant="ghost" size="sm" @click="goToLibrary(selectedItem.documentId!)">
              <BookOpen class="w-3 h-3" />在工作区中查看
            </UButton>
            <UButton
              variant="ghost"
              size="sm"
              :disabled="uncollecting"
              class="text-red-500 hover:text-red-600"
              @click="onUncollect"
            >
              <Trash2 class="w-3 h-3" />
              {{ uncollecting ? '移除中…' : '取消收藏' }}
            </UButton>
          </template>
          <UButton variant="ghost" size="sm" @click="onOpenOriginal(selectedItem.link)">
            <ExternalLink class="w-3 h-3" />原文
          </UButton>
        </div>

        <div ref="readerRef" class="md-render" v-html="safeContent" />
      </article>
      <div v-else class="h-full flex items-center justify-center text-[13px] text-zinc-400">
        选择左侧条目阅读
      </div>
    </section>
    <ScrollFab :visible="showBackToTop">
      <button
        class="flex items-center justify-center w-9 h-9 rounded-full bg-white border border-zinc-200 shadow-md text-zinc-600 hover:text-brand hover:border-brand/40 transition-colors"
        title="返回顶部"
        @click="backToTop"
      >
        <ArrowUp class="w-4 h-4" />
      </button>
    </ScrollFab>
    </div>
    </div>
  </div>
</template>
