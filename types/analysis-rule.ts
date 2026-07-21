import type { AiJobPriority } from './ai-job'

/** Document fields a rule can match against. Deliberately limited to fields
 *  DocumentEntity actually has — no language/hasCode (those would require
 *  separate detection passes that don't exist yet). */
export type RuleField = 'domain' | 'siteName' | 'wordCount'

export type RuleOperator = 'contains' | 'gt' | 'lt' | 'equals'

export interface RuleCondition {
  field: RuleField
  operator: RuleOperator
  /** String for contains/equals; numeric compared as float for gt/lt. */
  value: string
}

export interface AnalysisRuleEntity {
  id: string
  name: string
  enabled: boolean
  /** AND-ed conditions on the document. Empty conditions = always matches. */
  conditions: RuleCondition[]
  /** ModelConfig.id used when this rule fires. */
  modelId: string
  /** PromptTemplate.id used when this rule fires. */
  promptTemplateId: string
  /** Priority for jobs spawned by this rule. */
  priority: AiJobPriority

  createdAt: string
  updatedAt: string
}
