import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { CapturedDocument } from '@/db/schema';

export const useDocumentStore = defineStore('document', () => {
  const currentDocument = ref<CapturedDocument | null>(null);
  const documentList = ref<CapturedDocument[]>([]);
  const loading = ref(false);

  function setCurrentDocument(doc: CapturedDocument | null) {
    currentDocument.value = doc;
  }

  function setDocumentList(list: CapturedDocument[]) {
    documentList.value = list;
  }

  function addDocument(doc: CapturedDocument) {
    const existing = documentList.value.findIndex((d) => d.id === doc.id);
    if (existing >= 0) {
      documentList.value[existing] = doc;
    } else {
      documentList.value.unshift(doc);
    }
  }

  function removeDocument(id: string) {
    documentList.value = documentList.value.filter((d) => d.id !== id);
    if (currentDocument.value?.id === id) {
      currentDocument.value = null;
    }
  }

  return {
    currentDocument,
    documentList,
    loading,
    setCurrentDocument,
    setDocumentList,
    addDocument,
    removeDocument,
  };
});
