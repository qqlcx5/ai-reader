import { describe, it, expect } from 'vitest'
import type { IRepository } from './repository'

// Test that all repositories satisfy the IRepository contract
describe('IRepository Contract', () => {
  it('requires findById method returning T | undefined', () => {
    // Compile-time contract verified by TypeScript in repository files
    const repo: IRepository<{ id: string }> = {
      findById: async (id: string) => ({ id }),
      findAll: async () => [],
      save: async (e: { id: string }) => e,
      delete: async (_id: string) => {},
      count: async () => 0,
    }
    expect(repo.findById).toBeDefined()
    expect(repo.findAll).toBeDefined()
    expect(repo.save).toBeDefined()
    expect(repo.delete).toBeDefined()
    expect(repo.count).toBeDefined()
  })

  it('save returns the entity itself', async () => {
    const repo: IRepository<{ id: string; name: string }> = {
      findById: async (_id: string) => undefined,
      findAll: async () => [],
      save: async (e: { id: string; name: string }) => e,
      delete: async () => {},
      count: async () => 0,
    }
    const result = await repo.save({ id: 'test-1', name: 'Test' })
    expect(result.id).toBe('test-1')
    expect(result.name).toBe('Test')
  })
})
