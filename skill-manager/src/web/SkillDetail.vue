<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { SkillRecord } from '../core/schema'

const props = defineProps<{ skill: SkillRecord | null; content: string; saving: boolean }>()
const emit = defineEmits<{
  save: [skill: SkillRecord]
  toggleEnabled: []
  toggleFavorite: []
}>()

const form = reactive({
  name: '',
  summary: '',
  categories: '',
  useCases: '',
  usage: '',
  triggers: '',
})

watch(() => props.skill, (skill) => {
  form.name = skill?.metadata.name ?? ''
  form.summary = skill?.metadata.summary ?? ''
  form.categories = skill?.metadata.categories.join(', ') ?? ''
  form.useCases = skill?.metadata.useCases.join(', ') ?? ''
  form.usage = skill?.metadata.usage ?? ''
  form.triggers = skill?.metadata.triggers.join(', ') ?? ''
}, { immediate: true })

function save(): void {
  if (!props.skill) return
  emit('save', {
    ...props.skill,
    metadata: {
      name: form.name.trim(),
      summary: form.summary.trim(),
      categories: split(form.categories),
      useCases: split(form.useCases),
      usage: form.usage.trim(),
      triggers: split(form.triggers),
    },
    metadataStatus: {
      ...props.skill.metadataStatus,
      generatedBy: 'human',
      reviewed: true,
      lastReviewedAt: new Date().toISOString(),
      error: undefined,
    },
  })
}

function split(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}
</script>

<template>
  <section v-if="skill" class="detail-panel" aria-labelledby="detail-title">
    <header class="detail-header">
      <div>
        <p class="eyebrow">{{ skill.id }}</p>
        <h2 id="detail-title">{{ skill.metadata.name || skill.id }}</h2>
        <p class="detail-source">{{ skill.source?.repository ?? '本地 Skill' }} · {{ skill.source?.version ?? '未标记版本' }}</p>
      </div>
      <div class="detail-actions">
        <button class="quiet-button" type="button" @click="emit('toggleFavorite')">{{ skill.preferences.favorite ? '取消收藏' : '收藏' }}</button>
        <button class="primary-button" type="button" @click="emit('toggleEnabled')">{{ skill.preferences.enabled ? '停用' : '启用' }}</button>
      </div>
    </header>

    <div class="status-line">
      <span class="status-dot" :class="skill.sync.status"></span>
      {{ skill.sync.status === 'needs-review' ? '原文已变化，等待复核' : skill.metadataStatus.reviewed ? '中文信息已确认' : '中文信息待确认' }}
      <span class="status-separator">·</span>
      {{ skill.rawContent.hash.slice(0, 10) }}
    </div>

    <form class="metadata-form" @submit.prevent="save">
      <label><span>中文名称</span><input v-model="form.name" required /></label>
      <label><span>简介</span><textarea v-model="form.summary" rows="3" required></textarea></label>
      <div class="form-grid">
        <label><span>分类</span><input v-model="form.categories" placeholder="研究, 写作" /></label>
        <label><span>适用场景</span><input v-model="form.useCases" placeholder="资料调研, 技术核查" /></label>
      </div>
      <label><span>使用方法</span><textarea v-model="form.usage" rows="3"></textarea></label>
      <label><span>触发词</span><input v-model="form.triggers" placeholder="研究, 调研" /></label>
      <button class="primary-button save-button" type="submit" :disabled="saving">{{ saving ? '保存中...' : '保存并确认' }}</button>
    </form>

    <details class="raw-content">
      <summary>查看原始 SKILL.md</summary>
      <pre>{{ content || '正在加载原文...' }}</pre>
    </details>
  </section>
  <section v-else class="detail-panel empty-detail"><p>从左侧选择一个 Skill。</p></section>
</template>
