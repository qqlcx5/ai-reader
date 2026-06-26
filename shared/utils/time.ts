import dayjs from 'dayjs';

export function now(): number {
  return Date.now();
}

export function formatDate(timestamp: number): string {
  return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss');
}

export function formatRelative(timestamp: number): string {
  return dayjs(timestamp).fromNow();
}

export function startOfDay(timestamp: number): number {
  return dayjs(timestamp).startOf('day').valueOf();
}

export function isSameDay(a: number, b: number): boolean {
  return dayjs(a).isSame(dayjs(b), 'day');
}
