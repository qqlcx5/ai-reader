import { defineStore } from 'pinia';
import { ref } from 'vue';
import { sendToBackground } from '@/utils/messaging';
import type { ExtractContentResponse } from '@/utils/messaging';

export const useContentStore = defineStore('content', () => {
  const title = ref('');
  const url = ref('');
  const rawContent = ref('');
  const wordCount = ref(0);
  const loading = ref(false);
  const error = ref('');

  async function fetchContent() {
    loading.value = true;
    error.value = '';
    try {
      const result = await sendToBackground<ExtractContentResponse>({ action: 'extractContent' });
      title.value = result.title;
      url.value = result.url;
      rawContent.value = result.content;
      wordCount.value = result.wordCount;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to extract content';
    } finally {
      loading.value = false;
    }
  }

  function clear() {
    title.value = '';
    url.value = '';
    rawContent.value = '';
    wordCount.value = 0;
    error.value = '';
  }

  return { title, url, rawContent, wordCount, loading, error, fetchContent, clear };
});
