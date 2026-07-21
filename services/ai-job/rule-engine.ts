import type { DocumentEntity } from '@/types/document'
import type { AnalysisRuleEntity, RuleCondition } from '@/types/analysis-rule'

/** Extract the hostname from a document URL. Empty string on parse failure. */
function docDomain(doc: DocumentEntity): string {
  try {
    return new URL(doc.url).hostname
  } catch {
    return ''
  }
}

/** Evaluate one condition against a document. */
function matchesCondition(cond: RuleCondition, doc: DocumentEntity): boolean {
  switch (cond.field) {
    case 'domain': {
      const actual = docDomain(doc).toLowerCase()
      const expected = cond.value.trim().toLowerCase()
      if (!expected) return false
      return cond.operator === 'contains'
        ? actual.includes(expected)
        : cond.operator === 'equals'
          ? actual === expected
          : false // gt/lt don't apply to strings
    }
    case 'siteName': {
      const actual = (doc.siteName ?? '').toLowerCase()
      const expected = cond.value.trim().toLowerCase()
      if (!expected) return false
      return cond.operator === 'contains'
        ? actual.includes(expected)
        : cond.operator === 'equals'
          ? actual === expected
          : false
    }
    case 'wordCount': {
      const actual = doc.wordCount ?? 0
      const expected = parseFloat(cond.value)
      if (Number.isNaN(expected)) return false
      return cond.operator === 'gt'
        ? actual > expected
        : cond.operator === 'lt'
          ? actual < expected
          : cond.operator === 'equals'
            ? actual === expected
            : false // contains doesn't apply to numbers
    }
  }
}

/** Whether all of a rule's conditions match a document (AND). */
export function ruleMatches(rule: AnalysisRuleEntity, doc: DocumentEntity): boolean {
  if (!rule.enabled) return false
  if (!rule.conditions.length) return true // no conditions = always matches
  return rule.conditions.every((c) => matchesCondition(c, doc))
}

/** Find the first rule (by createdAt order) that matches a document.
 *  Returns undefined when no enabled rule matches. */
export async function findMatchingRule(doc: DocumentEntity): Promise<AnalysisRuleEntity | undefined> {
  const rules = await import('@/db/repositories/analysis-rule.repository')
    .then((m) => m.AnalysisRuleRepository.findEnabled())
  return rules.find((r) => ruleMatches(r, doc))
}
