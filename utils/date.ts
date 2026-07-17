import dayjs, { type ConfigType } from 'dayjs'

export function formatDate(date: ConfigType, format = 'YYYY-MM-DD HH:mm:ss'): string {
  return dayjs(date).format(format)
}

export function formatRelative(date: ConfigType): string {
  const minutes = dayjs().diff(dayjs(date), 'minute')
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = dayjs().diff(dayjs(date), 'hour')
  if (hours < 24) return `${hours}小时前`
  const days = dayjs().diff(dayjs(date), 'day')
  if (days < 7) return `${days}天前`
  return dayjs(date).format('YYYY-MM-DD')
}

export const nowISO = (): string => dayjs().toISOString()
export const toTimestamp = (date?: ConfigType): number => dayjs(date).valueOf()
export const dateKey = (date?: ConfigType): string => dayjs(date).format('YYYY-MM-DD')
export const formatLocal = (date?: ConfigType): string => dayjs(date).format('YYYY/M/D HH:mm:ss')
