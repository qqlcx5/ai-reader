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

export class AuraMindDB extends Dexie {
  documents!: Table<DocumentEntity, string>
  conversations!: Table<ConversationEntity, string>
  models!: Table<ModelConfig, string>
  settings!: Table<AppSettings, 'app-settings'>
  promptTemplates!: Table<PromptTemplate, string>
  collections!: Table<CollectionEntity, string>
  collectionItems!: Table<CollectionItemEntity, string>
  kvMeta!: Table<{ id: string; value: unknown }, string>
  feeds!: Table<FeedEntity, string>
  feedItems!: Table<FeedItemEntity, string>
  aiJobs!: Table<AiJobEntity, string>

  constructor() {
    super('AuraMindDB')
    this.version(DB_VERSION).stores(STORE_MAP)
  }
}

export const db = new AuraMindDB()
