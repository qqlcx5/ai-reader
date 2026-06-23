<script lang="ts" setup>
/**
 * M6 — HistoryList
 * 虚拟滚动历史列表：使用 RecycleScroller，itemSize=64px
 * 数据源：Conversations 主表（仅元数据，严禁查询副表）
 * DOM 节点数始终 ≤ 20（RecycleScroller 保证）
 */
import { ref, computed, onMounted, watch } from 'vue'
import { RecycleScroller } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import type { ConversationRecord } from '@/lib/db/types'
import { conversationRepo } from '@/lib/db/repositories/conversation.repo'
import HistoryItem from './HistoryItem.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

type SortMode = 'updatedAt' | 'domain'

const props = defineProps<{
  compact?: boolean
  /** 外部传入的域名过滤（来自域名导航） */
  filterDomain?: string
  /** 外部传入的搜索查询（由父组件触发 Worker 检索后传入 ID 列表） */
  filterIds?: string[]
}>()

const emit = defineEmits<{
  (e: 'select', item: ConversationRecord): void
  (e: 'delete', item: ConversationRecord): void
  (e: 'query', q: string): void
}>()

const items = ref<ConversationRecord[]>([])
const loading = ref(false)
const sortMode = ref<SortMode>('updatedAt')
const searchQuery = ref('')
const selectedId = ref<string | null>(null)
const PAGE_SIZE = 200

// Context menu state
const contextItem = ref<ConversationRecord | null>(null)
const contextPos = ref({ x: 0, y: 0 })
const showContext = ref(false)

// Delete confirm modal
const showDeleteModal = ref(false)
const deleteTarget = ref<ConversationRecord | null>(null)

async function loadItems() {
  loading.value = true
  try {
    if (props.filterDomain) {
      items.value = await conversationRepo.listByDomain(props.filterDomain)
    } else {
      items.value = await conversationRepo.list({
        sortBy: sortMode.value,
        limit: PAGE_SIZE,
        offset: 0,
      })
    }
  } finally {
    loading.value = false
  }
}

onMounted(loadItems)
watch(sortMode, loadItems)
watch(() => props.filterDomain, loadItems)

// Filter by external ID list (search results)
const displayedItems = computed<ConversationRecord[]>(() => {
  if (props.filterIds && props.filterIds.length > 0) {
    const idSet = new Set(props.filterIds)
    return items.value.filter((i) => idSet.has(i.id))
  }
  return items.value
})

function onItemClick(item: ConversationRecord) {
  selectedId.value = item.id
  emit('select', item)
}

function onContextMenu(payload: { item: ConversationRecord; event: MouseEvent }) {
  contextItem.value = payload.item
  contextPos.value = { x: payload.event.clientX, y: payload.event.clientY }
  showContext.value = true
}

function onLongPress(item: ConversationRecord) {
  deleteTarget.value = item
  showDeleteModal.value = true
}

function closeContext() {
  showContext.value = false
  contextItem.value = null
}

function requestDelete(item: ConversationRecord) {
  deleteTarget.value = item
  showDeleteModal.value = true
  closeContext()
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  await conversationRepo.delete(deleteTarget.value.id)
  items.value = items.value.filter((i) => i.id !== deleteTarget.value!.id)
  showDeleteModal.value = false
  deleteTarget.value = null
}

function onSearch(e: Event) {
  const q = (e.target as HTMLInputElement).value.trim()
  searchQuery.value = q
  emit('query', q)
}

// Reload when items are externally modified
defineExpose({ reload: loadItems })
</script>

<template>
  <div class="history-list">
    <!-- Toolbar: search + sort toggle -->
    <div class="history-list__toolbar">
      <div class="history-list__search-wrap">
        <span class="history-list__search-icon" aria-hidden="true">🔍</span>
        <input
          type="search"
          class="history-list__search"
          placeholder="搜索历史..."
          :value="searchQuery"
          @input="onSearch"
          aria-label="搜索历史记录"
        />
      </div>
      <div class="history-list__sort">
        <button
          class="history-list__sort-btn"
          :class="{ 'history-list__sort-btn--active': sortMode === 'updatedAt' }"
          @click="sortMode = 'updatedAt'"
        >
          时间
        </button>
        <button
          class="history-list__sort-btn"
          :class="{ 'history-list__sort-btn--active': sortMode === 'domain' }"
          @click="sortMode = 'domain'"
        >
          域名
        </button>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="history-list__skeletons">
      <div v-for="i in 5" :key="i" class="history-list__skeleton" aria-hidden="true" />
    </div>

    <!-- Virtual scroller (DOM 节点始终 ≤ 20) -->
    <RecycleScroller
      v-else-if="displayedItems.length > 0"
      class="history-list__scroller"
      :items="displayedItems"
      :item-size="compact ? 52 : 64"
      key-field="id"
      v-slot="{ item }"
    >
      <HistoryItem
        :item="item"
        :selected="selectedId === item.id"
        :compact="compact"
        @click="onItemClick"
        @contextmenu="onContextMenu"
        @long-press="onLongPress"
      />
    </RecycleScroller>

    <!-- Empty state -->
    <EmptyState
      v-else
      icon="📂"
      title="暂无历史记录"
      description="与 AI 对话后，记录将显示在此处"
      size="sm"
    />

    <!-- Context menu -->
    <Teleport to="body">
      <div
        v-if="showContext"
        class="ctx-menu"
        :style="{ left: contextPos.x + 'px', top: contextPos.y + 'px' }"
        role="menu"
        @click.stop
      >
        <button
          class="ctx-menu__item"
          role="menuitem"
          @click="contextItem && onItemClick(contextItem); closeContext()"
        >
          查看详情
        </button>
        <button
          class="ctx-menu__item ctx-menu__item--danger"
          role="menuitem"
          @click="contextItem && requestDelete(contextItem)"
        >
          删除记录
        </button>
      </div>
      <!-- Backdrop to close context menu -->
      <div v-if="showContext" class="ctx-menu__backdrop" @click="closeContext" />
    </Teleport>

    <!-- Delete confirm modal -->
    <Teleport to="body">
      <div v-if="showDeleteModal" class="delete-modal-overlay" @click.self="showDeleteModal = false">
        <div class="delete-modal">
          <div class="delete-modal__title">确认删除</div>
          <div class="delete-modal__body">
            确定要删除「{{ deleteTarget?.title || deleteTarget?.url }}」的历史记录吗？
            <br /><span class="delete-modal__hint">此操作将同时删除文章快照、对话历史与高亮选区，不可恢复。</span>
          </div>
          <div class="delete-modal__footer">
            <button class="delete-modal__btn" @click="showDeleteModal = false">取消</button>
            <button class="delete-modal__btn delete-modal__btn--danger" @click="confirmDelete">删除</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.history-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* Toolbar */
