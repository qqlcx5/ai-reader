<script lang="ts">
export default { name: 'WatchView' }
</script>

<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { Radar, RefreshCw, Trash2, History, Bell } from '@lucide/vue'
import UButton from '@/components/ui/UButton.vue'
import UInput from '@/components/ui/UInput.vue'
import UEmptyState from '@/components/ui/UEmptyState.vue'
import { PageWatchRepository, type ExtractionResult } from '@/services/watch/watch'
import { useAppStore } from '@/stores/app.store'
import { formatRelative } from '@/utils/date'
import type { PageWatchEntity } from '@/types/page-watch'

/**
 * Page-change monitoring: add URLs to watch, check them on the feed-refresh
 * cycle, and review change history (previous excerpt vs current).
 */

const appStore = useAppStore()

const watches = ref<PageWatchEntity[]>([])
const newUrl = ref('')
const adding = ref(false)
const checking = ref(false)
const diffWatch = ref<PageWatchEntity | null>(null)

async function load() {
  watches.value = await PageWatchRepository.findAll()
}

/** Add a watch and run an immediate first check (baseline hash). */
async function addWatch() {
  const url = newUrl.value.trim()
  if (!url || adding.value) return
  if (!/^https?:\/\//.test(url)) {
    appStore.showToast('请输入 http(s) 开头的完整链接', 'error')
    return
  }
  if (watches.value.some((w) => w.url === url)) {
    appStore.showToast('这个页面已在监控中', 'info')
    return
  }
  adding.value = true
  try {
    const now = new Date().toISOString()
    let watch: PageWatchEntity = {
      id: crypto.randomUUID(), url, title: url, enabled: true,
      createdAt: now, updatedAt: now,
    }
    // Baseline check right away so the first change is detected next cycle.
    try {
      const res = await fetch(url, { redirect: 'follow' })
      if (res.ok) {
        const html = await res.text()
        const { sendToOffscreen } = await import('@/services/offscreen/manager')
        const data = await sendToOffscreen<any>({ type: 'EXTRACT_HTML', html, url, meta: {} })
        if (data?.ok) {
          const r: ExtractionResult = { contentHash: data.data.contentHash, markdown: data.data.markdown, title: data.data.title }
          watch = { ...watch, lastHash: r.contentHash, lastMarkdownExcerpt: r.markdown.slice(0, 2000), title: r.title || url, lastCheckedAt: now }
        }
      }
    } catch {
      // baseline is best-effort; the cycle will retry
    }
    await PageWatchRepository.save(watch)
    newUrl.value = ''
    await load()
    appStore.showToast('已加入监控', 'success')
  } finally {
    adding.value = false
  }
}

async function toggle(watch: PageWatchEntity) {
  await PageWatchRepository.save({ ...watch, enabled: !watch.enabled, updatedAt: new Date().toISOString() })
  await load()
}

async function remove(watch: PageWatchEntity) {
  await PageWatchRepository.delete(watch.id)
  await load()
}

