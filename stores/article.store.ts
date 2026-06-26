import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Article } from '@/domain'
import * as articleRepo from '@/db/article.repository'

// ============================================================
// PageMind — Article Pinia Store
// ============================================================

export const useArticleStore = defineStore('article', () => {
  // ---- State ----
  const articles = ref<Article[]>([])
  const activeArticleId = ref<string | null>(null)
  const loading = ref(false)

  // ---- Getters ----
  const activeArticle = ref<Article | undefined>(undefined)

  async function loadArticles() {
    loading.value = true
    try {
      articles.value = await articleRepo.listArticles()
      // 恢复 activeArticle 引用
      if (activeArticleId.value) {
        activeArticle.value = articles.value.find((a) => a.id === activeArticleId.value)
      }
    } finally {
      loading.value = false
    }
  }

  async function saveArticle(article: Article) {
    const saved = await articleRepo.saveArticle(article)
    // 本地更新，避免全量重载
    const idx = articles.value.findIndex((a) => a.id === saved.id)
    if (idx !== -1) {
      articles.value[idx] = saved
    } else {
      articles.value.unshift(saved)
    }
    activeArticleId.value = saved.id
    activeArticle.value = saved
    return saved
  }

  async function deleteArticle(id: string) {
    await articleRepo.deleteArticle(id)
    articles.value = articles.value.filter((a) => a.id !== id)
    if (activeArticleId.value === id) {
      activeArticleId.value = null
      activeArticle.value = undefined
    }
  }

  async function getRecentArticles(limit = 3) {
    return articleRepo.getRecentArticles(limit)
  }

  async function searchArticles(keyword: string) {
    return articleRepo.searchArticles(keyword)
  }

  function setActiveArticle(id: string | null) {
    activeArticleId.value = id
    activeArticle.value = id ? articles.value.find((a) => a.id === id) : undefined
  }

  return {
    articles,
    activeArticleId,
    activeArticle,
    loading,
    loadArticles,
    saveArticle,
    deleteArticle,
    getRecentArticles,
    searchArticles,
    setActiveArticle,
  }
})
