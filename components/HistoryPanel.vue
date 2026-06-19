<script lang="ts" setup>
import { useHistoryStore } from '@/stores/history';
import { Trash2 } from 'lucide-vue-next';
import dayjs from 'dayjs';

const history = useHistoryStore();

function formatTime(ts: number): string {
  return dayjs(ts).format('MM/DD HH:mm');
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="flex-1 overflow-y-auto">
      <div v-if="history.entries.length === 0" class="p-8 text-center text-gray-400 dark:text-gray-500 text-sm">
        暂无历史记录
      </div>

      <div
        v-for="entry in history.entries"
        :key="entry.id"
        class="px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <h4 class="text-sm font-medium truncate text-gray-800 dark:text-gray-200">{{ entry.title }}</h4>
            <p class="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{{ entry.url }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{{ entry.summary }}</p>
          </div>
          <div class="flex flex-col items-end gap-1 flex-shrink-0">
            <span class="text-xs text-gray-400 dark:text-gray-500">{{ formatTime(entry.timestamp) }}</span>
            <button
              @click="history.removeEntry(entry.id)"
              class="p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
              aria-label="删除记录"
            >
              <Trash2 class="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="history.entries.length > 0" class="flex justify-end px-4 py-2 border-t border-gray-200 dark:border-gray-700">
      <button
        @click="history.clear()"
        class="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
        aria-label="清除所有历史"
      >
        清除全部
      </button>
    </div>
  </div>
</template>
