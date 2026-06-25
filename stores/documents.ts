/**
 * 文档状态管理
 * 参考 doc/tasks/foundation.md 章节 4
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { CapturedDocument } from '@/shared/types';
import { sendMessage } from '@/shared/messaging/runtime-client';
import { MessageType } from '@/shared/messaging/messages';
import { saveCapturedDocument, removeDocument, loadDocument } from '@/core/documents/document-service';

export const useDocumentsStore = defineStore('documents', () => {
  const documents = ref<CapturedDocument[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const currentDocument = ref<CapturedDocument | null>(null);

  async function loadDocuments(limit = 50, offset = 0): Promise<void> {
    loading.value = true;
    try {
      const res = await sendMessage(MessageType.LIST_DOCUMENTS, { limit, offset });
      if (res.success && res.data) {
        const data = res.data as { documents: CapturedDocument[]; total: number };
        documents.value = data.documents;
        total.value = data.total;
      }
    } finally {
      loading.value = false;
    }
  }

  async function captureFromContent(payload: {
    url: string;
    title: string;
    markdownContent: string;
    metadata: any;
  }): Promise<string> {
    const id = await saveCapturedDocument(payload);
    await loadDocuments();
    return id;
  }

  async function setCurrentDocument(doc: CapturedDocument): Promise<void> {
    currentDocument.value = doc;
  }

  async function selectDocument(id: string): Promise<void> {
    const doc = await loadDocument(id);
    if (doc) currentDocument.value = doc;
  }

  async function deleteDocumentById(id: string): Promise<void> {
    await removeDocument(id);
    if (currentDocument.value?.id === id) {
      currentDocument.value = null;
    }
    await loadDocuments();
  }

  return {
    documents,
    total,
    loading,
    currentDocument,
    loadDocuments,
    captureFromContent,
    setCurrentDocument,
    selectDocument,
    deleteDocumentById,
  };
});
