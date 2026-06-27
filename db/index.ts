import Dexie, { type Table } from 'dexie'
import { DB_VERSION, STORE_MAP } from './schema'
import type { DocumentEntity } from '../types/document'
import type { ConversationEntity } from '../types/chat'
import type { ModelConfig } from '../types/model'
import type { AppSettings } from '../types/settings'

export class AuraMindDB extends Dexie {
  documents!: Table<DocumentEntity, string>
  conversations!: Table<ConversationEntity, string>
  models!: Table<ModelConfig, string>
  settings!: Table<AppSettings, 'app-settings'>

  constructor() {
    super('AuraMindDB')
    this.version(DB_VERSION).stores(STORE_MAP)
  }
}

export const db = new AuraMindDB()
