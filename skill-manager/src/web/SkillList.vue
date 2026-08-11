<script setup lang="ts">
import type { SkillRecord } from '../core/schema'

defineProps<{ skills: SkillRecord[]; selectedId?: string }>()
const emit = defineEmits<{
  select: [id: string]
  toggleEnabled: [id: string]
  toggleFavorite: [id: string]
}>()
</script>

<template>
  <div class="skill-list" role="listbox" aria-label="Skill 列表">
    <button
      v-for="skill in skills"
      :key="skill.id"
      class="skill-row"
      :class="{ selected: skill.id === selectedId }"
      type="button"
      role="option"
      :aria-selected="skill.id === selectedId"
      @click="emit('select', skill.id)"
    >
      <span class="skill-row-main">
        <strong>{{ skill.metadata.name || skill.id }}</strong>
        <small>{{ skill.metadata.summary || '尚未生成中文摘要' }}</small>
        <span class="tag-line">
          <span v-for="category in skill.metadata.categories.slice(0, 2)" :key="category" class="tag">{{ category }}</span>
        </span>
      </span>
      <span class="skill-row-actions" @click.stop>
        <button class="icon-button" type="button" :aria-label="skill.preferences.favorite ? '取消收藏' : '收藏'" @click="emit('toggleFavorite', skill.id)">
          {{ skill.preferences.favorite ? '★' : '☆' }}
        </button>
        <button class="status-button" type="button" @click="emit('toggleEnabled', skill.id)">
          {{ skill.preferences.enabled ? '启用' : '停用' }}
        </button>
      </span>
    </button>
    <p v-if="skills.length === 0" class="empty-state">没有符合条件的 Skill。</p>
  </div>
</template>
