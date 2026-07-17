import dayjs from 'dayjs'
import { db } from '../index'

/** Key-value meta store: device-local data (WebDAV config, sync state). Not synced. */
export const MetaRepository = {
  async get<T>(id: string): Promise<T | undefined> {
    const row = await db.kvMeta.get(id)
    return row?.value as T | undefined
  },

  async set<T>(id: string, value: T): Promise<void> {
    await db.kvMeta.put({ id, value, updatedAt: dayjs().toISOString() })
  },

  async remove(id: string): Promise<void> {
    await db.kvMeta.delete(id)
  },
}
