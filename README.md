# AuraMind

> **AI-powered web clipper, reader, and spaced-repetition review tool.**
> Local-first · Privacy-respecting · Cross-device sync

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-blue)](https://chrome.google.com/webstore)
[![Built with WXT](https://img.shields.io/badge/Built%20with-WXT-1f2937)](https://wxt.dev)

> Also builds for Firefox (`pnpm build:firefox`). Background RSS refresh works on both engines (Firefox parses feeds in its persistent background page; Chromium uses an offscreen document).
>
> **YouTube captions caveat** (verified 2026-06): YouTube's `timedtext` API now requires a proof-of-origin token; the extension detects the empty response, explains why, and falls back to clipping the page itself. For reliable transcripts, download the audio and use 音频转写.

AuraMind turns the web into a personal, AI-curated knowledge base you can actually review and remember. Clip any page, get an AI summary, highlight what matters, and let the SM-2 algorithm schedule it for daily review.

---

## ✨ Features

- **✂️ One-click clipping** — clean Markdown extraction, works on every site (PDF / arXiv / YouTube transcripts / audio files included); right-click menu & keyboard shortcuts included
- **🤖 AI summaries, translation & knowledge QA** — side-panel chat that runs asynchronously while you browse; ask your whole library with hybrid keyword + semantic retrieval (RRF), clickable inline citations, optional AI auto-tagging on capture; aligned paragraph-by-paragraph translation with a cached bilingual view
- **🖍️ Highlights & floating toolbar** — save the parts that matter; read aloud with TTS; TOC navigation for long docs
- **🔁 SM-2 spaced repetition** — AI-generated QA or cloze flashcards, daily review with resurfacing, streaks, badge reminders, syncs across devices
- **📡 RSS reader & podcasts** — auto-discovery, scheduled refresh, content-hash dedup, OPML import/export, one-tap enclosure transcription
- **👁️ Page watch** — monitor any URL for content changes (content-hash diff) with change history and AI change summaries
- **📰 Daily AI digest** — a scheduled morning brief: yesterday's captures, review outlook, one action item
- **📊 Insights & publishing** — weekly stats dashboard and a daily reading goal ring; export your library as a dependency-free static HTML site with built-in search
- **🎙️ Voice input & omnibox** — dictate chat messages; type `am <query>` in the address bar to search your library
- **✉️ Newsletter inbox** — self-hosted Cloudflare Email Worker pulls newsletters into your library
- **🕸️ Knowledge graph** — `[[wikilinks]]` in notes connect documents; visualize your second brain
- **🔗 Related documents** — bigram similarity surfaces connected reading in the workspace
- **📤 Obsidian / Anki export** — Markdown ZIP (whole library, selection, or a collection), Anki TSV, or direct push via AnkiConnect
- **🔄 Cross-device sync** — WebDAV (Nextcloud, 坚果云) or S3 (Cloudflare R2, AWS S3, MinIO), full JSON backup/restore
- **🔊 Audio transcription** — turn podcasts/meetings into documents via any Whisper-compatible endpoint
- **🌓 Dark mode (experimental)** — light / dark / system setting
- **🔒 Local-first** — everything in IndexedDB, no servers, no tracking

## 🧠 Built For

- Researchers drowning in PDFs and blog posts
- Developers who save docs "to read later" (and never do)
- Language learners reviewing highlights
- Knowledge workers building a second brain

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| Framework | [WXT](https://wxt.dev) (Manifest V3) |
| UI | Vue 3 + UnoCSS + Reka UI |
| State | Pinia + persistedstate |
| Storage | IndexedDB (via Dexie) |
| Search | MiniSearch |
| Markdown | Marked |
| Sync | WebDAV · aws4fetch (S3) |
| Test | Vitest + Testing Library |

## 🚀 Development

```bash
pnpm install
pnpm dev          # start WXT dev server
pnpm compile      # type-check
pnpm build        # production build
pnpm zip          # build + zip for Chrome Web Store
```

## 📦 Project Structure

```
.
├── components/         # Vue components
│   ├── auramind/       # main workspace components
│   ├── common/         # shared atoms
│   ├── ui/             # design system primitives
│   ├── views/          # full-page views
│   └── workspace/      # workspace sub-components
├── composables/        # Vue composables
├── db/                 # Dexie schema & repositories
├── entrypoints/        # WXT entry points (background, content, sidepanel)
├── public/             # static assets (icons)
├── services/           # business logic (capture, ai, sync, etc.)
├── stores/             # Pinia stores
├── store/              # Chrome Web Store listing assets
│   ├── listing/        # en.md, zh-CN.md
│   └── privacy/        # privacy-policy.html
├── types/              # TypeScript types
└── utils/              # helpers
```

## 📝 Chrome Web Store

The full launch checklist, listing copy, and privacy policy live in [`store/`](./store/).

## 🤝 Contributing

PRs welcome. For major changes, please open an issue first to discuss what you'd like to change.

## 📄 License

[MIT](./LICENSE)
