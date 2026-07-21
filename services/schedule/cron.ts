/**
 * Minimal 5-field cron matcher: "min hour day-of-month month day-of-week".
 *
 * Supported syntax (deliberately small — covers the presets the UI ships with
 * and common cases; full cron quirks like L/W/#/names are out of scope):
 *   - digit:       exact match (e.g. "0" in min field → minute 0)
 *   - star:        any value
 *   - star-slash-n: every n-th value starting from the field's min (0 for min,
 *                  1 for the others)
 *   - "a-b":       range inclusive
 *   - "a,b,c":     list of any of the above
 *
 * Day-of-week: 0 = Sunday, 1-6 = Mon-Sat, 7 also = Sunday (cron convention).
 *
 * ponytail: no named months/days, no L/W/#, no @yearly shortcuts. Add when a
 * real user needs them — until then the preset list covers the common cases.
 */
export type CronField = 'minute' | 'hour' | 'dom' | 'month' | 'dow'

const FIELD_RANGES: Record<CronField, [number, number]> = {
  minute: [0, 59],
  hour: [0, 23],
  dom: [1, 31],
  month: [1, 12],
  dow: [0, 6], // we normalize 7 → 0
}

/** Parse one field into the set of integers it matches within its range. */
function parseField(expr: string, field: CronField): Set<number> {
  const [min, max] = FIELD_RANGES[field]
  const out = new Set<number>()

  for (const part of expr.split(',')) {
    const trimmed = part.trim()
    if (trimmed === '*') {
      for (let i = min; i <= max; i++) out.add(i)
      continue
    }
    // */n
    const stepMatch = trimmed.match(/^\*\/(\d+)$/)
    if (stepMatch) {
      const step = parseInt(stepMatch[1], 10)
      if (step <= 0) throw new Error(`Invalid step in "${trimmed}"`)
      for (let i = min; i <= max; i += step) out.add(i)
      continue
    }
    // a-b/n
    const rangeStepMatch = trimmed.match(/^(\d+)-(\d+)\/(\d+)$/)
    if (rangeStepMatch) {
      const lo = parseInt(rangeStepMatch[1], 10)
      const hi = parseInt(rangeStepMatch[2], 10)
      const step = parseInt(rangeStepMatch[3], 10)
      if (step <= 0) throw new Error(`Invalid step in "${trimmed}"`)
      for (let i = lo; i <= hi; i += step) out.add(i)
      continue
    }
    // a-b
    const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/)
    if (rangeMatch) {
      let lo = parseInt(rangeMatch[1], 10)
      let hi = parseInt(rangeMatch[2], 10)
      if (field === 'dow') {
        if (lo === 7) lo = 0
        if (hi === 7) hi = 0
      }
      for (let i = lo; i <= hi; i++) out.add(i)
      continue
    }
    // single digit
    const digitMatch = trimmed.match(/^(\d+)$/)
    if (digitMatch) {
      let v = parseInt(digitMatch[1], 10)
      if (field === 'dow' && v === 7) v = 0
      out.add(v)
      continue
    }
    throw new Error(`Invalid cron field "${trimmed}"`)
  }

  return out
}

export interface ParsedCron {
  minute: Set<number>
  hour: Set<number>
  dom: Set<number>
  month: Set<number>
  dow: Set<number>
}

/** Parse a full 5-field cron expression. Throws on malformed input. */
export function parseCron(expr: string): ParsedCron {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) {
    throw new Error(`Cron must have 5 fields, got ${parts.length}: "${expr}"`)
  }
  const [minute, hour, dom, month, dow] = parts
  return {
    minute: parseField(minute, 'minute'),
    hour: parseField(hour, 'hour'),
    dom: parseField(dom, 'dom'),
    month: parseField(month, 'month'),
    dow: parseField(dow, 'dow'),
  }
}

/** Whether a parsed cron matches the given Date. */
export function cronMatches(parsed: ParsedCron, date: Date): boolean {
  // JS getDay(): 0=Sun..6=Sat — matches cron's dow directly.
  return (
    parsed.minute.has(date.getMinutes()) &&
    parsed.hour.has(date.getHours()) &&
    parsed.dom.has(date.getDate()) &&
    parsed.month.has(date.getMonth() + 1) &&
    parsed.dow.has(date.getDay())
  )
}

/** Convenience: parse + match in one call. */
export function cronExprMatchesNow(expr: string, now: Date = new Date()): boolean {
  return cronMatches(parseCron(expr), now)
}
