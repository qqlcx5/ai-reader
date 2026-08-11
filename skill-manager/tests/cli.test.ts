import { describe, expect, it } from 'vitest'
import { runCli } from '../src/cli/index'

describe('CLI', () => {
  it('shows help for an empty command', async () => {
    expect(await runCli([])).toBe(0)
  })

  it('accepts commands that do not need a catalog yet', async () => {
    for (const command of ['export', 'search']) {
      expect(await runCli([command])).toBe(0)
    }
  })

  it('rejects unknown commands', async () => {
    expect(await runCli(['unknown'])).toBe(1)
  })
})
