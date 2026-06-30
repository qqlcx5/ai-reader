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

    // Inject page context as an user-role message,
    // placing it before conversation history and the user's actual input.
    if (input.context) {
      messages.push({ role: 'user', content: input.context })
    }

    // Append conversation history (skip entries with empty content)
    if (input.history && input.history.length > 0) {
      for (const entry of input.history) {
        if (entry.content) {
          messages.push({ role: entry.role, content: entry.content })
        }
      }
    }

    // Append current user input (skip if empty)
    if (input.userInput) {
      messages.push({ role: 'user', content: input.userInput })
    }

    return {
      messages,
      system: input.systemPrompt || undefined,
    }
  }
}
