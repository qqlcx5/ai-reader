/**
 * K-means clustering over embedding vectors — small, deterministic, pure.
 * Used by topic discovery: group the library into themes.
 */

/** Euclidean distance (pure). */
export function distance(a: number[], b: number[]): number {
  let sum = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) sum += (a[i] - b[i]) ** 2
  return Math.sqrt(sum)
}

function mean(points: number[][]): number[] {
  if (points.length === 0) return []
  const dim = points[0].length
  const m = new Array(dim).fill(0)
  for (const p of points) for (let i = 0; i < dim; i++) m[i] += p[i]
  return m.map((v) => v / points.length)
}

/**
 * Deterministic seeding: first point, then repeatedly the point FARTHEST
 * from its nearest seed (k-means++-lite, no RNG — stable across runs).
 */
function seedCentroids(points: number[][], k: number): number[][] {
  const seeds: number[][] = [points[0].slice()]
  while (seeds.length < k) {
    let best = -1
    let bestDist = -1
    for (let i = 0; i < points.length; i++) {
      const nearest = Math.min(...seeds.map((s) => distance(points[i], s)))
      if (nearest > bestDist) {
        bestDist = nearest
        best = i
      }
    }
    if (best < 0) break
    seeds.push(points[best].slice())
  }
  return seeds
}

/**
 * Run k-means; returns per-point cluster labels. Deterministic (no RNG).
 */
export function kMeans(points: number[][], k: number, iterations = 12): number[] {
  const n = points.length
  if (n === 0) return []
  const kk = Math.max(1, Math.min(k, n))
  if (n === 1 || kk === 1) return new Array(n).fill(0)

  let centroids = seedCentroids(points, kk)
  let labels = new Array(n).fill(0)

  for (let iter = 0; iter < iterations; iter++) {
    let changed = false
    for (let i = 0; i < n; i++) {
      let best = 0
      let bestDist = Infinity
      for (let c = 0; c < centroids.length; c++) {
        const d = distance(points[i], centroids[c])
        if (d < bestDist) {
          bestDist = d
          best = c
        }
      }
      if (labels[i] !== best) {
        labels[i] = best
        changed = true
      }
    }
    const next: number[][] = []
    for (let c = 0; c < centroids.length; c++) {
      const members = points.filter((_, i) => labels[i] === c)
      next.push(members.length > 0 ? mean(members) : centroids[c])
    }
    centroids = next
    if (!changed) break
  }
  return labels
}

/** Heuristic cluster count: ~sqrt(n/2), clamped to [2, 8]. */
export function pickK(n: number): number {
  if (n < 4) return Math.max(1, Math.min(2, n))
  return Math.max(2, Math.min(8, Math.round(Math.sqrt(n / 2))))
}
