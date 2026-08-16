import { describe, it, expect } from 'vitest'
import { exportFlashcardsToAnkiTxt } from './anki-export'
import type { FlashcardEntity } from '@/types/flashcard'
import { initialSm2State } from '@/utils/sm2'

function makeCard(overrides: Partial<FlashcardEntity> = {}): FlashcardEntity {
  const now = new Date().toISOString()
  return {
    id: 'c1',
    documentId: 'd1',
    front: '什么是 SM-2？',
    back: '间隔重复调度算法',
    source: 'ai',
    sm2: initialSm2State(),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('exportFlashcardsToAnkiTxt', () => {
  it('emits Anki headers and one TSV row per card', async () => {
    const blob = exportFlashcardsToAnkiTxt([makeCard(), makeCard({ front: 'Q2', back: 'B2' })])
    const text = await blob.text()
    const lines = text.split('\n')
    expect(lines[0]).toBe('#separator:tab')
    expect(lines[1]).toBe('#html:true')
    expect(lines[2]).toBe('什么是 SM-2？\t间隔重复调度算法')
    expect(lines[3]).toBe('Q2\tB2')
  })

  it('escapes HTML and flattens newlines/tabs in fields', async () => {
    const blob = exportFlashcardsToAnkiTxt([
      makeCard({ front: 'a<b>&c', back: 'line1\nline2\ttabbed' }),
    ])
    const text = await blob.text()
    const row = text.split('\n')[2]
    const [front, back] = row.split('\t')
    expect(front).toBe('a&lt;b&gt;&amp;c')
    expect(back).toBe('line1<br>line2 tabbed')
  })

  it('returns an empty importable file for no cards', async () => {
    const text = await exportFlashcardsToAnkiTxt([]).text()
    expect(text).toBe('#separator:tab\n#html:true')
  })
})
