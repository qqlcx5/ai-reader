/**
 * Date formatting helpers based on dayjs.
 */

import dayjs from 'dayjs'

export function formatDate(date: string | Date, format = 'YYYY-MM-DD HH:mm:ss'): string {
  return dayjs(date).format(format)
}

export function formatRelative(date: string | Date): string {
  const d = dayjs(date)
  const now = dayjs()
  const diffMinutes = now.diff(d, 'minute')

  if (diffMinutes < 1) return '刚刚'
  if (diffMinutes < 60) return `${diffMinutes}分钟前`

  const diffHours = now.diff(d, 'hour')
  if (diffHours < 24) return `${diffHours}小时前`

  const diffDays = now.diff(d, 'day')
  if (diffDays < 7) return `${diffDays}天前`

  return d.format('YYYY-MM-DD')
}

export function nowISO(): string {
  return dayjs().toISOString()
}
