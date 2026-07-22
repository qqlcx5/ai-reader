export interface PromptInput {
  systemPrompt?: string
  context?: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  userInput: string
}

export interface PromptOutput {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  system?: string
}

export class PromptBuilder {
  build(input: PromptInput): PromptOutput {
    const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = []

    const context = input.context?.trim() || undefined
    const userInput = input.userInput?.trim() || ''
    const hasHistory = !!(input.history && input.history.length > 0)

    // Context placement:
    //  - First turn (no history): context and the question are joined into
    //    ONE user turn, so we don't emit two consecutive user messages.
    //  - Later turns (history exists): context becomes its OWN first user
    //    message, sitting ahead of the whole conversation history. The model
    //    sees it as the opening "background dump" of the chat, exactly like
    //    pasting an article before asking about it. The current question
    //    stays a clean standalone user turn at the end.
    if (context && hasHistory) {
      messages.push({ role: 'user', content: context })
    }
    const trailingUserContent = (!hasHistory)
      ? [context, userInput].filter((p): p is string => Boolean(p)).join('\n\n')
      : userInput

    // Append conversation history (skip entries with empty content)
    if (input.history) {
      for (const entry of input.history) {
        if (entry.content) {
          messages.push({ role: entry.role, content: entry.content })
        }
      }
    }

    // Append the current user turn (when present).
    if (trailingUserContent) {
      messages.push({ role: 'user', content: trailingUserContent })
    }

    return {
      messages,
      system: input.systemPrompt?.trim() || undefined,
    }
  }
}
