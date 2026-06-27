// ============================================================
// Tests: Chat Repository CRUD
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { chatRepo } from './chat.repository';
import { db, type ChatSession, type ChatMessage } from './schema';

describe('Chat Repository — Session CRUD', () => {
  beforeEach(async () => {
    await db.chats.clear();
    await db.chatSessions.clear();
  });

  it('creates a session', async () => {
    const session = await chatRepo.createSession({
      articleId: 'article-1',
      providerId: 'deepseek',
      providerName: 'DeepSeek',
      modelName: 'deepseek-chat',
      workflow: 'tldr',
      systemPrompt: 'You are a helpful assistant.',
      title: 'Test Article',
    });

    expect(session.id).toBeTruthy();
    expect(session.articleId).toBe('article-1');
    expect(session.providerId).toBe('deepseek');
    expect(session.workflow).toBe('tldr');
    expect(session.createdAt).toBeTruthy();
    expect(session.updatedAt).toBeTruthy();
  });

  it('gets session by article ID', async () => {
    await chatRepo.createSession({
      articleId: 'article-1',
      providerId: 'deepseek',
      providerName: 'DeepSeek',
      modelName: 'deepseek-chat',
      workflow: 'tldr',
      systemPrompt: 'You are a helpful assistant.',
    });

    const fetched = await chatRepo.getSessionByArticleId('article-1');
    expect(fetched).toBeTruthy();
    expect(fetched!.articleId).toBe('article-1');
  });

  it('returns undefined for non-existent article', async () => {
    const result = await chatRepo.getSessionByArticleId('nonexistent');
    expect(result).toBeUndefined();
  });

  it('lists all sessions ordered by createdAt desc', async () => {
    await chatRepo.createSession({
      articleId: 'article-1',
      providerId: 'p1',
      providerName: 'P1',
      modelName: 'm1',
      workflow: 'tldr',
      systemPrompt: '...',
    });

    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 10));

    await chatRepo.createSession({
      articleId: 'article-2',
      providerId: 'p2',
      providerName: 'P2',
      modelName: 'm2',
      workflow: 'knowledge-extractor',
      systemPrompt: '...',
    });

    const sessions = await chatRepo.listSessions();
    expect(sessions).toHaveLength(2);
    expect(sessions[0].articleId).toBe('article-2'); // newest first
  });

  it('deletes session and associated messages', async () => {
    const session = await chatRepo.createSession({
      articleId: 'article-1',
      providerId: 'p1',
      providerName: 'P1',
      modelName: 'm1',
      workflow: 'tldr',
      systemPrompt: '...',
    });

    await chatRepo.saveMessage({
      sessionId: session.id,
      role: 'user',
      content: 'Hello',
      createdAt: new Date().toISOString(),
    });

    await chatRepo.deleteSession(session.id);

    const after = await chatRepo.getSessionByArticleId('article-1');
    expect(after).toBeUndefined();

    const msgs = await chatRepo.getMessagesBySessionId(session.id);
    expect(msgs).toHaveLength(0);
  });

  it('deletes by articleId (cascade)', async () => {
    await chatRepo.createSession({
      articleId: 'article-1',
      providerId: 'p1',
      providerName: 'P1',
      modelName: 'm1',
      workflow: 'tldr',
      systemPrompt: '...',
    });

    await chatRepo.deleteByArticleId('article-1');
    const result = await chatRepo.getSessionByArticleId('article-1');
    expect(result).toBeUndefined();
  });

  it('updates session', async () => {
    const session = await chatRepo.createSession({
      articleId: 'article-1',
      providerId: 'p1',
      providerName: 'P1',
      modelName: 'm1',
      workflow: 'tldr',
      systemPrompt: '...',
    });

    await chatRepo.updateSession(session.id, { title: 'Updated Title' });

    const updated = await chatRepo.getSessionById(session.id);
    expect(updated!.title).toBe('Updated Title');
  });
});

describe('Chat Repository — Message CRUD', () => {
  let sessionId: string;

  beforeEach(async () => {
    await db.chats.clear();
    await db.chatSessions.clear();

    const session = await chatRepo.createSession({
      articleId: 'article-1',
      providerId: 'deepseek',
      providerName: 'DeepSeek',
      modelName: 'deepseek-chat',
      workflow: 'tldr',
      systemPrompt: 'You are helpful.',
    });
    sessionId = session.id;
  });

  it('saves a message', async () => {
    const id = await chatRepo.saveMessage({
      sessionId,
      role: 'user',
      content: 'Hello, AI!',
      createdAt: new Date().toISOString(),
    });
    expect(id).toBeGreaterThan(0);
  });

  it('retrieves messages by session ID sorted by time', async () => {
    await chatRepo.saveMessage({
      sessionId,
      role: 'user',
      content: 'First',
      createdAt: '2025-01-01T00:00:00.000Z',
    });
    await chatRepo.saveMessage({
      sessionId,
      role: 'assistant',
      content: 'Second',
      createdAt: '2025-01-01T00:00:01.000Z',
    });

    const msgs = await chatRepo.getMessagesBySessionId(sessionId);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].content).toBe('First');
    expect(msgs[1].content).toBe('Second');
  });

  it('counts messages in session', async () => {
    expect(await chatRepo.countMessages(sessionId)).toBe(0);

    await chatRepo.saveMessage({
      sessionId,
      role: 'user',
      content: 'Hi',
      createdAt: new Date().toISOString(),
    });

    expect(await chatRepo.countMessages(sessionId)).toBe(1);
  });

  it('deletes all messages for a session', async () => {
    await chatRepo.saveMessage({
      sessionId,
      role: 'user',
      content: 'Msg 1',
      createdAt: new Date().toISOString(),
    });
    await chatRepo.saveMessage({
      sessionId,
      role: 'assistant',
      content: 'Msg 2',
      createdAt: new Date().toISOString(),
    });

    await chatRepo.deleteMessagesBySessionId(sessionId);
    expect(await chatRepo.countMessages(sessionId)).toBe(0);
  });

  it('getFullSession returns session + messages', async () => {
    await chatRepo.saveMessage({
      sessionId,
      role: 'user',
      content: 'Hello',
      createdAt: new Date().toISOString(),
    });

    const result = await chatRepo.getFullSession('article-1');
    expect(result).toBeTruthy();
    expect(result!.session.id).toBe(sessionId);
    expect(result!.messages).toHaveLength(1);
    expect(result!.messages[0].content).toBe('Hello');
  });

  it('getFullSession returns null for non-existent', async () => {
    const result = await chatRepo.getFullSession('nonexistent');
    expect(result).toBeNull();
  });

  it('touchSession updates updatedAt', async () => {
    const original = await chatRepo.getSessionById(sessionId);
    const originalTime = original!.updatedAt;

    await new Promise((r) => setTimeout(r, 10));
    await chatRepo.touchSession(sessionId);

    const updated = await chatRepo.getSessionById(sessionId);
    expect(updated!.updatedAt).not.toBe(originalTime);
  });

  it('generates unique session IDs', async () => {
    const s1 = await chatRepo.createSession({
      articleId: 'a1',
      providerId: 'p1',
      providerName: 'P1',
      modelName: 'm1',
      workflow: 'tldr',
      systemPrompt: '...',
    });

    const s2 = await chatRepo.createSession({
      articleId: 'a2',
      providerId: 'p2',
      providerName: 'P2',
      modelName: 'm2',
      workflow: 'tldr',
      systemPrompt: '...',
    });

    expect(s1.id).not.toBe(s2.id);
  });
});
