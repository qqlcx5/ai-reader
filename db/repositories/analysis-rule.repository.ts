import { db } from '../index'
import type { AnalysisRuleEntity } from '../../types/analysis-rule'

export const AnalysisRuleRepository = {
  async findById(id: string): Promise<AnalysisRuleEntity | undefined> {
    return db.analysisRules.get(id)
  },

  async findAll(): Promise<AnalysisRuleEntity[]> {
    // Lower createdAt = earlier = higher precedence (first-match wins).
    return db.analysisRules.orderBy('createdAt').toArray()
  },

  async findEnabled(): Promise<AnalysisRuleEntity[]> {
    return (await db.analysisRules.toArray())
      .filter((r) => r.enabled)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
  },

  async save(rule: AnalysisRuleEntity): Promise<AnalysisRuleEntity> {
    await db.analysisRules.put(rule)
    return rule
  },

  async delete(id: string): Promise<void> {
    await db.analysisRules.delete(id)
  },
}
