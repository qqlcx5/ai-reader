<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue'
import SectionHead from '../common/SectionHead.vue'
import SourceInfo from '../common/SourceInfo.vue'
import ArticleItem from '../common/ArticleItem.vue'
import { useArticleStore } from '@/stores/article.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useCurrentPage, isRestrictedUrl } from '@/composables/useCurrentPage'
import { extractPage, getActiveTab } from '@/messaging/client'
import { applyFrontmatter, makeFrontmatterMeta } from '@/utils/markdown.service'
import type { Article, CaptureStep, PopupView, ToastType } from '@/domain'

// ---- Props (from App.vue) ----
const props = defineProps<{
  currentPage?: Article | null
}>()

// ---- Emits ----
const emit = defineEmits<{
  navigate: [view: PopupView]
  openReader: [articleId: string]
  showToast: [payload: ToastType]
  confirmDelete: [articleId: string]
}>()

// ---- Stores ----
const articleStore = useArticleStore()
const settingsStore = useSettingsStore()

// ---- Current Page (composable) ----
const { page: detectedPage, loading: pageLoading, isRestricted, detect } = useCurrentPage()

// Merge composable detection with App.vue prop
const pageMeta = computed(() => {
  if (detectedPage.value) return detectedPage.value
  if (props.currentPage) {
    return {
      title: props.currentPage.title,
      url: props.currentPage.url,
      siteName: props.currentPage.siteName,
      author: props.currentPage.author,
      publishedAt: props.currentPage.publishedAt,
      description: props.currentPage.excerpt,
      faviconUrl: props.currentPage.faviconUrl,
    }
  }
  return null
})

// ---- Capture State ----
const captureStep = ref<CaptureStep>('idle')
const stepDone = ref([false, false, false])
const stepActive = ref(-1)
const btnLabel = ref('提取正文并保存')
const extractError = ref<string | null>(null)

// ---- Draft (extract result cache, 5s TTL) ----
const draft = ref<Article | null>(null)
const draftExpiresAt = ref<number>(0)

function isDraftValid(): boolean {
  return !!draft.value && Date.now() <= draftExpiresAt.value
}

// ---- Recent Saves (computed from store, auto-refreshes after delete) ----
const recentArticles = computed(() =>
  [...articleStore.articles]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3),
)

// ---- Computed ----
const isExtracting = computed(
  () =>
    captureStep.value === 'extracting' ||
    captureStep.value === 'markdown' ||
    captureStep.value === 'saving',
)

const isPageUnsupported = computed(() => {
  if (!pageMeta.value?.url) return false
  return isRestrictedUrl(pageMeta.value.url) || isRestricted.value
})

const needsManualSave = computed(
  () => !settingsStore.settings.autoSave && isDraftValid() && captureStep.value !== 'saving',
)

// ---- Current Page Detection ----
async function detectCurrentPage() {
  await detect()
  if (pageMeta.value && !isPageUnsupported.value) {
    emit('showToast', {
      type: 'info',
      title: '页面检测完成',
      description: '已识别标题、URL、作者、站点名和发布时间',
    })
  }
}

