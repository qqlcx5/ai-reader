/**
 * Built-in reference pricing table (CNY per 1M tokens).
 *
 * Source: data/pricing.md (manually maintained, 2026-06).
 * Reference FX rate used: 1 USD = 7 CNY.
 *
 * These are REFERENCE values — provider prices change and reseller/relay
 * pricing differs. Users can override per-model via ModelConfig.inputPricePer1M
 * / outputPricePer1M.
 *
 * Match order matters: more specific patterns must come BEFORE broader ones.
 */

interface PricingEntry {
  match: RegExp
  /** CNY per 1M input tokens. */
  input: number
  /** CNY per 1M output tokens. */
  output: number
}

const PRICING_TABLE: PricingEntry[] = [
  // ── Google Gemini ────────────────────────────────────────────────
  // gemini-3.5-flash: $1.5 / $9
  { match: /gemini.*flash/i, input: 10.5, output: 63 },
  // gemini-3-pro-preview / gemini-3.1-pro-preview: $2 / $12
  { match: /gemini.*pro/i, input: 14, output: 84 },

  // ── OpenAI GPT ───────────────────────────────────────────────────
  // gpt-5.6-luna: ¥4.5 / ¥36
  { match: /gpt[-_. ]?5\.6[-_. ]?luna/i, input: 4.5, output: 36 },
  // gpt-5.6-terra: ¥11.25 / ¥90
  { match: /gpt[-_. ]?5\.6[-_. ]?terra/i, input: 11.25, output: 90 },
  // gpt-5.6-sol: ¥22.5 / ¥180
  { match: /gpt[-_. ]?5\.6[-_. ]?sol/i, input: 22.5, output: 180 },
  // gpt-5.4-mini: ¥11.25 / ¥67.5
  { match: /gpt.*5\.4.*mini/i, input: 11.25, output: 67.5 },
  // gpt-5.5: $5 / $30
  { match: /gpt.*5\.5/i, input: 35, output: 210 },
  // gpt-5.2: $1.75 / $14
  { match: /gpt.*5\.2/i, input: 12.25, output: 98 },

  // ── Anthropic Claude ─────────────────────────────────────────────
  // claude-sonnet-4-6: $3 / $15
  { match: /sonnet/i, input: 21, output: 105 },
  // claude-opus-4-8: $5 / $25
  { match: /opus/i, input: 35, output: 175 },

  // ── 智谱 GLM ─────────────────────────────────────────────────────
  // GLM-5.2
  { match: /glm/i, input: 8, output: 28 },

  // ── DeepSeek ─────────────────────────────────────────────────────
  // DeepSeek-V4-Pro: ¥3 / ¥6
  { match: /deepseek.*pro/i, input: 3, output: 6 },
  // DeepSeek-V4-Flash: ¥1 / ¥2
  { match: /deepseek.*flash/i, input: 1, output: 2 },

  // ── MiniMax ──────────────────────────────────────────────────────
  // MiniMax-M2.5: ¥2.1 / ¥8.4
  { match: /minimax/i, input: 2.1, output: 8.4 },
]

/** Resolve a model's CNY/1M price from the built-in table by modelId. */
export function resolvePricing(modelId: string): { input: number; output: number } | undefined {
  const entry = PRICING_TABLE.find((e) => e.match.test(modelId))
  return entry ? { input: entry.input, output: entry.output } : undefined
}
