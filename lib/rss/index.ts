/**
 * M8 — Public surface for the RSS pipeline module.
 */
export * from './types';
export {
  computeItemHash,
  filterNewItems,
} from './dedup';
export {
  fetchFeed,
} from './fetcher';
export {
  scheduleAllFeeds,
  clearRssAlarms,
  parseRssAlarmName,
  RSS_ALARM_PREFIX,
} from './scheduler';
export {
  summarizeItem,
  summarizeBatch,
} from './summarizer';
export {
  updateBadge,
} from './badge';
export {
  runFeedPipeline,
  type PipelineResult,
} from './pipeline';