async function checkAllNow() {
  checking.value = true
  try {
    const { checkAllWatches } = await import('@/services/watch/watch')
    const changed = await checkAllWatches()
    await load()
    appStore.showToast(
      changed.length > 0 ? `${changed.length} 个页面有更新` : '所有监控页面无变化',
      changed.length > 0 ? 'success' : 'info',
    )
  } catch (e: any) {
    appStore.showToast(e?.message || '检查失败', 'error')
  } finally {
    checking.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="flex-1 min-h-0 overflow-y-auto">
    <div class="max-w-xl mx-auto px-4 py-5 flex flex-col gap-3">
      <!-- Add bar -->
      <div class="flex items-center gap-2">
        <div class="flex-1 flex items-center gap-1.5 bg-white border border-zinc-200 rounded-lg px-2.5 py-2">
          <Radar class="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <input
            v-model="newUrl"
            placeholder="粘贴要监控的页面链接（价格页 / 发布页 / 文档页…）"
            class="flex-1 text-[12px] outline-none bg-transparent"
            @keydown.enter="addWatch"
          >
        </div>
        <UButton size="sm" variant="primary" :disabled="adding || !newUrl.trim()" @click="addWatch">
          {{ adding ? '抓取中…' : '监控' }}
        </UButton>
        <UButton size="sm" variant="ghost" :disabled="checking" title="立即检查全部" @click="checkAllNow">
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': checking }" />
        </UButton>
      </div>

      <!-- Watch list -->
      <div
        v-for="watch in watches"
        :key="watch.id"
        class="bg-white border rounded-xl p-3 flex flex-col gap-1.5"
        :class="watch.lastChangedAt && watch.lastChangedAt === watch.lastCheckedAt ? 'border-emerald-300 bg-emerald-50/40' : 'border-zinc-200'"
      >
        <div class="flex items-center gap-2">
          <div class="flex-1 min-w-0">
            <div class="text-[12.5px] text-zinc-800 truncate" :title="watch.url">{{ watch.title || watch.url }}</div>
            <div class="text-[10px] text-zinc-400 truncate">{{ watch.url }}</div>
          </div>
          <button
            class="p-1.5 rounded-md transition-colors"
            :class="watch.enabled ? 'text-brand hover:bg-brand/10' : 'text-zinc-300 hover:text-zinc-500'"
            :title="watch.enabled ? '暂停监控' : '恢复监控'"
            @click="toggle(watch)"
          >
            <Bell class="w-3.5 h-3.5" :class="{ 'opacity-40': !watch.enabled }" />
          </button>
          <button
            v-if="(watch.changes?.length ?? 0) > 0"
            class="p-1.5 rounded-md text-zinc-400 hover:text-brand hover:bg-brand/10 transition-colors"
            title="变更历史"
            @click="diffWatch = watch"
          >
            <History class="w-3.5 h-3.5" />
          </button>
          <button class="p-1.5 rounded-md text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="删除" @click="remove(watch)">
            <Trash2 class="w-3.5 h-3.5" />
          </button>
        </div>
        <div class="flex items-center gap-2 text-[10px] text-zinc-400">
          <span v-if="watch.lastError" class="text-red-400">上次出错：{{ watch.lastError }}</span>
          <template v-else>
            <span>检查于 {{ watch.lastCheckedAt ? formatRelative(watch.lastCheckedAt) : '从未' }}</span>
            <span v-if="watch.changes?.length">· 变更 {{ watch.changes.length }} 次</span>
            <span v-if="watch.lastChangedAt && watch.lastChangedAt === watch.lastCheckedAt" class="text-emerald-500">· 本次有更新</span>
          </template>
        </div>
      </div>

      <UEmptyState
        v-if="watches.length === 0"
        title="还没有监控页面"
        description="添加链接后随 RSS 周期自动巡检，内容变化（按正文哈希）会在这里标记并保留历史版本摘录。"
        dense
      />

      <!-- Change history dialog -->
      <div v-if="diffWatch" class="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" @click.self="diffWatch = null">
        <div class="w-[520px] max-w-full max-h-[80%] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-zinc-200 p-4 flex flex-col gap-3">
          <div class="text-[13px] font-semibold text-zinc-800">变更历史 · {{ diffWatch.title }}</div>
          <div v-for="(change, i) in diffWatch.changes" :key="change.at" class="border border-zinc-200 rounded-xl p-2.5 flex flex-col gap-1.5">
            <div class="text-[10px] text-zinc-400">第 {{ diffWatch.changes!.length - i }} 次 · {{ formatRelative(change.at) }}</div>
            <div v-if="change.summary" class="text-[12px] text-emerald-600 bg-emerald-50 rounded-lg p-2">✨ {{ change.summary }}</div>
            <div v-if="change.previousExcerpt" class="text-[11px] text-zinc-500 bg-zinc-50 rounded-lg p-2 whitespace-pre-wrap line-clamp-6">{{ change.previousExcerpt }}</div>
            <div class="text-[10px] text-zinc-400">↑ 变更前的版本摘录（当前版本在正文中查看）</div>
          </div>
          <UButton size="sm" variant="ghost" class="self-end" @click="diffWatch = null">关闭</UButton>
        </div>
      </div>
    </div>
  </div>
</template>