// ---- Extract Pipeline ----
async function runCapture() {
  if (isExtracting.value) return
  if (!pageMeta.value?.url) {
    emit('showToast', { type: 'error', title: '当前页面不可用', description: '无法获取当前页面信息' })
    return
  }
  if (isPageUnsupported.value) {
    emit('showToast', { type: 'error', title: '页面不支持提取', description: '浏览器内部页面无法读取' })
    return
  }

  extractError.value = null
  captureStep.value = 'extracting'
  stepDone.value = [false, false, false]
  stepActive.value = 0
  btnLabel.value = '正在提取正文...'

  try {
    // Step 1 & 2: Extract + Markdown (both done in Content Script)
    const { tabId } = await getActiveTab()
    const result = await extractPage(tabId)

    stepDone.value[0] = true
    stepDone.value[1] = true
    stepActive.value = 2
    captureStep.value = 'markdown'
    btnLabel.value = '正在写入 IndexedDB...'

    // Step 3: Apply frontmatter setting
    const finalMarkdown = applyFrontmatter(
      result.markdown || '',
      makeFrontmatterMeta(result, pageMeta.value.title || 'Untitled'),
      settingsStore.settings.includeFrontmatter,
    )

    if (settingsStore.settings.autoSave) {
      // Auto-save path
      captureStep.value = 'saving'
      const article: Article = {
        id: crypto.randomUUID(),
        title: result.title || pageMeta.value.title || 'Untitled',
        url: result.url || pageMeta.value.url,
        siteName: result.siteName || pageMeta.value.siteName,
        siteLetter: (result.siteName || pageMeta.value.siteName || '?')[0].toUpperCase(),
        author: result.author,
        publishedAt: result.publishedAt,
        excerpt: result.excerpt || result.contentText?.slice(0, 200),
        markdown: finalMarkdown,
        contentHtml: result.contentHtml,
        contentText: result.contentText,
        image: result.image,
        readingTime: result.readingTime,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const saved = await articleStore.saveArticle(article)

      // Cache for 5s
      draft.value = saved
      draftExpiresAt.value = Date.now() + 5000

      stepDone.value[2] = true
      stepActive.value = -1
      captureStep.value = 'success'
      btnLabel.value = '已保存，打开阅读器'

      emit('showToast', {
        type: 'success',
        title: '已保存到本地文章库',
        description: '正文、元数据和 Markdown 已写入 IndexedDB',
      })
    } else {
      // Manual-save path: cache draft, wait for user to click save
      const draftArticle: Article = {
        id: crypto.randomUUID(),
        title: result.title || pageMeta.value.title || 'Untitled',
        url: result.url || pageMeta.value.url,
        siteName: result.siteName || pageMeta.value.siteName,
        siteLetter: (result.siteName || pageMeta.value.siteName || '?')[0].toUpperCase(),
        author: result.author,
        publishedAt: result.publishedAt,
        excerpt: result.excerpt || result.contentText?.slice(0, 200),
        markdown: finalMarkdown,
        contentHtml: result.contentHtml,
        contentText: result.contentText,
        image: result.image,
        readingTime: result.readingTime,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      draft.value = draftArticle
      draftExpiresAt.value = Date.now() + 300000 // 5 min TTL for manual-save

      stepDone.value[2] = false
      stepActive.value = -1
      captureStep.value = 'success'
      btnLabel.value = '提取正文并保存'

      emit('showToast', {
        type: 'info',
        title: '提取完成',
        description: '自动保存已关闭，请手动保存',
      })
    }

    // Refresh recent saves
    // Reset after brief display
    setTimeout(() => {
      btnLabel.value = '提取正文并保存'
      captureStep.value = 'idle'
      stepDone.value = [false, false, false]
    }, 1500)
  } catch (err) {
    console.error('采集失败:', err)
    captureStep.value = 'error'
    extractError.value = err instanceof Error ? err.message : '未知错误'
    btnLabel.value = '重试提取'

    // Permission-specific error toast
    if (err instanceof Error && (
      err.message.toLowerCase().includes('permission') ||
      err.message.toLowerCase().includes('denied') ||
      err.message.includes('无法访问')
    )) {
      emit('showToast', {
        type: 'error',
        title: '需要当前站点访问权限',
        description: '请在扩展设置中授权',
      })
    } else {
      emit('showToast', {
        type: 'error',
        title: '提取失败',
        description: extractError.value || '请重试',
      })
    }
  }
}

// ---- Preview Only (extract without saving to IndexedDB) ----
async function handlePreview() {
  if (isDraftValid()) {
    // Use cached draft
    emit('openReader', draft.value!.id)
    emit('showToast', { type: 'success', title: '已打开预览', description: '使用缓存的提取结果' })
    return
  }

  if (isPageUnsupported.value) {
    emit('showToast', { type: 'error', title: '页面不支持提取', description: '浏览器内部页面无法预览' })
    return
  }

  if (!pageMeta.value?.url) {
    emit('showToast', { type: 'error', title: '当前页面不可用', description: '无法获取当前页面信息' })
    return
  }

  extractError.value = null
  captureStep.value = 'extracting'
  stepDone.value = [false, false, false]
  stepActive.value = 0
  btnLabel.value = '正在提取正文...'

  try {
    const { tabId } = await getActiveTab()
    const result = await extractPage(tabId)

    stepDone.value[0] = true
    stepDone.value[1] = true
    stepActive.value = -1
    captureStep.value = 'success'

    // Create a preview article (NOT saved to IndexedDB)
    const previewArticle: Article = {
      id: `preview-${crypto.randomUUID()}`,
      title: result.title || pageMeta.value.title || 'Untitled',
      url: result.url || pageMeta.value.url,
      siteName: result.siteName || pageMeta.value.siteName,
      siteLetter: (result.siteName || pageMeta.value.siteName || '?')[0].toUpperCase(),
      author: result.author,
      publishedAt: result.publishedAt,
      excerpt: result.excerpt || result.contentText?.slice(0, 200),
      markdown: applyFrontmatter(
        result.markdown || '',
        makeFrontmatterMeta(result, pageMeta.value.title || 'Untitled'),
        settingsStore.settings.includeFrontmatter,
      ),
      contentHtml: result.contentHtml,
      contentText: result.contentText,
      image: result.image,
      readingTime: result.readingTime,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Put preview in store as active article (not persisted to IndexedDB)
    articleStore.setActiveArticle(previewArticle.id)
    // Inject into store articles array temporarily
    articleStore.articles.unshift(previewArticle)

    draft.value = previewArticle
    draftExpiresAt.value = Date.now() + 5000

    emit('openReader', previewArticle.id)
    emit('showToast', { type: 'success', title: '已打开预览', description: '预览文章未保存到本地库' })

    btnLabel.value = '提取正文并保存'
    captureStep.value = 'idle'
    stepDone.value = [false, false, false]
  } catch (err) {
    console.error('预览提取失败:', err)
    captureStep.value = 'error'
    extractError.value = err instanceof Error ? err.message : '未知错误'
    btnLabel.value = '重试提取'

    if (err instanceof Error && (
      err.message.toLowerCase().includes('permission') ||
      err.message.toLowerCase().includes('denied') ||
      err.message.includes('无法访问')
    )) {
      emit('showToast', {
        type: 'error',
        title: '需要当前站点访问权限',
        description: '请在扩展设置中授权',
      })
    } else {
      emit('showToast', {
        type: 'error',
        title: '提取失败',
        description: extractError.value || '请重试',
      })
    }
  }
}

// ---- Manual Save (when autoSave is disabled) ----
async function handleManualSave() {
  if (!isDraftValid()) {
    emit('showToast', {
      type: 'info',
      title: '没有可保存的内容',
      description: '请先提取后再保存',
    })
    return
  }

  captureStep.value = 'saving'
  btnLabel.value = '正在保存...'
  try {
    const saved = await articleStore.saveArticle(draft.value!)
    draft.value = saved
    draftExpiresAt.value = Date.now() + 5000

    stepDone.value[2] = true
    captureStep.value = 'success'
    btnLabel.value = '已保存，打开阅读器'

    emit('showToast', {
      type: 'success',
      title: '已保存到本地文章库',
      description: '正文、元数据和 Markdown 已写入 IndexedDB',
    })

    setTimeout(() => {
      btnLabel.value = '提取正文并保存'
      captureStep.value = 'idle'
      stepDone.value = [false, false, false]
    }, 1500)
  } catch (err) {
    console.error('手动保存失败:', err)
    captureStep.value = 'error'
    extractError.value = err instanceof Error ? err.message : '保存失败'
    btnLabel.value = '重试保存'
    emit('showToast', {
      type: 'error',
      title: '保存失败',
      description: extractError.value || '请重试',
    })
  }
}

// ---- Copy Markdown ----
async function handleCopyMarkdown() {
  if (!isDraftValid()) {
    emit('showToast', {
      type: 'info',
      title: '请先提取',
      description: '点击「提取正文并保存」后再复制',
    })
    return
  }

  const text = draft.value!.markdown

  // 1. Modern Clipboard API
  try {
    await navigator.clipboard.writeText(text)
    emit('showToast', {
      type: 'success',
      title: 'Markdown 已复制',
      description: '可以粘贴到 Notion、Obsidian 或其他编辑器',
    })
    return
  } catch {
    // clipboard API failed, try fallback
  }

  // 2. execCommand fallback
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.cssText = 'position:fixed;left:-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    const success = document.execCommand('copy')
    textarea.remove()
    if (success) {
      emit('showToast', {
        type: 'success',
        title: 'Markdown 已复制',
        description: '可以粘贴到 Notion、Obsidian 或其他编辑器',
      })
      return
    }
  } catch {
    // execCommand failed
  }

  emit('showToast', {
    type: 'error',
    title: '复制失败',
    description: '当前环境不允许复制',
  })
}

// ---- Recent Saves Handlers ----
function handleOpenRecent(articleId: string) {
  emit('openReader', articleId)
}

function handleDeleteRecent(articleId: string) {
  emit('confirmDelete', articleId)
}

// ---- Lifecycle ----
onMounted(async () => {
  await detectCurrentPage()

  // Reset state (SidePanel reopen)
  captureStep.value = 'idle'
  stepDone.value = [false, false, false]
  stepActive.value = -1
  btnLabel.value = '提取正文并保存'
})

// Re-detect when App.vue currentPage prop changes
watch(
  () => props.currentPage,
  async (newPage) => {
    if (newPage && !detectedPage.value) {
      // Use App.vue's detection result if our composable hasn't detected yet
    }
  },
)
</script>

<template>
  <section class="h-full overflow-auto pb-3.5">
    <!-- Current Page Card -->
    <div
      class="p-3.5 rounded-20px"
      style="border: 1px solid rgba(29,29,31,0.08); background: rgba(255,255,255,0.78); backdrop-filter: blur(24px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.72), 0 1px 2px rgba(0,0,0,0.04)"
    >
      <SectionHead title="Current Page" action="重新检测" @action="detectCurrentPage" />

      <!-- Loading -->
      <div v-if="pageLoading" class="py-6 text-center text-#a1a1aa text-12px">
        正在检测当前页面...
      </div>

      <!-- Unavailable -->
      <div v-else-if="!pageMeta" class="py-6 text-center text-#a1a1aa">
        <div class="text-14px font-bold text-#27272a">当前页面不可用</div>
        <div class="mt-1.5 text-12px">无法读取当前标签页信息</div>
      </div>

      <!-- Restricted Page -->
      <div v-else-if="isPageUnsupported" class="py-4 text-center">
        <div class="text-14px font-bold text-#dc2626">浏览器内部页面无法读取</div>
        <div class="mt-1.5 text-12px text-#a1a1aa">
          chrome:// 和 chrome-extension:// 等内置页面不支持提取
        </div>
      </div>

      <!-- Normal Page -->
      <template v-else>
        <SourceInfo
          :letter="(pageMeta.siteName?.[0] ?? '?').toUpperCase()"
          :site-name="pageMeta.siteName || ''"
          :url="pageMeta.url || ''"
        />
        <h1 class="m-0 text-19px leading-tight font-bold tracking-tight text-#111">
          {{ pageMeta.title || 'Untitled' }}
        </h1>
        <p class="mt-2.5 text-12px text-#6e6e73 leading-relaxed">
          {{ pageMeta.description || '暂无描述' }}
        </p>
        <div class="mt-3.5 flex flex-wrap gap-2">
          <span
            v-for="tag in [
              `作者 ${pageMeta.author || '-'}`,
              `发布 ${pageMeta.publishedAt || '-'}`,
              '预计 8 min',
            ]"
            :key="tag"
            class="h-25px px-2.5 rounded-full inline-flex items-center border border-rgba(29,29,31,0.08) bg-white/68 text-#52525b text-11px"
          >
            {{ tag }}
          </span>
        </div>
      </template>
    </div>

    <!-- Action Panel -->
    <div
      class="mt-3 p-3 rounded-24px"
      style="border: 1px solid rgba(29,29,31,0.08); background: linear-gradient(180deg, rgba(255,255,255,0.86), rgba(250,250,250,0.7))"
    >
      <button
        class="w-full h-44px rounded-16px text-white text-14px font-bold cursor-pointer transition-all duration-150 disabled:opacity-72 disabled:cursor-default hover:-translate-y-px"
        style="background: linear-gradient(180deg, #1f1f1f, #080808); box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 16px 32px rgba(0,0,0,0.2)"
        :disabled="isExtracting || isPageUnsupported"
        @click="runCapture"
      >
        {{ isPageUnsupported ? '浏览器内部页面无法提取' : btnLabel }}
      </button>

      <div class="mt-2.5 grid grid-cols-2 gap-2">
        <button
          v-if="needsManualSave"
          class="col-span-2 h-36px rounded-14px border border-rgba(22,163,74,0.18) bg-rgba(22,163,74,0.08) text-#16a34a text-12px font-semibold cursor-pointer transition-all hover:bg-rgba(22,163,74,0.14) hover:-translate-y-px"
          @click="handleManualSave"
        >
          保存到文章库
        </button>
        <button
          v-else
          class="h-36px rounded-14px border border-rgba(29,29,31,0.08) bg-white/72 text-#3f3f46 text-12px font-semibold cursor-pointer transition-all hover:bg-white hover:border-#d4d4d8 hover:-translate-y-px"
          @click="handleCopyMarkdown"
        >
          复制 Markdown
        </button>
        <button
          class="h-36px rounded-14px border border-rgba(29,29,31,0.08) bg-white/72 text-#3f3f46 text-12px font-semibold cursor-pointer transition-all hover:bg-white hover:border-#d4d4d8 hover:-translate-y-px"
          :disabled="isPageUnsupported"
          @click="handlePreview"
        >
          仅预览
        </button>
      </div>

      <!-- Error -->
      <div
        v-if="extractError"
        class="mt-2.5 p-2.5 rounded-12px text-12px text-#dc2626"
        style="background: rgba(220,38,38,0.08); border: 1px solid rgba(220,38,38,0.15)"
      >
        {{ extractError }}
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
          :class="
            stepDone[i]
              ? 'border border-rgba(22,163,74,0.18) bg-rgba(22,163,74,0.07)'
              : stepActive === i
                ? 'border border-rgba(37,99,235,0.2) bg-rgba(37,99,235,0.07)'
                : 'border border-rgba(29,29,31,0.08) bg-white/58'
          "
        >
          <div
            class="w-22px h-22px rounded-8px grid place-items-center text-12px mb-2"
            :class="
              stepDone[i]
                ? 'bg-#16a34a text-white'
                : stepActive === i
                  ? 'bg-#2563eb text-white'
                  : 'bg-#f4f4f5 text-#52525b'
            "
          >
            {{ stepDone[i] ? '✓' : step.icon }}
          </div>
          <div class="text-11px font-bold text-#27272a">{{ step.title }}</div>
          <div class="mt-px text-10px leading-snug text-#a1a1aa">{{ step.desc }}</div>
        </div>
      </div>
    </div>

    <!-- Markdown Preview Card -->
    <div
      class="mt-3 p-3.5 rounded-20px"
      style="border: 1px solid rgba(29,29,31,0.08); background: rgba(255,255,255,0.78); backdrop-filter: blur(24px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.72), 0 1px 2px rgba(0,0,0,0.04)"
    >
      <SectionHead title="Markdown Preview" action="打开详情" @action="handlePreview" />
      <div
        class="p-3 rounded-16px border border-rgba(29,29,31,0.08) bg-rgba(250,250,250,0.74)"
      >
        <div class="mb-2 text-13px font-bold tracking-tight">
          {{ draft?.title || pageMeta?.title || 'Untitled' }}
        </div>
        <div class="text-#52525b text-12px leading-relaxed">
          {{ draft?.excerpt || pageMeta?.description || '暂无描述' }}
        </div>
        <div
          class="mt-2.5 px-2.5 py-2 rounded-12px text-#52525b text-11px font-mono whitespace-nowrap overflow-hidden text-ellipsis"
          style="border: 1px solid rgba(0,0,0,0.04); background: #f4f4f5"
        >
          {{
            draft?.markdown?.slice(0, 80) ||
            (isDraftValid() ? '' : '点击「提取正文并保存」或「仅预览」生成预览')
          }}
        </div>
      </div>
    </div>

    <!-- Recent Saves -->
    <div
      class="mt-3 p-3.5 rounded-20px"
      style="border: 1px solid rgba(29,29,31,0.08); background: rgba(255,255,255,0.78); backdrop-filter: blur(24px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.72), 0 1px 2px rgba(0,0,0,0.04)"
    >
      <SectionHead
        title="Recent Saves"
        action="全部文章"
        @action="emit('navigate', 'library')"
      />
      <div v-if="recentArticles.length === 0" class="px-4 py-7 text-center text-#6e6e73">
        <div class="text-14px font-bold text-#27272a">暂无保存文章</div>
        <div class="mt-1.5 text-12px">点击上方按钮保存当前网页。</div>
      </div>
      <div v-else class="flex flex-col gap-2">
        <ArticleItem
          v-for="article in recentArticles"
          :key="article.id"
          :article="article"
          @select="handleOpenRecent(article.id)"
          @delete="handleDeleteRecent(article.id)"
        />
      </div>
    </div>
  </section>
</template>
