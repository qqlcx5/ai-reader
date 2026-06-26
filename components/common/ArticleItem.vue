<script lang="ts" setup>
import Favicon from './Favicon.vue'
import type { Article } from '../types'

defineProps<{
  article: Article
}>()

defineEmits<{
  select: []
  delete: []
}>()
</script>

<template>
  <article
    class="grid items-center gap-2.5 px-2.5 py-2 rounded-16px border border-transparent cursor-pointer transition-all duration-150 hover:bg-white/78 hover:border-rgba(29,29,31,0.08)"
    style="grid-template-columns: 30px 1fr auto"
    @click="$emit('select')"
  >
    <Favicon :letter="article.siteLetter" />
    <div class="min-w-0">
      <div class="max-w-225px text-12px font-semibold text-#27272a whitespace-nowrap overflow-hidden text-ellipsis">
        {{ article.title }}
      </div>
      <div class="mt-px text-11px text-#a1a1aa">
        {{ article.siteName }} · {{ article.createdAt }}
      </div>
    </div>
    <button
      class="w-28px h-28px rounded-10px bg-transparent text-#a1a1aa cursor-pointer transition-all duration-150 hover:text-#dc2626 hover:bg-rgba(220,38,38,0.08)"
      title="删除"
      @click.stop="$emit('delete')"
    >
      ×
    </button>
  </article>
</template>
