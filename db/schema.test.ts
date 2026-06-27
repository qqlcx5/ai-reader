import { describe, it, expect } from 'vitest'
import { DB_VERSION, STORE_MAP } from './schema'
import { AuraMindDB } from './index'

describe('db/schema', () => {
  it('should define version 1', () => {
    expect(DB_VERSION).toBe(1)
  })

  it('should define all required stores', () => {
    expect(STORE_MAP).toHaveProperty('documents')
    expect(STORE_MAP).toHaveProperty('conversations')
    expect(STORE_MAP).toHaveProperty('models')
    expect(STORE_MAP).toHaveProperty('settings')
  })

  it('should create AuraMindDB with correct tables', () => {
    const db = new AuraMindDB()
    expect(db.documents).toBeDefined()
    expect(db.conversations).toBeDefined()
    expect(db.models).toBeDefined()
    expect(db.settings).toBeDefined()
    expect(db.name).toBe('AuraMindDB')
  })
})
