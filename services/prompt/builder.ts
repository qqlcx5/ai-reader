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

    // Context and the current question belong to one user turn.
    const userContent = [input.context, input.userInput]
      .map((part) => part?.trim())
      .filter((part): part is string => Boolean(part))
      .join('\n\n')

    // Append conversation history (skip entries with empty content)
    if (input.history && input.history.length > 0) {
      for (const entry of input.history) {
        if (entry.content) {
          messages.push({ role: entry.role, content: entry.content })
        }
      }
    }

    // Append the current user turn (context + input, when present).
    if (userContent) {
      messages.push({ role: 'user', content: userContent })
    }

    return {
      messages,
      system: input.systemPrompt?.trim() || undefined,
    }
  }
}
