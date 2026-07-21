import Dexie, { type Table } from 'dexie'
import { DB_VERSION, STORE_MAP } from './schema'
import type { DocumentEntity } from '../types/document'
import type { ConversationEntity } from '../types/chat'
import type { ModelConfig } from '../types/model'
import type { AppSettings } from '../types/settings'
import type { PromptTemplate } from '../types/prompt-template'
import type { CollectionEntity, CollectionItemEntity } from '../types/collection'
import type { FeedEntity, FeedItemEntity } from '../types/feed'
import type { AiJobEntity } from '../types/ai-job'
import type { WorkflowEntity } from '../types/workflow'
import type { ScheduleEntity } from '../types/schedule'
import type { AnalysisRuleEntity } from '../types/analysis-rule'

export class AuraMindDB extends Dexie {
  documents!: Table<DocumentEntity, string>
  conversations!: Table<ConversationEntity, string>
  models!: Table<ModelConfig, string>
  settings!: Table<AppSettings, 'app-settings'>
  promptTemplates!: Table<PromptTemplate, string>
  collections!: Table<CollectionEntity, string>
  collectionItems!: Table<CollectionItemEntity, string>
  kvMeta!: Table<{ id: string; value: unknown; updatedAt?: string }, string>
  feeds!: Table<FeedEntity, string>
  feedItems!: Table<FeedItemEntity, string>
  aiJobs!: Table<AiJobEntity, string>
  workflows!: Table<WorkflowEntity, string>
  schedules!: Table<ScheduleEntity, string>
  analysisRules!: Table<AnalysisRuleEntity, string>

  constructor() {
    super('AuraMindDB')
    this.version(DB_VERSION).stores(STORE_MAP)

    // v11: backfill readProgress for legacy documents so they show a progress
    // bar instead of being stuck in "unread" despite having lastOpenedAt.
    this.version(DB_VERSION).upgrade(async () => {
      await this.documents.toCollection().modify((doc) => {
        if (doc.readProgress == null) {
          doc.readProgress = doc.readAt ? 1 : (doc.lastOpenedAt ? 0 : undefined)
        }
      })
    })
  }
}

export const db = new AuraMindDB()
