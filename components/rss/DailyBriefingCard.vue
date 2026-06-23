<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { generateBriefing, checkShouldShowBriefing, markBriefingShown } from '@/lib/rss/daily-briefing'

const emit = defineEmits<{
  (e: 'openArticle', link: string): void
}>()

const visible = ref(false)
const collapsed = ref(false)
const briefingMd = ref('')
const loading = ref(false)
const canExport = ref(false)

onMounted(async () => {
  const should = await checkShouldShowBriefing()
  if (!should) return

  loading.value = true
  try {
    const md = await generateBriefing()
    if (!md.includes('暂无今日新文章')) {
      briefingMd.value = md
      visible.value = true
      await markBriefingShown()
    }
  } catch (err) {
    console.error('[DailyBriefingCard] failed', err)
  } finally {
    loading.value = false
  }

  // 检查是否支持 Obsidian 导出（M7 模块可选）
  try {
    await import('@/lib/export')
    canExport.value = true
  } catch {
    canExport.value = false
  }
})

function renderMd(md: string): string {
  return md
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^---$/gm, '<hr/>')
    .replace(/\n/g, '<br/>')
}

async function exportToObsidian() {
  try {
    const { exportToObsidian: doExport } = await import('@/lib/export')
    await doExport({ content: briefingMd.value, title: '今日简报' })
  } catch {
    alert('导出失败：请确认已配置 Obsidian URI 路径')
  }
}

function dismiss() {
  visible.value = false
}
</script>

<template>
  <div v-if="visible" class="briefing-card">
    <!-- 头部 -->
    <div class="briefing-card__header" @click="collapsed = !collapsed">
      <div class="briefing-card__header-left">
        <span class="briefing-card__icon">📋</span>
        <span class="briefing-card__title">今日简报</span>
      </div>
      <div class="briefing-card__header-right">
        <button
          v-if="canExport"
          class="briefing-card__export-btn"
          @click.stop="exportToObsidian"
          title="导出到 Obsidian"
        >
          导出到 Obsidian
        </button>
        <button class="briefing-card__collapse-btn" :aria-label="collapsed ? '展开' : '收起'">
          {{ collapsed ? '▼' : '▲' }}
        </button>
        <button class="briefing-card__dismiss-btn" @click.stop="dismiss" aria-label="关闭">✕</button>
      </div>
    </div>

    <!-- 内容 -->
    <div v-if="!collapsed" class="briefing-card__body">
      <div
        class="briefing-card__content markdown-content"
        v-html="renderMd(briefingMd)"
      />
    </div>
  </div>
</template>

<style scoped>
.briefing-card {
  background: var(--primary-soft);
  border: 1px solid #d2d6ff;
  border-radius: var(--radius-lg);
  overflow: hidden;
  flex-shrink: 0;
}

.briefing-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.1s;
  user-select: none;
}

.briefing-card__header:hover {
  background: rgba(91, 96, 229, 0.06);
}

.briefing-card__header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.briefing-card__header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.briefing-card__icon {
  font-size: 14px;
}

.briefing-card__title {
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--primary);
}

.briefing-card__export-btn {
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--primary);
  background: #fff;
  border: 1px solid #c5c9f8;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: background 0.1s;
}

.briefing-card__export-btn:hover {
  background: var(--primary);
  color: #fff;
}

.briefing-card__collapse-btn,
.briefing-card__dismiss-btn {
  padding: 2px 5px;
  font-size: 11px;
  color: var(--muted);
  border-radius: var(--radius-sm);
  transition: background 0.1s, color 0.1s;
}

.briefing-card__collapse-btn:hover,
.briefing-card__dismiss-btn:hover {
  background: rgba(0, 0, 0, 0.06);
  color: var(--text);
}

.briefing-card__body {
  border-top: 1px solid #d2d6ff;
  padding: 10px 12px;
  max-height: 300px;
  overflow-y: auto;
}

.briefing-card__content {
  font-size: var(--fs-xs);
  line-height: 1.6;
  color: var(--text);
}

.briefing-card__content :deep(h1) {
  font-size: var(--fs-sm);
  font-weight: 800;
  margin: 0 0 8px;
  color: var(--text);
}

.briefing-card__content :deep(h2) {
  font-size: var(--fs-xs);
  font-weight: 700;
  margin: 10px 0 4px;
  color: var(--text);
}

.briefing-card__content :deep(li) {
  margin-bottom: 3px;
  list-style: none;
  padding-left: 0;
}

.briefing-card__content :deep(strong) {
  font-weight: 700;
  color: var(--primary);
  cursor: pointer;
}

.briefing-card__content :deep(hr) {
  border: none;
  border-top: 1px solid #d2d6ff;
  margin: 8px 0;
}
</style>
