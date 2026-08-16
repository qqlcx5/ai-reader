# Chrome Web Store Listing — AuraMind (English)

> All fields are at Chrome Web Store limits. Trim to taste.

## Name (≤45 chars)
```
AuraMind - AI Web Clipper & Reader
```

## Short description (≤132 chars)
```
AI-powered web clipper that summarizes, highlights, and turns pages into a spaced-repetition review feed. Local-first & privacy-respecting.
```

## Category
```
Productivity
```

## Detailed description
```markdown
# AuraMind — Your AI-Powered Second Brain for the Web

Stop drowning in tabs. AuraMind turns the web into a personal, AI-curated
knowledge base you can actually review and remember.

## ✂️ One-click Web Clipping
Save any article, blog post, or documentation page in clean Markdown. The
extension auto-extracts content, author, publish date, and cover image.
Works on every site — including those behind heavy JavaScript frameworks.

## 🤖 AI Summaries & Side-Panel Chat
Ask AI to summarize, translate, or answer questions about the page you're
reading. The side panel runs asynchronously — keep browsing while AI
works in the background.

## 🖍️ Highlights & Floating Toolbar
Highlight any passage on any page. A floating toolbar lets you save the
highlight, ask AI about it, or schedule it for review.

## 🔁 Spaced-Repetition Review (SM-2)
Generate QA or cloze flashcards from your highlights with AI; the SM-2
algorithm — the same science behind Anki — schedules daily review, with
streaks, due-count badge, daily new-card limits, and old-document
resurfacing. Push cards to Anki via export or AnkiConnect.

## 📡 RSS Reader with Auto-Discovery
Subscribe to feeds in one click. The extension refreshes on a schedule and
de-duplicates via content hash; OPML import/export, a self-hosted
newsletter inbox, and one-tap podcast transcription are built in.

## 🕸️ Knowledge Graph & Export
Connect documents with [[wikilinks]] and visualize your second brain;
related documents are surfaced automatically. Export to Obsidian-compatible
Markdown ZIP (highlights included), Anki cards, or a full JSON backup.

## 🔄 Cross-Device Sync
End-to-end sync via WebDAV (Nextcloud, 坚果云, etc.) or any S3-compatible
storage (Cloudflare R2, AWS S3, MinIO, Backblaze B2). Conflict-free
thanks to vector clocks. Flashcards and review progress sync too.

## 🔒 Local-First & Privacy
- Everything is stored locally in your browser's IndexedDB
- AI calls go to YOUR configured model provider — no middleman
- No tracking, no analytics, no third-party data sharing
- Open source on GitHub

## 🧠 Built For
- Researchers drowning in PDFs and blog posts
- Developers who save docs "to read later" (and never do)
- Language learners reviewing highlights and vocabulary
- Knowledge workers building a second brain

## Free & Open Source
[MIT License] | [GitHub] | [Documentation]
```

## Single-purpose description (required for review)
```
AuraMind is a single-purpose extension that helps users capture web content
and review it with AI-assisted spaced repetition. The extension's single
function is to turn web pages into reviewable knowledge cards.
```

## Permission justifications (for Chrome Web Store review)

| Permission | Why we need it |
|------------|---------------|
| `sidePanel` | Display the workspace / chat UI alongside the active tab. |
| `activeTab` | Read the URL and title of the tab the user is currently on (for the clip workflow). |
| `scripting` | Inject the content extractor into the active page so we can read its DOM. |
| `storage` | Persist settings, models, and the local IndexedDB store. |
| `tabs` | Reopen the side panel when the user switches tabs and broadcast tab events. |
| `windows` | Manage the optional popped-out workspace window. |
| `alarms` | Schedule periodic RSS feed refreshes and review-badge updates. |
| `offscreen` | Parse RSS bodies in the background (Chromium-only). |
| `contextMenus` | Right-click "clip this page / save selection" actions. |
| `http://127.0.0.1/*`, `http://localhost/*` | Optional AnkiConnect push (localhost only). |
| `<all_urls>` | Required to clip content from any site the user visits. |

## Data usage (for the "Privacy" tab)
```
AuraMind does NOT collect, transmit, sell, or share any user data to any
third party. All user content (clipped articles, highlights, models,
settings) is stored locally in the user's browser via IndexedDB.

Optional user-initiated data flows:
- AI API calls: sent to a model provider configured BY THE USER (e.g.
  their own OpenAI-compatible endpoint). AuraMind does not proxy or log
  these calls.
- Sync: if the user enables it, content is synced to a storage
  destination configured BY THE USER (WebDAV server or S3-compatible
  bucket). AuraMind does not have access to these credentials.
```
