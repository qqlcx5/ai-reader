import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { SearchResult } from '@/db/schema';

export const useSearchStore = defineStore('search', () => {
  const results = ref<SearchResult[]>([]);
  const query = ref('');
  const loading = ref(false);
  const indexReady = ref(false);

  function setResults(r: SearchResult[]) {
    results.value = r;
  }

  function setQuery(q: string) {
    query.value = q;
  }

  function setLoading(l: boolean) {
    loading.value = l;
  }

  function setIndexReady(ready: boolean) {
    indexReady.value = ready;
  }

  return {
    results,
    query,
    loading,
    indexReady,
    setResults,
    setQuery,
    setLoading,
    setIndexReady,
  };
});
