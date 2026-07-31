import { describe, expect, it, vi } from 'vitest'
import { generateMetadata } from '../../src/core/skill-enricher'

const aiConfig = {
  baseUrl: 'https://example.test/v1',
  apiKey: 'test-key',
  model: 'test-model',
}

describe('generateMetadata', () => {
  it('sends Skill content to an OpenAI-compatible endpoint and validates JSON', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  name: '研究助手',
                  summary: '帮助进行系统化研究。',
                  categories: ['研究'],
                  useCases: ['资料调研'],
                  usage: '需要调研时使用。',
                  triggers: ['调研'],
                }),
              },
            },
          ],
        }),
        { status: 200 },
      ),
    )

    await expect(generateMetadata('# Research\n\nUse sources.', aiConfig)).resolves.toEqual({
      name: '研究助手',
      summary: '帮助进行系统化研究。',
      categories: ['研究'],
      useCases: ['资料调研'],
      usage: '需要调研时使用。',
      triggers: ['调研'],
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
        body: expect.stringContaining('# Research'),
      }),
    )
    fetchMock.mockRestore()
  })

  it('rejects malformed model output', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'not json' } }] }), { status: 200 }),
    )

    await expect(generateMetadata('content', aiConfig)).rejects.toThrow('AI response is not valid JSON')
    vi.restoreAllMocks()
  })

  it('preserves provider errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('bad gateway', { status: 502 }))

    await expect(generateMetadata('content', aiConfig)).rejects.toThrow('AI request failed with HTTP 502')
    vi.restoreAllMocks()
  })
})