.history-list__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border, #e6e2d8);
  flex-shrink: 0;
}

.history-list__search-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg, #f4f2ec);
  border: 1px solid var(--border, #e6e2d8);
  border-radius: var(--radius-md, 8px);
  padding: 5px 8px;
}

.history-list__search-icon {
  font-size: 11px;
  flex-shrink: 0;
  opacity: 0.6;
}

.history-list__search {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 12px;
  color: var(--text, #2e2d2a);
  min-width: 0;
}

.history-list__search::placeholder {
  color: var(--muted, #7a7568);
}

.history-list__sort {
  display: flex;
  border: 1px solid var(--border, #e6e2d8);
  border-radius: var(--radius-md, 8px);
  overflow: hidden;
  flex-shrink: 0;
}

.history-list__sort-btn {
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--muted, #7a7568);
  background: var(--panel, #fff);
  border: none;
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
}

.history-list__sort-btn + .history-list__sort-btn {
  border-left: 1px solid var(--border, #e6e2d8);
}

.history-list__sort-btn--active {
  background: var(--primary-soft, #eef0ff);
  color: var(--primary, #5b60e5);
}

/* Skeletons */
.history-list__skeletons {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 4px 6px;
}

.history-list__skeleton {
  height: 60px;
  border-radius: var(--radius-md, 8px);
  background: linear-gradient(90deg, var(--card, #faf9f5) 25%, var(--border, #e6e2d8) 50%, var(--card, #faf9f5) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  margin-bottom: 4px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Virtual scroller */
.history-list__scroller {
  flex: 1;
  overflow-y: auto;
  padding: 4px 6px;
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar, #dedad0) transparent;
}

.history-list__scroller::-webkit-scrollbar {
  width: 4px;
}

.history-list__scroller::-webkit-scrollbar-thumb {
  background: var(--scrollbar, #dedad0);
  border-radius: 2px;
}

/* Context menu */
.ctx-menu {
  position: fixed;
  z-index: 9000;
  background: var(--panel, #fff);
  border: 1px solid var(--border, #e6e2d8);
  border-radius: var(--radius-md, 8px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  min-width: 140px;
}

.ctx-menu__item {
  display: block;
  width: 100%;
  padding: 9px 14px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text, #2e2d2a);
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;
}

.ctx-menu__item:hover {
  background: var(--card, #faf9f5);
}

.ctx-menu__item--danger {
  color: var(--red, #e53e3e);
}

.ctx-menu__item--danger:hover {
  background: #fff5f5;
}

.ctx-menu__backdrop {
  position: fixed;
  inset: 0;
  z-index: 8999;
}

/* Delete modal */
.delete-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(4px);
}

.delete-modal {
  width: 360px;
  background: var(--panel, #fff);
  border: 1px solid var(--border, #e6e2d8);
  border-radius: var(--radius-xl, 14px);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.delete-modal__title {
  padding: 14px 18px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text, #2e2d2a);
  background: var(--card, #faf9f5);
  border-bottom: 1px solid var(--border, #e6e2d8);
}

.delete-modal__body {
  padding: 18px;
  font-size: 12px;
  color: var(--text, #2e2d2a);
  line-height: 1.6;
}

.delete-modal__hint {
  font-size: 11px;
  color: var(--muted, #7a7568);
}

.delete-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--border, #e6e2d8);
  background: var(--bg, #f4f2ec);
}

.delete-modal__btn {
  padding: 7px 16px;
  font-size: 12px;
  font-weight: 700;
  border-radius: var(--radius-lg, 10px);
  border: 1.5px solid var(--border, #e6e2d8);
  background: var(--panel, #fff);
  color: var(--text, #2e2d2a);
  cursor: pointer;
  transition: background 0.12s;
}

.delete-modal__btn--danger {
  background: var(--red, #e53e3e);
  color: #fff;
  border-color: var(--red, #e53e3e);
}

.delete-modal__btn--danger:hover {
  background: #c53030;
}
</style>
