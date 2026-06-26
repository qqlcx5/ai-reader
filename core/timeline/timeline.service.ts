import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import { db } from '@/db/dexie';
import type { CapturedDocument, TimelineBucket } from '@/db/schema';

dayjs.extend(weekOfYear);

export type TimelineMode = 'day' | 'week' | 'month';

export async function aggregateTimeline(
  mode: TimelineMode,
  startAt?: number,
  endAt?: number,
): Promise<TimelineBucket[]> {
  const start = startAt || dayjs().subtract(1, 'year').valueOf();
  const end = endAt || Date.now();

  const docs = await db.documents
    .where('createdAt')
    .between(start, end, true, true)
    .toArray();

  const buckets = new Map<string, { count: number; documentIds: string[] }>();

  for (const doc of docs) {
    let key: string;
    const d = dayjs(doc.createdAt);

    switch (mode) {
      case 'day':
        key = d.format('YYYY-MM-DD');
        break;
      case 'week':
        key = `${d.year()}-W${String(d.week()).padStart(2, '0')}`;
        break;
      case 'month':
        key = d.format('YYYY-MM');
        break;
    }

    const bucket = buckets.get(key) || { count: 0, documentIds: [] };
    bucket.count++;
    bucket.documentIds.push(doc.id);
    buckets.set(key, bucket);
  }

  return Array.from(buckets.entries())
    .map(([date, data]) => ({
      date,
      count: data.count,
      documentIds: data.documentIds,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getDocumentsForDate(date: string): Promise<CapturedDocument[]> {
  const start = dayjs(date).startOf('day').valueOf();
  const end = dayjs(date).endOf('day').valueOf();

  return db.documents
    .where('createdAt')
    .between(start, end, true, true)
    .toArray();
}

export async function getStats(): Promise<{
  total: number;
  todayCount: number;
  weekCount: number;
  streak: number;
  mostActiveDay: { date: string; count: number } | null;
}> {
  const allDocs = await db.documents.toArray();
  const today = dayjs().format('YYYY-MM-DD');
  const thisWeekStart = dayjs().startOf('week').valueOf();

  // 每日计数
  const dailyCounts = new Map<string, number>();
  for (const doc of allDocs) {
    const date = dayjs(doc.createdAt).format('YYYY-MM-DD');
    dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
  }

  // 连续天数
  let streak = 0;
  let checkDate = dayjs();
  while (true) {
    const dateStr = checkDate.format('YYYY-MM-DD');
    if (dailyCounts.has(dateStr)) {
      streak++;
      checkDate = checkDate.subtract(1, 'day');
    } else {
      break;
    }
  }

  // 最活跃的一天
  let mostActiveDay: { date: string; count: number } | null = null;
  for (const [date, count] of dailyCounts.entries()) {
    if (!mostActiveDay || count > mostActiveDay.count) {
      mostActiveDay = { date, count };
    }
  }

  return {
    total: allDocs.length,
    todayCount: dailyCounts.get(today) || 0,
    weekCount: allDocs.filter((d) => d.createdAt >= thisWeekStart).length,
    streak,
    mostActiveDay,
  };
}
