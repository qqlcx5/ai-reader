import { defineStore } from 'pinia';
import type { SavedArticle } from '../shared/domain';

export const useLibraryStore = defineStore('library', {
  state: () => ({
    articles: [] as SavedArticle[],
    selectedId: null as string | null,
    isLoading: false,
  }),
  getters: {
    selectedArticle: (state) =>
      state.articles.find((a) => a.id === state.selectedId) ?? null,
    articleCount: (state) => state.articles.length,
  },
  actions: {
    setArticles(articles: SavedArticle[]) {
      this.articles = articles;
    },
    addArticle(article: SavedArticle) {
      this.articles.unshift(article);
    },
    removeArticle(id: string) {
      this.articles = this.articles.filter((a) => a.id !== id);
      if (this.selectedId === id) {
        this.selectedId = null;
      }
    },
    selectArticle(id: string | null) {
      this.selectedId = id;
    },
    setLoading(loading: boolean) {
      this.isLoading = loading;
    },
  },
  persist: false,
});
