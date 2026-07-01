<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Plus, RefreshCw, Trash2, ExternalLink, Globe, Upload, Download, ChevronLeft, ChevronDown, ChevronRight, Zap, FolderInput, Check, X } from '@lucide/vue'
import UButton from '@/components/ui/UButton.vue'
import UInput from '@/components/ui/UInput.vue'
import { useFeedStore } from '@/stores/feed.store'
import { useAppStore } from '@/stores/app.store'
import { exportOpml, parseOpml } from '@/utils/feed/opml'
import { sanitizeHtml, enhanceCodeBlocks } from '@/utils/markdown'
import type { FeedEntity } from '@/types/feed'

const feedStore = useFeedStore()
const appStore = useAppStore()

const newUrl = ref('')
const newFolder = ref('')
const selectedItemId = ref<string | null>(null)
const collecting = ref(false)
const opmlInput = ref<HTMLInputElement | null>(null)
const collapsed = ref<Set<string>>(new Set())

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

// Same code-block UX (highlight + copy button) as the library reader.
watch(safeContent, async () => {
  await nextTick()
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
    appStore.showToast('已订阅', 'success')
  } catch {
    appStore.showToast('订阅失败', 'error')
  }
}

async function onOpenItem(itemId: string) {
  selectedItemId.value = itemId
  await feedStore.markRead(itemId)
}

function onSelectFeed(id: string | null) {
  feedStore.selectFeed(id)
  showFeeds.value = false
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
  appStore.showToast(name ? `已移动到「${name}」` : '已移出分组', 'success')
}

async function onOpenOriginal(url: string) {
  if (!url) return
  const tabs = (globalThis as any).browser?.tabs
  if (tabs) await tabs.create({ url })
}

async function onCollect() {
  if (!selectedItem.value || collecting.value) return
  if (selectedItem.value.documentId) {
    appStore.showToast('已在记忆库中', 'info')
    return
  }
  collecting.value = true
  try {
    await feedStore.collect(selectedItem.value.id)
    appStore.showToast('已收藏到记忆库', 'success')
  } catch (e) {
    const msg = e instanceof Error ? e.message : '收藏失败'
    appStore.showToast(msg, 'error')
  } finally {
    collecting.value = false
  }
}

// Background alarm (browser.alarms) broadcasts REFRESH_FEEDS; the actual parse
// runs here (panel has DOMParser, the MV3 service worker doesn't).
function onBackgroundMessage(message: any) {
  if (message?.type === 'REFRESH_FEEDS') feedStore.refresh()
}
let removeMsgListener: (() => void) | null = null
function onExportOpml() {
  if (!feedStore.feeds.length) {
    appStore.showToast('暂无订阅源', 'info')
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
      appStore.showToast('OPML 中没有订阅源', 'error')
      return
    }
    for (const s of subs) {
      await feedStore.subscribe(s.xmlUrl, s.folder)
    }
    appStore.showToast(`已导入 ${subs.length} 个订阅源`, 'success')
  } catch {
    appStore.showToast('OPML 解析失败', 'error')
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
  if (isStale()) await feedStore.refresh()
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

onUnmounted(() => {
  removeMsgListener?.()
  ro?.disconnect()
})
</script>

<template>
  <div ref="rootRef" class="flex-1 min-h-0 flex flex-col bg-[#FCFCFC]">
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
          :class="showFeeds ? 'text-brand bg-indigo-50' : 'text-zinc-500 hover:bg-zinc-100'"
          @click="showFeeds = !showFeeds"
        >
          <Globe class="w-3.5 h-3.5" /> 源
        </button>
        <span class="text-[12px] truncate flex-1 text-zinc-700 font-medium">{{ showFeeds ? '订阅源' : currentFeedTitle }}</span>
        <button
          class="p-1 rounded text-zinc-400 hover:text-brand hover:bg-zinc-100 transition-colors"
          :disabled="feedStore.refreshing"
          title="全部刷新"
          @click="feedStore.refresh()"
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
        <span class="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">订阅源</span>
        <button
          class="p-1 rounded text-zinc-400 hover:text-brand hover:bg-zinc-100 transition-colors"
          title="全部刷新"
          :disabled="feedStore.refreshing"
          @click="feedStore.refresh()"
        >
          <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': feedStore.refreshing }" />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto px-1.5 pb-2 no-scrollbar">
        <button
          class="w-full text-left px-2 py-1.5 rounded-md text-[12px] flex items-center justify-between transition-colors"
          :class="feedStore.selectedFeedId === null ? 'bg-indigo-50 text-brand font-medium' : 'text-zinc-600 hover:bg-zinc-100'"
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
              class="w-full text-left pr-2 py-1.5 rounded-md text-[12px] flex items-center gap-1.5 transition-colors group"
              :class="feedStore.selectedFeedId === f.id ? 'bg-indigo-50 text-brand font-medium' : 'text-zinc-600 hover:bg-zinc-100'"
              :title="f.title"
              @click="onSelectFeed(f.id)"
            >
              <Globe class="w-3 h-3 shrink-0 opacity-60" />
              <span class="truncate flex-1">{{ f.title }}</span>
              <span v-if="f.autoCollect" class="text-[9px] font-semibold text-brand shrink-0" title="自动入库">auto</span>
              <span v-if="feedStore.unreadOf(f.id)" class="text-[10px] font-semibold text-brand shrink-0">{{ feedStore.unreadOf(f.id) }}</span>
              <button
                class="p-0.5 rounded shrink-0 transition-colors"
                :class="f.autoCollect ? 'text-brand' : 'text-zinc-300 hover:text-zinc-500'"
                :title="f.autoCollect ? '自动入库：开（点击关闭）' : '自动入库：关（新条目自动入记忆库）'"
                @click.stop="feedStore.setAutoCollect(f.id, !f.autoCollect)"
              >
                <Zap class="w-3 h-3" />
              </button>
              <FolderInput
                class="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-brand"
                title="移动到分组"
                @click.stop="startMoveFolder(f)"
              />
              <Trash2
                class="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500"
                @click.stop="feedStore.unsubscribe(f.id)"
              />
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
          <span class="text-[12px] font-medium text-zinc-800 line-clamp-2 flex-1" :class="{ 'text-zinc-500': it.readAt }">{{ it.title }}</span>
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
    <section
      class="flex-1 min-w-0 overflow-y-auto"
      :class="compact && !showReader ? 'hidden' : ''"
    >
      <article v-if="selectedItem" class="p-5 mx-auto">
        <h1 class="text-[18px] font-bold text-zinc-900 leading-snug">{{ selectedItem.title }}</h1>
        <div class="text-[11px] text-zinc-400 mt-1.5 flex items-center gap-2">
          <span v-if="selectedItem.author">{{ selectedItem.author }}</span>
          <span v-if="selectedItem.publishedAt">· {{ displayDate(selectedItem.publishedAt) }}</span>
        </div>

        <div class="flex items-center gap-2 mt-3 mb-4">
          <UButton
            variant="primary"
            size="sm"
            :disabled="collecting || !!selectedItem.documentId"
            @click="onCollect"
          >
            <Plus class="w-3 h-3" />
            {{ selectedItem.documentId ? '已收藏' : collecting ? '收藏中…' : '收藏到记忆库' }}
          </UButton>
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
    </div>
  </div>
</template>
