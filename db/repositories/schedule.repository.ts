import { db } from '../index'
import type { ScheduleEntity } from '../../types/schedule'

export const ScheduleRepository = {
  async findById(id: string): Promise<ScheduleEntity | undefined> {
    return db.schedules.get(id)
  },

  async findAll(): Promise<ScheduleEntity[]> {
    return db.schedules.orderBy('createdAt').toArray()
  },

  async findEnabled(): Promise<ScheduleEntity[]> {
    // ponytail: no createdAt index on schedules store; in-memory sort is fine
    // (schedules count is expected to stay in single digits).
    const all = await db.schedules.toArray()
    return all
      .filter((s) => s.enabled)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  },

  async save(schedule: ScheduleEntity): Promise<ScheduleEntity> {
    await db.schedules.put(schedule)
    return schedule
  },

  async delete(id: string): Promise<void> {
    await db.schedules.delete(id)
  },

  /** Update only the fire-tracking fields after a cron tick. */
  async markFired(id: string, at: string, error?: string): Promise<void> {
    await db.schedules.update(id, { lastFiredAt: at, lastFireError: error })
  },
}
