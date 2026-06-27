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

    // Inject context as a system message (before history and user input)
    if (input.context) {
      messages.push({ role: 'system', content: input.context })
    }

    // Append conversation history
    if (input.history && input.history.length > 0) {
      for (const entry of input.history) {
        messages.push({ role: entry.role, content: entry.content })
      }
    }

    // Append current user input
    messages.push({ role: 'user', content: input.userInput })

    return {
      messages,
      system: input.systemPrompt || undefined,
    }
  }
}
