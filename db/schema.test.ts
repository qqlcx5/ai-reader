import { describe, it, expect } from 'vitest'
import { DB_VERSION, STORE_MAP } from './schema'
import { AuraMindDB } from './index'

describe('db/schema', () => {
  it('should define the current DB version', () => {
    expect(DB_VERSION).toBe(13)
  })

  it('should define all required stores', () => {
    expect(STORE_MAP).toHaveProperty('documents')
    expect(STORE_MAP).toHaveProperty('conversations')
    expect(STORE_MAP).toHaveProperty('models')
    expect(STORE_MAP).toHaveProperty('settings')
    expect(STORE_MAP).toHaveProperty('collections')
    expect(STORE_MAP).toHaveProperty('collectionItems')
    expect(STORE_MAP).toHaveProperty('feeds')
    expect(STORE_MAP).toHaveProperty('feedItems')
    expect(STORE_MAP).toHaveProperty('aiJobs')
    expect(STORE_MAP).toHaveProperty('workflows')
    expect(STORE_MAP).toHaveProperty('schedules')
    expect(STORE_MAP).toHaveProperty('analysisRules')
  })

  it('should create AuraMindDB with correct tables', () => {
    const db = new AuraMindDB()
    expect(db.documents).toBeDefined()
    expect(db.conversations).toBeDefined()
    expect(db.models).toBeDefined()
    expect(db.settings).toBeDefined()
    expect(db.collections).toBeDefined()
    expect(db.collectionItems).toBeDefined()
    expect(db.feeds).toBeDefined()
    expect(db.feedItems).toBeDefined()
    expect(db.aiJobs).toBeDefined()
    expect(db.workflows).toBeDefined()
    expect(db.schedules).toBeDefined()
    expect(db.analysisRules).toBeDefined()
    expect(db.name).toBe('AuraMindDB')
  })
})
