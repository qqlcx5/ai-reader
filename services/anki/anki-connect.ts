/**
 * Push flashcards to a local Anki via the AnkiConnect add-on
 * (https://foosoft.net/projects/anki-connect/ — default port 8765).
 *
 * Protocol: POST { action, version, params } → { result, error }.
 * We create the deck (no-op if it exists) and add Basic notes tagged
 * 'auramind'. Duplicates come back as null entries and are counted as skips.
 */
import type { FlashcardEntity } from '@/types/flashcard'
import type { AnkiConnectConfig } from '@/types/settings'

export const DEFAULT_ANKI_CONFIG: AnkiConnectConfig = {
  url: 'http://127.0.0.1:8765',
  deck: 'AuraMind',
}

export interface AnkiNotePayload {
  deckName: string
  modelName: 'Basic'
  fields: { Front: string; Back: string }
  tags: string[]
}

/** Escape a flashcard field for Anki's HTML model. */
export function toAnkiHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\t/g, ' ')
    .replace(/\r?\n/g, '<br>')
}

/** Build the addNotes payload for a batch of cards (pure). */
export function buildAnkiNotes(cards: FlashcardEntity[], deck: string): AnkiNotePayload[] {
  return cards.map((c) => ({
    deckName: deck,
    modelName: 'Basic' as const,
    fields: { Front: toAnkiHtml(c.front), Back: toAnkiHtml(c.back) },
    tags: ['auramind'],
  }))
}

async function ankiAction(config: AnkiConnectConfig, action: string, params: Record<string, unknown> = {}): Promise<any> {
  const res = await fetch(config.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, version: 6, params }),
  })
  if (!res.ok) throw new Error(`AnkiConnect HTTP ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(`AnkiConnect: ${data.error}`)
  return data.result
}

export interface PushResult {
  added: number
  /** null results = duplicates (already in Anki). */
  skipped: number
}

/** Create the deck (idempotent) and add all notes. */
export async function pushToAnki(
  cards: FlashcardEntity[],
  config: AnkiConnectConfig,
): Promise<PushResult> {
  if (cards.length === 0) return { added: 0, skipped: 0 }
  await ankiAction(config, 'createDeck', { deck: config.deck })
  const results: (number | null)[] = await ankiAction(config, 'addNotes', {
    notes: buildAnkiNotes(cards, config.deck),
  })
  const added = results.filter((r) => r != null).length
  return { added, skipped: results.length - added }
}
