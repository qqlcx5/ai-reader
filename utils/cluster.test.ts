import { describe, it, expect } from 'vitest'
import { kMeans, pickK, distance } from './cluster'

// Two well-separated groups in 2D: A-cluster near (0,0), B-cluster near (10,10).
const GROUP_A = [[0, 0], [0.5, 0.2], [0.2, 0.6]]
const GROUP_B = [[10, 10], [9.5, 10.3], [10.2, 9.6]]
const POINTS = [...GROUP_A, ...GROUP_B]

describe('distance', () => {
  it('computes euclidean distance', () => {
    expect(distance([0, 0], [3, 4])).toBe(5)
    expect(distance([1], [1])).toBe(0)
  })
})

describe('kMeans', () => {
  it('separates two well-distinct groups', () => {
    const labels = kMeans(POINTS, 2)
    const a = labels.slice(0, 3)
    const b = labels.slice(3)
    expect(new Set(a).size).toBe(1)
    expect(new Set(b).size).toBe(1)
    expect(a[0]).not.toBe(b[0])
  })

  it('is deterministic across runs', () => {
    const l1 = kMeans(POINTS, 2)
    const l2 = kMeans(POINTS, 2)
    expect(l1).toEqual(l2)
  })

  it('handles single-cluster and empty inputs', () => {
    expect(kMeans([], 3)).toEqual([])
    expect(kMeans([[1, 2]], 3)).toEqual([0])
    expect(kMeans([[1, 2], [3, 4]], 1)).toEqual([0, 0])
  })
})

describe('pickK', () => {
  it('scales with library size within bounds', () => {
    expect(pickK(3)).toBeLessThanOrEqual(3)
    expect(pickK(10)).toBeGreaterThanOrEqual(2)
    expect(pickK(1000)).toBeLessThanOrEqual(8)
    expect(pickK(32)).toBe(4)
  })
})
