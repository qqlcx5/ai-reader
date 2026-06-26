<script lang="ts" setup>
import { ref } from 'vue'
import SectionHead from '../common/SectionHead.vue'
import SourceInfo from '../common/SourceInfo.vue'
import ArticleItem from '../common/ArticleItem.vue'
import type { Article } from '../types'

const props = defineProps<{
  currentPage: Article
  articles: Article[]
}>()

const emit = defineEmits<{
  navigate: [view: string]
  openReader: [articleId: string]
  showToast: [title: string, desc: string]
}>()

const capturing = ref(false)
const stepDone = ref([false, false, false])
const stepActive = ref(-1)
const btnLabel = ref('提取正文并保存')

async function wait(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function runCapture() {
  capturing.value = true
  stepDone.value = [false, false, false]
  stepActive.value = -1
  btnLabel.value = '正在提取正文...'

  for (let i = 0; i < 3; i++) {
    stepActive.value = i
    await wait(650)
    stepActive.value = -1
    stepDone.value[i] = true
    if (i === 0) btnLabel.value = '正在生成 Markdown...'
    if (i === 1) btnLabel.value = '正在写入 IndexedDB...'
  }

  btnLabel.value = '已保存，打开阅读器'
  emit('showToast', '已保存到本地文章库', '正文、元数据和 Markdown 已写入 IndexedDB')

  await wait(1200)
  btnLabel.value = '提取正文并保存'
  capturing.value = false
}

function handlePreview() {
  emit('openReader', props.currentPage.id)
  emit('showToast', '已打开预览', '这是当前网页生成的 Markdown 预览')
}

const recent = () => props.articles.slice(0, 3)
</script>

<template>
  <section class="h-full overflow-auto pb-3.5">
    <!-- Current Page Card -->
    <div
      class="p-3.5 rounded-20px"
      style="border: 1px solid rgba(29,29,31,0.08); background: rgba(255,255,255,0.78); backdrop-filter: blur(24px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.72), 0 1px 2px rgba(0,0,0,0.04)"
    >
      <SectionHead title="Current Page" action="重新检测" />
      <SourceInfo
        :letter="currentPage.siteLetter"
        :site-name="currentPage.siteName"
        :url="currentPage.url"
      />
      <h1 class="m-0 text-19px leading-tight font-bold tracking-tight text-#111">
        {{ currentPage.title }}
      </h1>
      <p class="mt-2.5 text-12px text-#6e6e73 leading-relaxed">
        {{ currentPage.excerpt }}
      </p>
      <div class="mt-3.5 flex flex-wrap gap-2">
        <span
          v-for="tag in [`作者 ${currentPage.author}`, `发布 ${currentPage.publishedAt}`, '预计 8 min']"
          :key="tag"
          class="h-25px px-2.5 rounded-full inline-flex items-center border border-rgba(29,29,31,0.08) bg-white/68 text-#52525b text-11px"
        >
          {{ tag }}
        </span>
      </div>
    </div>

    <!-- Action Panel -->
    <div
      class="mt-3 p-3 rounded-24px"
      style="border: 1px solid rgba(29,29,31,0.08); background: linear-gradient(180deg, rgba(255,255,255,0.86), rgba(250,250,250,0.7))"
    >
      <button
        class="w-full h-44px rounded-16px text-white text-14px font-bold cursor-pointer transition-all duration-150 disabled:opacity-72 disabled:cursor-default hover:-translate-y-px"
        style="background: linear-gradient(180deg, #1f1f1f, #080808); box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 16px 32px rgba(0,0,0,0.2)"
        :disabled="capturing"
        @click="runCapture"
      >
        {{ btnLabel }}
      </button>

      <div class="mt-2.5 grid grid-cols-2 gap-2">
        <button
          class="h-36px rounded-14px border border-rgba(29,29,31,0.08) bg-white/72 text-#3f3f46 text-12px font-semibold cursor-pointer transition-all hover:bg-white hover:border-#d4d4d8 hover:-translate-y-px"
          @click="emit('showToast', 'Markdown 已复制', '可以粘贴到 Notion、Obsidian 或其他编辑器')"
        >
          复制 Markdown
        </button>
        <button
          class="h-36px rounded-14px border border-rgba(29,29,31,0.08) bg-white/72 text-#3f3f46 text-12px font-semibold cursor-pointer transition-all hover:bg-white hover:border-#d4d4d8 hover:-translate-y-px"
          @click="handlePreview"
        >
          仅预览
        </button>
      </div>

      <!-- Pipeline Steps -->
      <div class="mt-3 grid grid-cols-3 gap-2">
        <div
          v-for="(step, i) in [
            { icon: '1', title: '网页提取', desc: 'defuddle 正文识别' },
            { icon: '2', title: 'Markdown', desc: '生成结构化内容' },
            { icon: '3', title: 'IndexedDB', desc: '保存本地文章库' },
          ]"
          :key="i"
          class="min-h-67px p-2.5 rounded-16px transition-all duration-200"
          :class="stepDone[i]
            ? 'border border-rgba(22,163,74,0.18) bg-rgba(22,163,74,0.07)'
            : stepActive === i
              ? 'border border-rgba(37,99,235,0.2) bg-rgba(37,99,235,0.07)'
              : 'border border-rgba(29,29,31,0.08) bg-white/58'"
        >
          <div
            class="w-22px h-22px rounded-8px grid place-items-center text-12px mb-2"
            :class="stepDone[i]
              ? 'bg-#16a34a text-white'
              : stepActive === i
                ? 'bg-#2563eb text-white'
                : 'bg-#f4f4f5 text-#52525b'"
          >
            {{ stepDone[i] ? '✓' : step.icon }}
          </div>
          <div class="text-11px font-bold text-#27272a">{{ step.title }}</div>
          <div class="mt-px text-10px leading-snug text-#a1a1aa">{{ step.desc }}</div>
        </div>
      </div>
    </div>

    <!-- Markdown Preview -->
    <div
      class="mt-3 p-3.5 rounded-20px"
      style="border: 1px solid rgba(29,29,31,0.08); background: rgba(255,255,255,0.78); backdrop-filter: blur(24px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.72), 0 1px 2px rgba(0,0,0,0.04)"
    >
      <SectionHead title="Markdown Preview" action="打开详情" @action="handlePreview" />
      <div class="p-3 rounded-16px border border-rgba(29,29,31,0.08) bg-rgba(250,250,250,0.74)">
        <div class="mb-2 text-13px font-bold tracking-tight">AI-native Web Applications</div>
        <div class="text-#52525b text-12px leading-relaxed">
          {{ currentPage.excerpt }}
        </div>
        <div
          class="mt-2.5 px-2.5 py-2 rounded-12px text-#52525b text-11px font-mono whitespace-nowrap overflow-hidden text-ellipsis"
          style="border: 1px solid rgba(0,0,0,0.04); background: #f4f4f5"
        >
          ## Overview · Modern AI-native applications are no longer simple forms...
        </div>
      </div>
    </div>

    <!-- Recent Saves -->
    <div
      class="mt-3 p-3.5 rounded-20px"
      style="border: 1px solid rgba(29,29,31,0.08); background: rgba(255,255,255,0.78); backdrop-filter: blur(24px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.72), 0 1px 2px rgba(0,0,0,0.04)"
    >
      <SectionHead title="Recent Saves" action="全部文章" @action="emit('navigate', 'library')" />
      <div v-if="recent().length === 0" class="px-4 py-7 text-center text-#6e6e73">
        <div class="text-14px font-bold text-#27272a">暂无保存文章</div>
        <div class="mt-1.5 text-12px">点击上方按钮保存当前网页。</div>
      </div>
      <div v-else class="flex flex-col gap-2">
        <ArticleItem
          v-for="article in recent()"
          :key="article.id"
          :article="article"
          @select="emit('openReader', article.id)"
          @delete="emit('showToast', '已删除', article.title)"
        />
      </div>
    </div>
  </section>
</template>
