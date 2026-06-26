/**
 * Worker entrypoint.
 *
 * Vite's `?worker` import is the only first-class way to ship a
 * bundled Web Worker from an MV3 extension. This file exists
 * solely to do the import and register the resulting factory
 * on a well-known global so that `core/search/search.service`
 * (which can't itself use the `?worker` syntax because it runs
 * inside vitest's bundler) can ask for it.
 *
 * The factory is a regular function; calling it returns a
 * `Worker`-shaped object. The service treats that object as a
 * `WorkerLike` (a structural subset of the `Worker` interface).
 */

type WorkerCtor = new () => Worker
type GlobalScope = typeof globalThis & {
  __AI_READER_SEARCH_WORKER__?: () => Worker
}

const g = globalThis as GlobalScope

if (typeof g.__AI_READER_SEARCH_WORKER__ !== 'function') {
  // Vitest sets `process.env.VITEST` to a truthy value. We skip
  // the dynamic import there because the `?worker` suffix isn't
  // always resolvable in a test bundle; the service falls back
  // to its in-memory stub.
  const isVitest = (() => {
    try {
      // @ts-expect-error - process.env may be undefined in pure browser bundles
      return typeof process !== 'undefined' && !!process.env?.VITEST
    } catch {
      return false
    }
  })()

  if (!isVitest) {
    // Use a dynamic import so the `?worker` suffix is only
    // resolved by Vite's build pipeline, not by vitest's
    // static analyser.
    void import(
      /* @vite-ignore */
      '../../workers/search.worker.ts?worker'
    )
      .then((mod) => {
        const Ctor = (mod as { default: WorkerCtor }).default
        g.__AI_READER_SEARCH_WORKER__ = () => new Ctor()
      })
      .catch(() => {
        // Service will fall back to the in-memory stub.
      })
  }
}

export {}
