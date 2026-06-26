import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/dexie';
import { documentRepository } from '@/core/documents/document.repository';
import type { CapturedDocument } from '@/db/schema';

function makeDoc(overrides: Partial<CapturedDocument> = {}): CapturedDocument {
  return {
    id: `doc_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    title: 'Test Document',
    url: 'https://example.com/article',
    markdownContent: '# Hello World\n\nThis is test content.',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

beforeEach(async () => {
  await db.documents.clear();
});

describe('documentRepository', () => {
  it('should put and get a document', async () => {
    const doc = makeDoc({ id: 'doc-1' });
    await documentRepository.put(doc);

    const fetched = await documentRepository.getById('doc-1');
    expect(fetched).toBeDefined();
    expect(fetched?.title).toBe('Test Document');
    expect(fetched?.url).toBe('https://example.com/article');
  });

  it('should update updatedAt on put', async () => {
    const doc = makeDoc({ id: 'doc-2', updatedAt: 0 });
    await documentRepository.put(doc);

    const fetched = await documentRepository.getById('doc-2');
    expect(fetched?.updatedAt).toBeGreaterThan(0);
  });

  it('should get document by URL', async () => {
    const doc = makeDoc({ id: 'doc-3', url: 'https://test.com/page' });
    await documentRepository.put(doc);

    const fetched = await documentRepository.getByUrl('https://test.com/page');
    expect(fetched?.id).toBe('doc-3');
  });

  it('should get all documents ordered by createdAt desc', async () => {
    await documentRepository.put(makeDoc({ id: 'doc-old', createdAt: 1000 }));
    await documentRepository.put(makeDoc({ id: 'doc-new', createdAt: 2000 }));

    const all = await documentRepository.getAll();
    expect(all).toHaveLength(2);
    expect(all[0].id).toBe('doc-new');
    expect(all[1].id).toBe('doc-old');
  });

  it('should delete a document', async () => {
    await documentRepository.put(makeDoc({ id: 'doc-del' }));
    await documentRepository.delete('doc-del');

    const fetched = await documentRepository.getById('doc-del');
    expect(fetched).toBeUndefined();
  });

  it('should count documents', async () => {
    await documentRepository.put(makeDoc({ id: 'c1' }));
    await documentRepository.put(makeDoc({ id: 'c2' }));
    await documentRepository.put(makeDoc({ id: 'c3' }));

    expect(await documentRepository.count()).toBe(3);
  });

  it('should get recent documents with limit', async () => {
    for (let i = 0; i < 10; i++) {
      await documentRepository.put(makeDoc({ id: `r${i}`, createdAt: i * 1000 }));
    }

    const recent = await documentRepository.getRecent(3);
    expect(recent).toHaveLength(3);
    expect(recent[0].id).toBe('r9');
  });

  it('should get documents by date range', async () => {
    await documentRepository.put(makeDoc({ id: 'in-range', createdAt: 5000 }));
    await documentRepository.put(makeDoc({ id: 'out-range', createdAt: 15000 }));

    const docs = await documentRepository.getByDateRange(1000, 10000);
    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBe('in-range');
  });
});
