import type { AiConfig } from './config.js'
import type { SkillMetadata } from './schema.js'

export async function generateMetadata(content: string, config: AiConfig): Promise<SkillMetadata> {
  if (!config.baseUrl || !config.apiKey || !config.model) {
    throw new Error('AI configuration requires baseUrl, apiKey, and model')
  }

  const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            '根据给定的 SKILL.md 生成中文 Skill 元数据。只返回 JSON，不要 Markdown 代码块。字段必须是 name、summary、categories、useCases、usage、triggers。',
        },
        {
          role: 'user',
          content,
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`AI request failed with HTTP ${response.status}`)
  }

  const payload = (await response.json()) as unknown
  const contentValue = readMessageContent(payload)
  let parsed: unknown

  try {
    parsed = JSON.parse(contentValue)
  } catch {
    throw new Error('AI response is not valid JSON')
  }

  return assertMetadataDraft(parsed)
}

function readMessageContent(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.choices) || value.choices.length === 0) {
    throw new Error('AI response is missing choices')
  }

  const firstChoice = value.choices[0]
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    throw new Error('AI response is missing message content')
  }

  if (typeof firstChoice.message.content !== 'string') {
    throw new Error('AI response message content must be a string')
  }

  return firstChoice.message.content
}

function assertMetadataDraft(value: unknown): SkillMetadata {
  if (!isRecord(value)) {
    throw new Error('AI metadata must be an object')
  }

  assertString(value.name, 'name')
  assertString(value.summary, 'summary')
  assertStringArray(value.categories, 'categories')
  assertStringArray(value.useCases, 'useCases')
  assertString(value.usage, 'usage')
  assertStringArray(value.triggers, 'triggers')

  return value as unknown as SkillMetadata
}

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(`AI metadata field ${field} must be a string`)
  }
}

function assertStringArray(value: unknown, field: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`AI metadata field ${field} must be an array of strings`)
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null
}
