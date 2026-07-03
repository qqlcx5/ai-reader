import { describe, it, expect } from 'vitest'
import { mergeSet, type VersionedEntry } from './merge'

function ve(entity: any, version: string): VersionedEntry {
  return { entity, version }
}

function asMap(entries: Record<string, VersionedEntry>): Map<string, VersionedEntry> {
  return new Map(Object.entries(entries))
}

describe('mergeSet', () => {
  it('pushes new local entities when remote is empty', () => {
    const out = mergeSet({
      local: asMap({ a: ve({ id: 'a', v: 1 }, '2026-01-01T00:00:00Z') }),
      remote: new Map(),
      base: {},
    })
    expect([...out.merged.keys()]).toEqual(['a'])
    expect(out.stats.pushed).toBe(1)
    expect(out.localDeletes).toEqual([])
    expect(out.newBase.a).toBe('2026-01-01T00:00:00Z')
    expect(out.pushedIds).toEqual(['a'])
    expect(out.pulledIds).toEqual([])
  })

  it('pulls new remote entities when local is empty', () => {
    const out = mergeSet({
      local: new Map(),
      remote: asMap({ a: ve({ id: 'a', v: 1 }, '2026-01-01T00:00:00Z') }),
      base: {},
    })
    expect([...out.merged.keys()]).toEqual(['a'])
    expect(out.stats.pulled).toBe(1)
    expect(out.pulledIds).toEqual(['a'])
  })

  it('keeps both local-only and remote-only new entities (union)', () => {
    const out = mergeSet({
      local: asMap({ l: ve({ id: 'l' }, '2026-01-01T00:00:00Z') }),
      remote: asMap({ r: ve({ id: 'r' }, '2026-01-01T00:00:00Z') }),
      base: {},
    })
    expect([...out.merged.keys()].sort()).toEqual(['l', 'r'])
    expect(out.stats.pushed).toBe(1)
    expect(out.stats.pulled).toBe(1)
  })

  it('picks the newer version when both sides changed', () => {
    const out = mergeSet({
      local: asMap({ a: ve({ id: 'a', src: 'local' }, '2026-01-02T00:00:00Z') }),
      remote: asMap({ a: ve({ id: 'a', src: 'remote' }, '2026-01-03T00:00:00Z') }),
      base: { a: '2026-01-01T00:00:00Z' },
    })
    expect(out.merged.get('a').src).toBe('remote')
    expect(out.stats.pulled).toBe(1)
    expect(out.stats.conflicts).toBe(1)
  })

  it('treats unchanged-on-both-sides as no-op', () => {
    const out = mergeSet({
      local: asMap({ a: ve({ id: 'a' }, '2026-01-01T00:00:00Z') }),
      remote: asMap({ a: ve({ id: 'a' }, '2026-01-01T00:00:00Z') }),
      base: { a: '2026-01-01T00:00:00Z' },
    })
    expect(out.stats.pulled).toBe(0)
    expect(out.stats.pushed).toBe(0)
    expect(out.stats.conflicts).toBe(0)
    expect(out.merged.has('a')).toBe(true)
  })

  it('one-sided remote change is a pull, not a conflict', () => {
    const out = mergeSet({
      local: asMap({ a: ve({ id: 'a' }, '2026-01-01T00:00:00Z') }),
      remote: asMap({ a: ve({ id: 'a', x: 2 }, '2026-01-02T00:00:00Z') }),
      base: { a: '2026-01-01T00:00:00Z' },
    })
    expect(out.merged.get('a').x).toBe(2)
    expect(out.stats.pulled).toBe(1)
    expect(out.stats.conflicts).toBe(0)
  })

  it('propagates remote deletion to local (was in base, gone from remote)', () => {
    const out = mergeSet({
      local: asMap({ a: ve({ id: 'a' }, '2026-01-01T00:00:00Z') }),
      remote: new Map(),
      base: { a: '2026-01-01T00:00:00Z' },
    })
    expect(out.merged.has('a')).toBe(false)
    expect(out.localDeletes).toEqual(['a'])
    expect(out.stats.deletedLocal).toBe(1)
    expect(out.newBase.a).toBeUndefined()
  })

  it('propagates local deletion to remote (was in base, gone from local)', () => {
    const out = mergeSet({
      local: new Map(),
      remote: asMap({ a: ve({ id: 'a' }, '2026-01-01T00:00:00Z') }),
      base: { a: '2026-01-01T00:00:00Z' },
    })
    expect(out.merged.has('a')).toBe(false)
    expect(out.stats.deletedRemote).toBe(1)
    expect(out.remoteDeletes).toEqual(['a'])
    expect(out.newBase.a).toBeUndefined()
  })

  it('drops stale base entries already absent on both sides', () => {
    const out = mergeSet({
      local: new Map(),
      remote: new Map(),
      base: { ghost: '2026-01-01T00:00:00Z' },
    })
    expect(out.newBase.ghost).toBeUndefined()
    expect(out.merged.size).toBe(0)
  })

  it('local wins on exact version tie for convergence', () => {
    const out = mergeSet({
      local: asMap({ a: ve({ id: 'a', src: 'local' }, '2026-01-01T00:00:00Z') }),
      remote: asMap({ a: ve({ id: 'a', src: 'remote' }, '2026-01-01T00:00:00Z') }),
      base: { a: '2026-01-01T00:00:00Z' },
    })
    expect(out.merged.get('a').src).toBe('local')
  })

  it('resolve=local always picks local on real conflict', () => {
    const out = mergeSet({
      local: asMap({ a: ve({ id: 'a', src: 'local' }, '2026-01-05T00:00:00Z') }),
      remote: asMap({ a: ve({ id: 'a', src: 'remote' }, '2026-01-06T00:00:00Z') }),
      base: { a: '2026-01-01T00:00:00Z' },
      resolution: 'local',
    })
    expect(out.merged.get('a').src).toBe('local')
    expect(out.stats.conflicts).toBe(1)
    expect(out.conflicts[0].chosen).toBe('local')
  })

  it('resolve=remote always picks remote on real conflict', () => {
    const out = mergeSet({
      local: asMap({ a: ve({ id: 'a', src: 'local' }, '2026-01-06T00:00:00Z') }),
      remote: asMap({ a: ve({ id: 'a', src: 'remote' }, '2026-01-05T00:00:00Z') }),
      base: { a: '2026-01-01T00:00:00Z' },
      resolution: 'remote',
    })
    expect(out.merged.get('a').src).toBe('remote')
    expect(out.stats.conflicts).toBe(1)
    expect(out.conflicts[0].chosen).toBe('remote')
  })
})
