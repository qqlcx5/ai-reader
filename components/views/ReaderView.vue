<script lang="ts" setup>
import SourceInfo from '../common/SourceInfo.vue'
import type { Article } from '../types'

const props = defineProps<{
  article: Article | null
}>()

const emit = defineEmits<{
  back: []
  showToast: [title: string, desc: string]
}>()

function renderMarkdown(md: string): string {
  const lines = md.split('\n')
  let html = ''
  let inList = false

  for (const line of lines) {
    const t = line.trim()
    if (!t) { if (inList) { html += '</ul>'; inList = false }; continue }
    if (t.startsWith('## ')) {
      if (inList) { html += '</ul>'; inList = false }
      html += `<h2>${t.slice(3)}</h2>`
      continue
    }
    if (t.startsWith('- ')) {
      if (!inList) { html += '<ul>'; inList = true }
      html += `<li>${t.slice(2)}</li>`
      continue
    }
    if (inList) { html += '</ul>'; inList = false }
    html += `<p>${t}</p>`
  }
  if (inList) html += '</ul>'
  return html
}

const infoItems = (a: Article) => [
  { label: '作者', value: a.author },
  { label: '发布时间', value: a.publishedAt },
  { label: '站点', value: a.siteName },
  { label: '保存时间', value: a.createdAt },
]
</script>

<template>
  <section class="h-full overflow-auto pb-3.5">
    <div
      v-if="article"
      class="p-3.5 rounded-20px"
      style="border: 1px solid rgba(29,29,31,0.08); background: rgba(255,255,255,0.78); backdrop-filter: blur(24px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.72), 0 1px 2px rgba(0,0,0,0.04)"
    >
      <!-- Top actions -->
      <div class="flex items-center justify-between gap-2.5 mb-3.5">
        <button
          class="h-32px px-3 rounded-12px border border-rgba(29,29,31,0.08) bg-white/72 text-#3f3f46 text-12px font-semibold cursor-pointer transition-all hover:bg-white hover:-translate-y-px inline-flex items-center"
          @click="emit('back')"
        >
          ← 文章库
        </button>
        <div class="flex gap-2">
          <button
            class="h-32px px-2.5 rounded-12px border border-rgba(29,29,31,0.08) bg-white/72 text-#3f3f46 text-12px font-semibold cursor-pointer transition-all hover:bg-white hover:-translate-y-px inline-flex items-center"
            @click="emit('showToast', 'Markdown 已复制', '可以粘贴到 Notion、Obsidian')"
          >
            复制
          </button>
          <button
            class="h-32px px-2.5 rounded-12px border text-#dc2626 text-12px font-semibold cursor-pointer transition-all hover:-translate-y-px inline-flex items-center"
            style="border-color: rgba(220,38,38,0.15); background: rgba(254,242,242,0.76)"
            @click="emit('showToast', '文章已删除', article.title)"
          >
            删除
          </button>
        </div>
      </div>

      <SourceInfo
        :letter="article.siteLetter"
        :site-name="article.siteName"
        :url="article.url"
      />

      <h1 class="m-0 text-25px leading-tight font-bold tracking-tight text-#111">
        {{ article.title }}
      </h1>

      <!-- YAML Frontmatter -->
      <div
        class="mt-4 p-3 rounded-16px text-11px font-mono leading-relaxed overflow-x-auto"
        style="background: #1a1a2e; color: #98c379; border: 1px solid rgba(29,29,31,0.12)"
      >
        <div style="color: #56b6c2">---</div>
        <div><span style="color: #e5c07b">title</span>: "{{ article.title }}"</div>
        <div><span style="color: #e5c07b">url</span>: "{{ article.url }}"</div>
        <div><span style="color: #e5c07b">author</span>: "{{ article.author }}"</div>
        <div><span style="color: #e5c07b">clipped_at</span>: "{{ article.createdAt }}"</div>
        <div><span style="color: #e5c07b">tags</span>: [{{ article.tags?.map(t => `"#${t}"`).join(', ') }}]</div>
        <div style="color: #56b6c2">---</div>
      </div>

      <!-- Info Grid -->
      <div
        class="mt-4 grid grid-cols-2 rounded-18px overflow-hidden"
        style="border: 1px solid rgba(29,29,31,0.08); background: rgba(255,255,255,0.62)"
      >
        <div
          v-for="(item, i) in infoItems(article)"
          :key="i"
          class="p-3"
          :class="(i % 2 === 0) ? 'border-r' : ''"
          :style="(i < infoItems(article).length - 2)
            ? 'border-bottom: 1px solid rgba(29,29,31,0.08)'
            : ''"
          style="border-color: rgba(29,29,31,0.08)"
        >
          <div class="mb-1 text-10px text-#a1a1aa">{{ item.label }}</div>
          <div class="text-12px font-semibold text-#3f3f46 whitespace-nowrap overflow-hidden text-ellipsis">
            {{ item.value }}
          </div>
        </div>
      </div>

      <!-- Markdown Content -->
      <div
        class="mt-3.5 p-4 rounded-20px text-#2f3338 text-13px leading-relaxed"
        style="border: 1px solid rgba(29,29,31,0.08); background: rgba(255,255,255,0.76); box-shadow: 0 10px 30px rgba(0,0,0,0.08)"
        v-html="renderMarkdown(article.markdown)"
      />
    </div>

    <!-- Empty state -->
    <div v-else class="p-7 text-center text-#6e6e73">
      <div class="text-14px font-bold text-#27272a">还没有可阅读的文章</div>
      <div class="mt-1.5 text-12px">先保存一篇网页，再进入阅读器。</div>
    </div>
  </section>
</template>

<style scoped>
:deep(h2) {
  margin: 18px 0 8px;
  color: #111;
  font-size: 18px;
  line-height: 1.25;
  letter-spacing: -0.035em;
}
:deep(h2:first-child) {
  margin-top: 0;
}
:deep(p) {
  margin: 0 0 12px;
}
:deep(ul) {
  margin: 0 0 12px;
  padding-left: 18px;
}
:deep(li) {
  margin: 6px 0;
}
</style>
