import { describe, it, expect, vi } from 'vitest'
import { buildAnkiNotes, toAnkiHtml, pushToAnki, DEFAULT_ANKI_CONFIG } from './anki-connect'
import type { FlashcardEntity } from '@/types/flashcard'
import { initialSm2State } from '@/utils/sm2'

function makeCard(front: string, back: string): FlashcardEntity {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(), documentId: 'd', front, back, source: 'ai',
    sm2: initialSm2State(), createdAt: now, updatedAt: now,
  }
}

describe('toAnkiHtml', () => {
  it('escapes HTML and flattens newlines/tabs', () => {
    expect(toAnkiHtml('a<b>&c\nd\te')).toBe('a&lt;b&gt;&amp;c<br>d e')
  })
})

describe('buildAnkiNotes', () => {
  it('maps cards to Basic notes in the given deck, tagged auramind', () => {
    const notes = buildAnkiNotes([makeCard('Q<br>', 'A')], '我的牌组')
    expect(notes).toEqual([{
      deckName: '我的牌组',
      modelName: 'Basic',
      fields: { Front: 'Q&lt;br&gt;', Back: 'A' },
      tags: ['auramind'],
    }])
  })
})

describe('pushToAnki', () => {
  const config = { ...DEFAULT_ANKI_CONFIG }

  it('creates the deck then adds notes, counting duplicates as skipped', async () => {
    const calls: any[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(init.body)
      calls.push(body.action)
      const result = body.action === 'createDeck' ? 12345 : [111, null, 333]
      return { ok: true, json: () => Promise.resolve({ result, error: null }) }
    }))

    const r = await pushToAnki([makeCard('Q1', 'A1'), makeCard('Q2', 'A2'), makeCard('Q3', 'A3')], config)
    expect(calls).toEqual(['createDeck', 'addNotes'])
    expect(r).toEqual({ added: 2, skipped: 1 })
    vi.unstubAllGlobals()
  })

  it('surfaces AnkiConnect errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: null, error: 'Deck was not found' }),
    }))
    await expect(pushToAnki([makeCard('Q', 'A')], config)).rejects.toThrow('Deck was not found')
    vi.unstubAllGlobals()
  })

  it('is a no-op for an empty batch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await pushToAnki([], config)).toEqual({ added: 0, skipped: 0 })
    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
