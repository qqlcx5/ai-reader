import { ref, computed } from 'vue'
import { useLibraryStore } from '@/stores/library'
import type { SavedArticle } from '@/shared/domain'

export function useArticles() {
  const library = useLibraryStore()
  const searchQuery = ref('')
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const filteredArticles = computed(() => {
    const q = searchQuery.value.toLowerCase().trim()
    if (!q) return library.articles
    return library.articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.excerpt.toLowerCase().includes(q) ||
        a.siteName.toLowerCase().includes(q) ||
        a.markdown.toLowerCase().includes(q),
    )
  })

  const groupedByDate = computed(() => {
    const groups: { label: string; articles: SavedArticle[] }[] = []
    const seen = new Set<string>()
    for (const article of filteredArticles.value) {
      const date = new Date(article.createdAt)
      const label = `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月${String(date.getDate()).padStart(2, '0')}日`
      if (!seen.has(label)) {
        seen.add(label)
        groups.push({ label, articles: [] })
      }
      groups[groups.length - 1].articles.push(article)
    }
    return groups
  })

  function setSearchQuery(q: string) {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      searchQuery.value = q
    }, 200)
  }

  return { searchQuery, filteredArticles, groupedByDate, setSearchQuery }
}
