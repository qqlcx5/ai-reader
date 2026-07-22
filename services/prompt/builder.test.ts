import { describe, it, expect } from 'vitest'
import { PromptBuilder } from './builder'

describe('PromptBuilder', () => {
  const builder = new PromptBuilder()

  it('should build messages with user input only', () => {
    const result = builder.build({ userInput: 'Hello' })

    expect(result.messages).toHaveLength(1)
    expect(result.messages[0]).toEqual({ role: 'user', content: 'Hello' })
    expect(result.system).toBeUndefined()
  })

  it('should include system prompt as top-level system field', () => {
    const result = builder.build({
      systemPrompt: 'You are helpful.',
      userInput: 'Hi',
    })

    expect(result.system).toBe('You are helpful.')
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0]).toEqual({ role: 'user', content: 'Hi' })
  })

  // First turn (no history): context and the current question are joined
  // into one user message so we never emit two consecutive user turns.
  it('should join context and current input into one user message on the first turn (no history)', () => {
    const result = builder.build({
      context: '# Page Content',
      userInput: 'Current Q',
    })

    expect(result.messages).toHaveLength(1)
    expect(result.messages[0]).toEqual({ role: 'user', content: '# Page Content\n\nCurrent Q' })
  })

  // Later turns (history exists): context becomes its OWN first user
  // message, sitting ahead of the whole conversation. This matches the
  // Cherry Studio shape: system, user(context), [history...], user(Q).
  it('should place context as the FIRST user message ahead of history on later turns', () => {
    const result = builder.build({
      context: '# Page Content',
      history: [
        { role: 'user', content: 'Previous Q' },
        { role: 'assistant', content: 'Previous A' },
      ],
      userInput: 'Current Q',
    })

    expect(result.messages).toHaveLength(4)
    expect(result.messages[0]).toEqual({ role: 'user', content: '# Page Content' })
    expect(result.messages[1]).toEqual({ role: 'user', content: 'Previous Q' })
    expect(result.messages[2]).toEqual({ role: 'assistant', content: 'Previous A' })
    expect(result.messages[3]).toEqual({ role: 'user', content: 'Current Q' })
  })

  it('should keep history before the current user turn', () => {
    const result = builder.build({
      context: 'Context',
      history: [{ role: 'user', content: 'History Q' }],
      userInput: 'Now',
    })

    const ctxIdx = result.messages.findIndex((m) => m.content === 'Context')
    const historyIdx = result.messages.findIndex((m) => m.content === 'History Q')
    const userIdx = result.messages.findIndex((m) => m.content === 'Now')

    expect(ctxIdx).toBeLessThan(historyIdx)
    expect(historyIdx).toBeLessThan(userIdx)
  })

  it('should preserve context when the current question is empty', () => {
    const result = builder.build({ context: 'Page content', userInput: '' })

    expect(result.messages).toEqual([{ role: 'user', content: 'Page content' }])
  })

  it('should trim whitespace from system prompt and user turn parts', () => {
    const result = builder.build({
      systemPrompt: '  System  ',
      context: '  Context  ',
      userInput: '  Question  ',
    })

    expect(result.system).toBe('System')
    expect(result.messages).toEqual([{ role: 'user', content: 'Context\n\nQuestion' }])
  })

  it('should return undefined system when systemPrompt is empty', () => {
    const result = builder.build({ userInput: 'Hi' })

    expect(result.system).toBeUndefined()
  })

  it('should handle empty history', () => {
    const result = builder.build({
      systemPrompt: 'Sys',
      context: 'Ctx',
      history: [],
      userInput: 'Q',
    })

    expect(result.messages).toHaveLength(1)
    expect(result.messages[0]).toEqual({ role: 'user', content: 'Ctx\n\nQ' })
  })

  it('should handle undefined history', () => {
    const result = builder.build({
      systemPrompt: 'Sys',
      userInput: 'Q',
    })

    expect(result.messages).toHaveLength(1)
    expect(result.system).toBe('Sys')
  })

  it('should combine all fields together', () => {
    const result = builder.build({
      systemPrompt: 'System prompt',
      context: 'Context info',
      history: [{ role: 'user', content: 'Hist' }],
      userInput: 'Question',
    })

    expect(result.system).toBe('System prompt')
    // context(first user) + history user + current user
    expect(result.messages).toHaveLength(3)
    expect(result.messages[0]).toEqual({ role: 'user', content: 'Context info' })
    expect(result.messages[1]).toEqual({ role: 'user', content: 'Hist' })
    expect(result.messages[2]).toEqual({ role: 'user', content: 'Question' })
  })
})
