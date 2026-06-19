import { browser } from 'wxt/browser';

const SESSION_KEY = 'ai-reader-session';

export interface SessionData {
  slots?: Array<{
    providerId: string;
    modelId: string;
    text: string;
    estimatedCost: number;
    startTime: number;
    endTime: number;
  }>;
  content?: {
    title: string;
    url: string;
    rawContent: string;
    wordCount: number;
    extractedAt: number;
  };
}

export async function saveSession(data: SessionData): Promise<void> {
  try { await browser.storage.session.set({ [SESSION_KEY]: data }); } catch {}
}

export async function loadSession(): Promise<SessionData | null> {
  try {
    const result = await browser.storage.session.get(SESSION_KEY);
    return (result[SESSION_KEY] as SessionData) || null;
  } catch { return null; }
}

export async function clearSession(): Promise<void> {
  try { await browser.storage.session.remove(SESSION_KEY); } catch {}
}
