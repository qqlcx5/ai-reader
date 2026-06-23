/**
 * M9 RSS 自动化流水线 — 公共导出
 */

export type { RawArticle, RawFeedData } from './types'

export { fetchFeed } from './fetcher'

export { computeArticleId, filterNewArticles } from './dedup'

export { summarizeArticle } from './summarizer'

export { initAlarm, handleAlarm, saveRssConfig, loadConfig, RSS_ALARM_NAME } from './scheduler'

export { updateBadge } from './badge'

export { generateBriefing, checkShouldShowBriefing, markBriefingShown } from './daily-briefing'
