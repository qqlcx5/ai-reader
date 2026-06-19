import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { sendToBackground } from '@/utils/messaging';
import type { ExtractContentResponse } from '@/utils/messaging';

export const useContentStore = defineStore('content', () => {
  const title = ref('');
  const url = ref('');
  const rawContent = ref('');
  const wordCount = ref(0);
  const loading = ref(false);
  const error = ref('');
  const extractedAt = ref<number>(0);

  const isStale = computed(() => {
    if (extractedAt.value === 0) return true;
    return Date.now() - extractedAt.value > 5 * 60 * 1000;
  });

  const extractedAgo = computed(() => {
    if (extractedAt.value === 0) return '';
    const diff = Date.now() - extractedAt.value;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}秒前`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    return `${days}天前`;
  });

  async function fetchContent() {
    loading.value = true;
    error.value = '';
    try {
      const result = await sendToBackground<ExtractContentResponse>({ action: 'extractContent' });
      if (result.error) {
        error.value = result.error;
        return;
      }
      title.value = result.title;
      url.value = result.url;
      rawContent.value = result.content;
      wordCount.value = result.wordCount;
      extractedAt.value = Date.now();
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
    extractedAt.value = 0;
  }

  return {
    title,
    url,
    rawContent,
    wordCount,
    loading,
    error,
    extractedAt,
    isStale,
    extractedAgo,
    fetchContent,
    clear,
  };
});
