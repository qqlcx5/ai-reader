/**
 * Publish — turn (a selection of) the library into a self-contained static
 * HTML site packed as a ZIP: index page grouped by month + one page per
 * document with rendered markdown. No JS, no dependencies; host anywhere.
 */
import { zipSync, strToU8 } from 'fflate'
import { renderMarkdown } from '@/utils/markdown'
import { nowISO } from '@/utils/date'
import type { DocumentEntity } from '@/types/document'

const CSS = `
* { box-sizing: border-box }
body { margin: 0; font-family: -apple-system, 'SF Pro Text', 'Segoe UI', 'PingFang SC', sans-serif; color: #27272a; background: #fafafa; line-height: 1.75 }
.wrap { max-width: 720px; margin: 0 auto; padding: 32px 20px 80px }
h1 { font-size: 24px } h2 { font-size: 19px; margin-top: 28px } h3 { font-size: 16px }
a { color: #6366f1; text-decoration: none } a:hover { text-decoration: underline }
.meta { color: #71717a; font-size: 13px; margin: 4px 0 0 }
.group h2 { font-size: 15px; color: #71717a; margin: 28px 0 10px; border-bottom: 1px solid #e4e4e7; padding-bottom: 6px }
.card { display: block; background: #fff; border: 1px solid #e4e4e7; border-radius: 12px; padding: 14px 16px; margin-bottom: 10px; transition: border-color .15s }
.card:hover { border-color: #6366f1 }
.card .t { font-weight: 600; font-size: 15px }
.card .s { color: #71717a; font-size: 12px; margin-top: 4px }
.tag { display: inline-block; font-size: 11px; background: #eef2ff; color: #4f46e5; border-radius: 999px; padding: 1px 8px; margin: 0 4px 4px 0 }
blockquote { border-left: 3px solid #6366f1; margin: 12px 0; padding: 4px 14px; background: #f8fafc; color: #52525b }
code { background: #f4f4f5; border-radius: 5px; padding: 2px 5px; font-size: 13px }
pre { background: #f6f8fa; border-radius: 10px; padding: 12px 14px; overflow-x: auto } pre code { background: transparent; padding: 0 }
img { max-width: 100%; border-radius: 8px }
table { border-collapse: collapse } th, td { border: 1px solid #e4e4e7; padding: 6px 12px }
.back { display: inline-block; margin-bottom: 18px; font-size: 13px }
footer { color: #a1a1aa; font-size: 12px; margin-top: 60px; border-top: 1px solid #e4e4e7; padding-top: 12px }
`

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function safeName(doc: DocumentEntity, used: Set<string>): string {
  const base = (doc.title || 'untitled')
    .replace(/[/\\:*?"<>|#%&{}$!'@+`=]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60) || 'untitled'
  let name = `${base}.html`
  let n = 2
  while (used.has(name)) name = `${base}-${n++}.html`
  used.add(name)
  return `docs/${encodeURIComponent(name)}`
}

/** Build the index page HTML grouping documents by capture month (pure). */
export function buildIndexHtml(docs: DocumentEntity[], files: Map<string, string>, generatedAt: string): string {
  const groups = new Map<string, DocumentEntity[]>()
  for (const doc of docs) {
    const month = (doc.capturedAt || '').slice(0, 7) || '未知时间'
    if (!groups.has(month)) groups.set(month, [])
    groups.get(month)!.push(doc)
  }
  const months = [...groups.keys()].sort().reverse()

  const sections = months.map((month) => {
    const items = groups.get(month)!
      .map((doc) => {
        const href = files.get(doc.id) ?? '#'
        const meta = [doc.siteName, (doc.capturedAt || '').slice(0, 10)].filter(Boolean).join(' · ')
        const tags = (doc.tags ?? []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')
        return `<a class="card" href="${escapeHtml(href)}">
  <div class="t">${escapeHtml(doc.title || '无标题')}</div>
  ${meta ? `<div class="s">${escapeHtml(meta)}</div>` : ''}
  ${tags ? `<div style="margin-top:6px">${tags}</div>` : ''}
</a>`
      })
      .join('\n')
    return `<section class="group"><h2>${month}</h2>${items}</section>`
  }).join('\n')

  return `<!doctype html>
<html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>My AuraMind Library</title><style>${CSS}</style></head>
<body><div class="wrap">
<h1>📚 My AuraMind Library</h1>
<p class="meta">${docs.length} 篇文档 · 生成于 ${generatedAt.slice(0, 10)} · <a href="search.html">🔎 搜索</a></p>
${sections}
<footer>由 AuraMind 生成 · 本地优先 · <a href="https://github.com">开源</a></footer>
</div></body></html>`
}

/** Build one document page with rendered markdown (pure). */
export function buildDocHtml(doc: DocumentEntity, backHref: string): string {
  const meta = [doc.siteName, doc.author, (doc.capturedAt || '').slice(0, 10)].filter((x): x is string => Boolean(x)).map(escapeHtml).join(' · ')
  const tags = (doc.tags ?? []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')
  const body = renderMarkdown(doc.markdown || '')
  const source = doc.url.startsWith('http') ? `<a href="${escapeHtml(doc.url)}" target="_blank" rel="noopener">查看原文</a>` : ''
  return `<!doctype html>
<html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(doc.title || '无标题')}</title><style>${CSS}</style></head>
<body><div class="wrap">
<a class="back" href="${escapeHtml(backHref)}">← 返回目录</a>
<h1>${escapeHtml(doc.title || '无标题')}</h1>
${meta ? `<p class="meta">${meta} · ${source}</p>` : ''}
${tags ? `<div style="margin:8px 0">${tags}</div>` : ''}
<article>${body}</article>
<footer>由 AuraMind 生成</footer>
</div></body></html>`
}

/** Build the client-side search page: prebuilt index + vanilla JS (pure). */
export function buildSearchHtml(docCount: number): string {
  return `<!doctype html>
<html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>搜索 · My AuraMind Library</title><style>${CSS}
input[type=search] { width: 100%; padding: 10px 14px; border: 1px solid #e4e4e7; border-radius: 10px; font-size: 15px; outline: none; margin-bottom: 14px }
input[type=search]:focus { border-color: #6366f1 }
.result { background:#fff; border:1px solid #e4e4e7; border-radius:10px; padding:10px 14px; margin-bottom:8px }
.result .t { font-weight:600; font-size:14px } .result .s { color:#71717a; font-size:12px; margin-top:2px }
mark { background: #eef2ff; color: #4f46e5; padding: 0 1px }
</style></head>
<body><div class="wrap">
<a class="back" href="index.html">← 目录</a>
<h1>🔎 搜索</h1>
<p class="meta">${docCount} 篇文档的本地全文索引，无需服务器</p>
<input type="search" id="q" placeholder="输入关键词，实时搜索…" autofocus>
<div id="results"></div>
<script>
// Prebuilt inverted index, injected by the generator.
const DOCS = __DOCS_INDEX__
const norm = (s) => s.toLowerCase()
const tokenize = (s) => { // CJK bigrams + word tokens
  const out = new Set()
  const words = norm(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  for (const w of words) {
    if (/[\u4e00-\u9fff\u3040-\u30ff]/.test(w)) { for (let i = 0; i < w.length - 1; i++) out.add(w.slice(i, i+2)) }
    else if (w.length > 0) out.add(w)
  }
  return out
}
const docTokens = DOCS.map((d) => tokenize(d.t + ' ' + d.x))
const q = document.getElementById('q'), results = document.getElementById('results')
function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }
function search() {
  const terms = [...tokenize(q.value)]
  results.innerHTML = ''
  if (terms.length === 0) return
  const scored = []
  for (let i = 0; i < DOCS.length; i++) {
    const tokens = docTokens[i]
    let score = 0
    for (const t of terms) if (tokens.has(t)) score++
    if (score > 0) scored.push({ i, score })
  }
  scored.sort((a, b) => b.score - a.score)
  if (scored.length === 0) { results.innerHTML = '<p class="meta">没有匹配的文档</p>'; return }
  for (const { i } of scored.slice(0, 30)) {
    const d = DOCS[i]
    const a = document.createElement('a')
    a.className = 'result'
    a.href = d.u
    a.innerHTML = '<div class="t">' + escapeHtml(d.t) + '</div>' + (d.x ? '<div class="s">' + escapeHtml(d.x.slice(0, 90)) + '</div>' : '')
    results.appendChild(a)
  }
}
q.addEventListener('input', search)
</script>
</div></body></html>`
}

/** Build an Atom feed for the exported site (pure). */
export function buildAtomXml(docs: DocumentEntity[], files: Map<string, string>, now: string): string {
  const entries = [...docs]
    .sort((a, b) => (b.capturedAt || '').localeCompare(a.capturedAt || ''))
    .slice(0, 50)
    .map((doc) => {
      const href = files.get(doc.id) ?? '#'
      const updated = (doc.updatedAt || doc.capturedAt || now)
      return `  <entry>
    <title>${escapeXml(doc.title || '无标题')}</title>
    <link href="${escapeXml(href)}"/>
    <id>${escapeXml(doc.url)}</id>
    <updated>${updated}</updated>
    <summary>${escapeXml((doc.excerpt || '').slice(0, 200))}</summary>
  </entry>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>My AuraMind Library</title>
  <id>urn:auramind-site</id>
  <updated>${now}</updated>
${entries}
</feed>`
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Build the whole site as a ZIP blob (pure aside from zipSync). */
export function buildSiteZip(docs: DocumentEntity[], now: string = nowISO()): Blob {
  const used = new Set<string>()
  const files = new Map<string, string>()
  for (const doc of docs) files.set(doc.id, safeName(doc, used))

  const zipFiles: Record<string, Uint8Array> = {}
  for (const doc of docs) {
    const path = files.get(doc.id)!
    zipFiles[path] = strToU8(buildDocHtml(doc, '../index.html'))
  }
  zipFiles['index.html'] = strToU8(buildIndexHtml(docs, files, now))

  // Search page: docs index (title + excerpt + href) + vanilla JS matcher.
  const docsIndex = docs.map((doc) => ({
    t: doc.title || '无标题',
    x: (doc.excerpt || doc.markdown || '').replace(/[#*>`\[\]]/g, '').slice(0, 160),
    u: files.get(doc.id)!,
  }))
  const searchHtml = buildSearchHtml(docs.length).replace('__DOCS_INDEX__', JSON.stringify(docsIndex))
  zipFiles['search.html'] = strToU8(searchHtml)
  zipFiles['atom.xml'] = strToU8(buildAtomXml(docs, files, now))

  return new Blob([zipSync(zipFiles)], { type: 'application/zip' })
}
