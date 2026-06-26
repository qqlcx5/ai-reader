import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/dexie';
import { chatRepository } from '@/core/chat/chat.repository';
import type { ChatHistory } from '@/db/schema';

function makeHistory(overrides: Partial<ChatHistory> = {}): ChatHistory {
  return {
    id: `ch_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    documentId: 'doc-1',
    modelId: 'model-1',
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Hello', timestamp: Date.now() },
      { role: 'assistant', content: 'Hi there!', timestamp: Date.now() },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

beforeEach(async () => {
  await db.chatHistories.clear();
});

describe('chatRepository', () => {
  it('should put and get a chat history', async () => {
    const history = makeHistory({ id: 'ch-1' });
    await chatRepository.put(history);

    const fetched = await chatRepository.getById('ch-1');
    expect(fetched).toBeDefined();
    expect(fetched?.messages).toHaveLength(2);
    expect(fetched?.model).toBe('gpt-4');
  });

  it('should get histories by documentId', async () => {
    await chatRepository.put(makeHistory({ id: 'ch-a', documentId: 'doc-1' }));
    await chatRepository.put(makeHistory({ id: 'ch-b', documentId: 'doc-1' }));
    await chatRepository.put(makeHistory({ id: 'ch-c', documentId: 'doc-2' }));

    const histories = await chatRepository.getByDocumentId('doc-1');
    expect(histories).toHaveLength(2);
  });

  it('should delete by id', async () => {
    await chatRepository.put(makeHistory({ id: 'ch-del' }));
    await chatRepository.delete('ch-del');

    expect(await chatRepository.getById('ch-del')).toBeUndefined();
  });

  it('should delete by documentId', async () => {
    await chatRepository.put(makeHistory({ id: 'ch-x', documentId: 'doc-x' }));
    await chatRepository.put(makeHistory({ id: 'ch-y', documentId: 'doc-x' }));
    await chatRepository.put(makeHistory({ id: 'ch-z', documentId: 'doc-other' }));

    await chatRepository.deleteByDocumentId('doc-x');

    expect(await chatRepository.count()).toBe(1);
    expect((await chatRepository.getById('ch-z'))?.documentId).toBe('doc-other');
  });

  it('should count histories', async () => {
    await chatRepository.put(makeHistory({ id: 'n1' }));
    await chatRepository.put(makeHistory({ id: 'n2' }));

    expect(await chatRepository.count()).toBe(2);
  });
});
