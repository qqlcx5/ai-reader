/** Default timeout for AI chat requests. Large models can take 30-60s on
 *  long articles, so we default to 240s. Connection tests use a shorter
 *  10s timeout passed explicitly. */
export const DEFAULT_TIMEOUT_MS = 240_000

export function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

export function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController()
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason)
      return controller.signal
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true })
  }
  return controller.signal
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const combinedSignal = options.signal
    ? anySignal([options.signal, controller.signal])
    : controller.signal

  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: combinedSignal })
  } finally {
    clearTimeout(timer)
  }
}
