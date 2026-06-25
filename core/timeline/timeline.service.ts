/**
 * 时间轴聚合服务
 * 参考 doc/tasks/timeline.md 章节 1, 5
 */
import dayjs from 'dayjs';
import { listDocuments } from '@/db/document-repository';
import type { TimelineBucket, TimelineResult } from '@/shared/types';

export type { TimelineBucket, TimelineResult } from '@/shared/types';

export async function aggregateTimeline(days = 365): Promise<TimelineResult> {
  // 1. 加载所有文档（项目允许万级）
  const { documents } = await listDocuments(100000);

  // 2. 按天分组
  const map = new Map<string, string[]>();
  for (const doc of documents) {
    const day = dayjs(doc.createdAt).format('YYYY-MM-DD');
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(doc.id);
  }

  // 3. 生成连续 N 天的 buckets（包含 0 的日子）
  const buckets: TimelineBucket[] = [];
  const today = dayjs().startOf('day');
  for (let i = days - 1; i >= 0; i--) {
    const d = today.subtract(i, 'day').format('YYYY-MM-DD');
    const ids = map.get(d) || [];
    buckets.push({ date: d, count: ids.length, documentIds: ids });
  }

  // 4. 计算连续天数（streak）
  let streak = 0;
  for (let i = buckets.length - 1; i >= 0; i--) {
    if (buckets[i].count > 0) {
      streak++;
    } else {
      break;
    }
  }

  return {
    buckets,
    total: documents.length,
    streak,
  };
}
