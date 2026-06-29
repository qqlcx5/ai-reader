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

  it('should inject context as an user message before history and user input', () => {
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

  it('should place context before history messages', () => {
    const result = builder.build({
      context: 'Context',
      history: [{ role: 'user', content: 'History Q' }],
      userInput: 'Now',
    })

    const contextIdx = result.messages.findIndex((m) => m.content === 'Context')
    const historyIdx = result.messages.findIndex((m) => m.content === 'History Q')
    const userIdx = result.messages.findIndex((m) => m.content === 'Now')

    expect(contextIdx).toBeLessThan(historyIdx)
    expect(historyIdx).toBeLessThan(userIdx)
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

    expect(result.messages).toHaveLength(2)
    expect(result.messages[0]).toEqual({ role: 'user', content: 'Ctx' })
    expect(result.messages[1]).toEqual({ role: 'user', content: 'Q' })
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
    expect(result.messages).toHaveLength(3)
    expect(result.messages[0]).toEqual({ role: 'user', content: 'Context info' })
    expect(result.messages[1]).toEqual({ role: 'user', content: 'Hist' })
    expect(result.messages[2]).toEqual({ role: 'user', content: 'Question' })
  })
})
