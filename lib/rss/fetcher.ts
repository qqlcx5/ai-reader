/**
 * M9 RSS 拉取器
 *
 * fetchFeed(url): 获取并解析 RSS 2.0 / Atom 1.0 XML，超时 10s。
 * 返回 RawFeedData { feedTitle, feedUrl, items: RawArticle[] }
 */

import type { RawArticle, RawFeedData } from './types'

const MAX_ITEMS = 200

/**
 * 拉取并解析一个 RSS/Atom 订阅源。
 * 使用 AbortSignal.timeout(10000) 保证 10s 超时。
 */
export async function fetchFeed(url: string): Promise<RawFeedData> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: {
      Accept: 'application/rss+xml, application/atom+xml, text/xml, application/xml, */*',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`)
  }

  const text = await response.text()
  return parseXml(url, text)
}

// ─── XML 解析 ────────────────────────────────────────────────────────────────

function parseXml(url: string, text: string): RawFeedData {
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'application/xml')

  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    return parseWithRegex(url, text)
  }

  const rssRoot = doc.querySelector('rss')
  if (rssRoot) {
    return parseRss2(url, doc)
  }

  const atomRoot = doc.querySelector('feed')
  if (atomRoot) {
    return parseAtom(url, doc)
  }

  return parseRss2(url, doc)
}

function parseRss2(url: string, doc: Document): RawFeedData {
  const feedTitle = textContent(doc.documentElement, 'channel > title') || url
  const items = doc.querySelectorAll('channel > item')
  const rawItems: RawArticle[] = []

  items.forEach((item) => {
    const title = textContent(item, 'title') || 'Untitled'
    const link = textContent(item, 'link') || textContent(item, 'guid') || ''
    const description = textContent(item, 'description') || ''
    const pubDateStr = textContent(item, 'pubDate')
    const author = textContent(item, 'author') || textContent(item, 'dc\\:creator') || ''

    rawItems.push({
      title: title.trim(),
      link: link.trim(),
      description,
      pubDate: parseDate(pubDateStr),
      author: author.trim() || undefined,
    })
  })

  return { feedTitle, feedUrl: url, items: rawItems.slice(0, MAX_ITEMS) }
}

function parseAtom(url: string, doc: Document): RawFeedData {
  const feedTitle = textContent(doc.documentElement, 'title') || url
  const entries = doc.querySelectorAll('feed > entry')
  const rawItems: RawArticle[] = []

  entries.forEach((entry) => {
    const title = textContent(entry, 'title') || 'Untitled'
    const linkEl = entry.querySelector('link[href]')
    const link = linkEl?.getAttribute('href') || textContent(entry, 'link') || ''
    const description =
      textContent(entry, 'content') ||
      textContent(entry, 'summary') ||
      ''
    const published =
      textContent(entry, 'published') ||
      textContent(entry, 'updated') ||
      ''
    const author = textContent(entry, 'author > name') || ''

    rawItems.push({
      title: title.trim(),
      link: link.trim(),
      description,
      pubDate: parseDate(published),
      author: author.trim() || undefined,
    })
  })

  return { feedTitle, feedUrl: url, items: rawItems.slice(0, MAX_ITEMS) }
}

// ─── 正则表达式降级解析 ───────────────────────────────────────────────────────

function parseWithRegex(url: string, text: string): RawFeedData {
  const feedTitleMatch = /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i.exec(text)
  const feedTitle = feedTitleMatch ? feedTitleMatch[1].trim() : url

  const rssItems = extractBlocks(text, 'item')
  if (rssItems.length > 0) {
    const items = rssItems.slice(0, MAX_ITEMS).map((block) => ({
      title: extractTag(block, 'title') || 'Untitled',
      link: extractTag(block, 'link') || extractTag(block, 'guid') || '',
      description: extractTag(block, 'description') || extractTag(block, 'content:encoded') || '',
      pubDate: parseDate(extractTag(block, 'pubDate')),
      author: extractTag(block, 'author') || extractTag(block, 'dc:creator') || undefined,
    }))
    return { feedTitle, feedUrl: url, items }
  }

  const atomEntries = extractBlocks(text, 'entry')
  if (atomEntries.length > 0) {
    const items = atomEntries.slice(0, MAX_ITEMS).map((block) => ({
      title: extractTag(block, 'title') || 'Untitled',
      link: extractHref(block) || '',
      description: extractTag(block, 'content') || extractTag(block, 'summary') || '',
      pubDate: parseDate(extractTag(block, 'published') || extractTag(block, 'updated')),
      author: extractTag(block, 'name') || undefined,
    }))
    return { feedTitle, feedUrl: url, items }
  }

  return { feedTitle, feedUrl: url, items: [] }
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function textContent(parent: Element | Document, selector: string): string {
  const el = parent.querySelector(selector)
  return el?.textContent?.trim() ?? ''
}

function extractTag(xml: string, tagName: string): string {
  const regex = new RegExp(
    `<${tagName}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tagName}>`,
    'i',
  )
  const match = regex.exec(xml)
  return match ? match[1].trim() : ''
}

function extractBlocks(text: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[\\s>][\\s\\S]*?<\\/${tag}>`, 'gi')
  return [...text.matchAll(regex)].map((m) => m[0])
}

function extractHref(block: string): string {
  const match = /<link[^>]+href=["']([^"']+)["']/i.exec(block)
  if (match) return match[1]
  return extractTag(block, 'link')
}

function parseDate(str: string): number {
  if (!str) return Date.now()
  const d = new Date(str)
  return isNaN(d.getTime()) ? Date.now() : d.getTime()
}
