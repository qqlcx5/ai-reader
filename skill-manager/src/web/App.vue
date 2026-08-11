<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from 'vue'
import SkillDetail from './SkillDetail.vue'
import SkillFilters from './SkillFilters.vue'
import SkillList from './SkillList.vue'
import type { SkillCatalog, SkillRecord } from '../core/schema'

const catalog = shallowRef<SkillCatalog | null>(null)
const selectedId = shallowRef<string>()
const content = shallowRef('')
const query = shallowRef('')
const category = shallowRef('')
const enabled = shallowRef('')
const favorite = shallowRef(false)
const loading = shallowRef(true)
const saving = shallowRef(false)
const error = shallowRef('')
const notice = shallowRef('')

const skills = computed(() => catalog.value?.skills ?? [])
const categories = computed(() => [...new Set(skills.value.flatMap((skill) => skill.metadata.categories))].sort())
const visibleSkills = computed(() => {
  const normalizedQuery = query.value.trim().toLocaleLowerCase()
  return skills.value.filter((skill) => {
    if (category.value && !skill.metadata.categories.includes(category.value)) return false
    if (enabled.value && String(skill.preferences.enabled) !== enabled.value) return false
    if (favorite.value && !skill.preferences.favorite) return false
    if (!normalizedQuery) return true
    return searchableText(skill).toLocaleLowerCase().includes(normalizedQuery)
  })
})
const selectedSkill = computed(() => skills.value.find((skill) => skill.id === selectedId.value) ?? null)

onMounted(loadCatalog)
watch(selectedId, loadContent)

async function loadCatalog(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const response = await fetch('/api/catalog')
    if (!response.ok) throw new Error(`加载目录失败 (${response.status})`)
    catalog.value = await response.json() as SkillCatalog
    if (!selectedId.value) selectedId.value = catalog.value.skills[0]?.id
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    loading.value = false
  }
}

async function loadContent(): Promise<void> {
  if (!selectedId.value) {
    content.value = ''
    return
  }
  const response = await fetch(`/api/content/${encodeURIComponent(selectedId.value)}`)
  content.value = response.ok ? await response.text() : '原文加载失败。'
}

async function persist(nextCatalog: SkillCatalog, message: string): Promise<void> {
  saving.value = true
  error.value = ''
  try {
    const response = await fetch('/api/catalog', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextCatalog),
    })
    if (!response.ok) throw new Error(`保存失败 (${response.status})`)
    catalog.value = await response.json() as SkillCatalog
    notice.value = message
    window.setTimeout(() => { notice.value = '' }, 2400)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    saving.value = false
  }
}

function updateSkill(updated: SkillRecord): void {
  if (!catalog.value) return
  persist({ ...catalog.value, skills: catalog.value.skills.map((skill) => skill.id === updated.id ? updated : skill) }, '已保存并确认中文信息')
}

function toggleSkill(id: string, key: 'enabled' | 'favorite'): void {
  if (!catalog.value) return
  const next = catalog.value.skills.map((skill) => skill.id === id
    ? { ...skill, preferences: { ...skill.preferences, [key]: !skill.preferences[key] } }
    : skill)
  persist({ ...catalog.value, skills: next }, key === 'enabled' ? '状态已更新' : '收藏状态已更新')
}

async function exportCatalog(): Promise<void> {
  const response = await fetch('/api/export', { method: 'POST' })
  notice.value = response.ok ? '已导出 enabled-skills.json' : '导出失败'
}

function resetFilters(): void {
  query.value = ''
  category.value = ''
  enabled.value = ''
  favorite.value = false
}

function searchableText(skill: SkillRecord): string {
  return [skill.id, skill.slug, skill.metadata.name, skill.metadata.summary, ...skill.metadata.categories, ...skill.metadata.useCases, skill.metadata.usage, ...skill.metadata.triggers].join('\n')
}
</script>

<template>
  <main class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">LOCAL CATALOG</p>
        <h1>Skill 管理中心</h1>
      </div>
      <div class="topbar-actions">
        <span v-if="notice" class="notice" role="status">{{ notice }}</span>
        <button class="quiet-button" type="button" @click="loadCatalog">重新扫描</button>
        <button class="primary-button" type="button" @click="exportCatalog">导出启用列表</button>
      </div>
    </header>

    <p v-if="error" class="error-banner" role="alert">{{ error }}</p>
    <div v-if="loading" class="loading-state">正在读取 Skill 目录...</div>
    <template v-else>
      <SkillFilters
        v-model:query="query"
        v-model:category="category"
        v-model:enabled="enabled"
        v-model:favorite="favorite"
        :categories="categories"
        @reset="resetFilters"
      />
      <div class="workspace-grid">
        <section class="list-panel">
          <div class="list-heading"><span>{{ visibleSkills.length }} 个结果</span><span>{{ skills.length }} 个 Skill</span></div>
          <SkillList
            :skills="visibleSkills"
            :selected-id="selectedId"
            @select="selectedId = $event"
            @toggle-enabled="toggleSkill($event, 'enabled')"
            @toggle-favorite="toggleSkill($event, 'favorite')"
          />
        </section>
        <SkillDetail
          :skill="selectedSkill"
          :content="content"
          :saving="saving"
          @save="updateSkill"
          @toggle-enabled="selectedSkill && toggleSkill(selectedSkill.id, 'enabled')"
          @toggle-favorite="selectedSkill && toggleSkill(selectedSkill.id, 'favorite')"
        />
      </div>
    </template>
  </main>
</template>
